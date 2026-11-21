import { ConfigParams, defineConfig, RsbuildConfig } from '@rsbuild/core';
import { pluginReact } from '@rsbuild/plugin-react';
import CompressionPlugin from 'compression-webpack-plugin';
import { pluginMF } from '@satilian/plugin-mf';
import mfTypes from './mf-types.config.json';
// import { readdirSync } from 'fs';

// const nodeModules = readdirSync('node_modules').filter((x) => x !== '.bin');

export default defineConfig(({ env }: ConfigParams) => {
  const config: RsbuildConfig = {
    html: {
      template: './src/index.html',
    },
    environments: {
      web: {
        output: {
          target: 'web',
        },
        resolve: {
          alias: {
            './server.query.ts': false,
          },
        },
        tools: {
          rspack: {
            plugins: [new CompressionPlugin({})],
          },
        },
        plugins: [],
      },
      node: {
        tools: {
          /* bundlerChain(chain) {
            const externalsObj = nodeModules.reduce(
              (acc, mod) => {
                acc[mod] = 'commonjs ' + mod;
                return acc;
              },
              {} as Record<string, string>,
            );
            chain.externals(externalsObj);
          }, */
          rspack: {
            ignoreWarnings: [/Critical dependency: the request of a dependency is an expression/],
          },
        },
        resolve: {
          alias: {
            bufferutil: false,
            'utf-8-validate': false,
          },
        },
        source: {
          entry: { server: './src/server/index.ts' },
        },
        output: {
          target: 'node',
        },
      },
    },
    plugins: [
      pluginReact(),
      pluginMF({
        ...mfTypes,
        network: { requireServerIntegrity: true },
        loading: {
          manifestTimeoutMs: 2_000,
          moduleTimeoutMs: 6_000,
          typesTimeoutMs: 10_000,
          retries: 2,
          retryDelayMs: 100,
          circuitBreaker: { failureThreshold: 3, cooldownMs: 5_000 },
        },
        shared: [{ name: 'react', requiredVersion: '^19.2.8', singleton: true }, 'react-dom'],
      }),
    ],
  };

  if (env === 'development') {
    config.html = config.html || {};
    config.html.tags = [{ tag: 'script', attrs: { src: '/__shell_dev/js/hot-reload.js' } }];

    config.environments = config.environments || {};
    config.environments['hot'] = {
      source: {
        entry: {
          'hot-reload': { import: './src/utils/hot-reload', html: false },
        },
      },
      output: {
        distPath: { root: './dist/client' },
        sourceMap: false,
        filenameHash: false,
      },
    };

    // Настройка source maps для серверной сборки в dev режиме
    if (config.environments.node) {
      config.environments.node.output = {
        ...config.environments.node.output,
        sourceMap: true,
      };
    }
  }

  return config;
});
