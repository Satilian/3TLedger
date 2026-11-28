import { fork, spawn } from 'node:child_process';
import { once } from 'node:events';
import { createRequire } from 'node:module';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const launcher = fileURLToPath(import.meta.url);
const appsRoot = fileURLToPath(new URL('../apps/', import.meta.url));
const ports = { shell: 3000, ledger: 3001, analytics: 3002, budgets: 3003, profile: 3004 };

function appLocation(name) {
  const cwd = join(appsRoot, name);
  const require = createRequire(join(cwd, 'package.json'));
  try {
    return { cwd, rsbuild: require('@rsbuild/core') };
  } catch (error) {
    throw new Error(`Cannot load Rsbuild for ${name}. Run pnpm install in apps/${name}.`, { cause: error });
  }
}

function appSettings() {
  const usedPorts = new Set();
  const settings = {};
  for (const [name, port] of Object.entries(ports)) {
    const { cwd, rsbuild } = appLocation(name);
    const env = { ...process.env, NODE_ENV: 'development' };
    delete env.PORT;
    rsbuild.loadEnv({ cwd, mode: 'development', processEnv: env });
    env.NODE_ENV = 'development';
    env.PORT ||= String(port);
    const selectedPort = Number(env.PORT);
    if (!Number.isInteger(selectedPort) || selectedPort < 1 || selectedPort > 65535 || usedPorts.has(selectedPort)) {
      throw new Error(`Invalid or duplicate PORT for apps/${name}.`);
    }
    usedPorts.add(selectedPort);
    settings[name] = { cwd, env };
  }
  const shellEnv = settings.shell.env;
  shellEnv.LEDGER_MF_URL ||= `http://localhost:${settings.ledger.env.PORT}/mf`;
  shellEnv.ANALYTICS_MF_URL ||= `http://localhost:${settings.analytics.env.PORT}/mf`;
  shellEnv.BUDGETS_MF_URL ||= `http://localhost:${settings.budgets.env.PORT}/mf`;
  shellEnv.PROFILE_MF_URL ||= `http://localhost:${settings.profile.env.PORT}/mf`;
  return settings;
}

function launchAll() {
  const settings = appSettings();
  const workers = new Map();
  let stopping = false;

  function stop() {
    if (stopping) return;
    stopping = true;
    for (const worker of workers.values()) {
      if (worker.connected) worker.disconnect();
    }
  }

  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  process.once('disconnect', stop);
  const url = (app) => `http://localhost:${settings[app].env.PORT}`;
  console.log(`Shell: ${url('shell')} | Ledger: ${url('ledger')} | Analytics: ${url('analytics')} | Budgets: ${url('budgets')} | Profile: ${url('profile')}`);
  console.log('Waiting for initial builds. Press Ctrl+C to stop.');
  for (const [name, { cwd, env }] of Object.entries(settings)) {
    const worker = fork(launcher, [name], { cwd, env, stdio: ['ignore', 'inherit', 'inherit', 'ipc'] });
    workers.set(name, worker);
    worker.once('error', (error) => {
      console.error(`[${name}] ${error.message}`);
      process.exitCode = 1;
      stop();
    });
    worker.once('exit', (code, signal) => {
      workers.delete(name);
      if (!stopping || code === 1) {
        console.error(`[${name}] dev process exited (${signal ?? code}).`);
        process.exitCode = 1;
        stop();
      }
    });
  }
}

function watchFederatedSources(cwd) {
  return {
    name: 'dev-watch-federated-sources',
    setup(api) {
      api.modifyRspackConfig((config, { environment }) => {
        if (environment.name !== 'web') return;
        config.plugins ??= [];
        config.plugins.push({
          apply(compiler) {
            compiler.hooks.afterCompile.tap('dev-watch-federated-sources', (compilation) => {
              compilation.contextDependencies.add(join(cwd, 'src'));
            });
          },
        });
      });
    },
  };
}

async function watchApp(name) {
  const { cwd, rsbuild } = appLocation(name);
  let server;
  let stopping = false;
  let build;

  async function stopServer() {
    const active = server;
    server = undefined;
    if (!active || active.exitCode !== null || active.signalCode !== null) return;
    const exited = once(active, 'exit');
    active.kill();
    await exited;
  }

  async function stop() {
    if (stopping) return;
    stopping = true;
    try {
      await stopServer();
      await build?.close();
    } catch (error) {
      console.error(`[${name}] ${error.message}`);
      process.exitCode = 1;
    } finally {
      if (process.connected) process.disconnect();
    }
  }

  process.once('SIGINT', stop);
  process.once('SIGTERM', stop);
  process.once('disconnect', stop);

  const { content } = await rsbuild.loadConfig({ cwd, envMode: 'development' });
  const publicVars = Object.fromEntries(
    Object.entries(process.env).filter(([key]) => key.startsWith('PUBLIC_'))
      .flatMap(([key, value]) => [
        [`process.env.${key}`, JSON.stringify(value)],
        [`import.meta.env.${key}`, JSON.stringify(value)],
      ]),
  );
  const instance = await rsbuild.createRsbuild({
    cwd,
    rsbuildConfig: rsbuild.mergeRsbuildConfig(content, {
      mode: 'development',
      source: { define: publicVars },
      plugins: name === 'shell' ? [] : [watchFederatedSources(cwd)],
    }),
  });
  if (stopping) return;

  async function restartServer({ stats }) {
    if (!stats || stats.hasErrors() || stopping) return;
    await stopServer();
    if (stopping) return;

    const active = spawn(process.execPath, ['dist/server.js'], { cwd, stdio: 'inherit' });
    server = active;
    active.once('error', (error) => {
      server = undefined;
      console.error(`[${name}] ${error.message}`);
      process.exitCode = 1;
      void stop();
    });
    active.once('exit', (code, signal) => {
      if (server !== active || stopping) return;
      server = undefined;
      console.error(`[${name}] SSR server exited (${signal ?? code}).`);
      process.exitCode = 1;
      void stop();
    });
  }
  instance.onAfterBuild({ order: 'post', handler: restartServer });
  build = await instance.build({ watch: true });
  if (stopping) await build.close();
}

try {
  const name = process.argv[2];
  if (name && Object.hasOwn(ports, name) && process.connected) {
    await watchApp(name);
  } else {
    launchAll();
  }
} catch (error) {
  console.error(error.message);
  process.exitCode = 1;
  if (process.connected) process.disconnect();
}
