import cookieParser from 'cookie-parser';
import express from 'express';
import expressStaticGzip from 'express-static-gzip';
import { createServer } from 'node:http';
import { resolve } from 'node:path';
import ssr from './ssr';
import { initWebSocket } from './websocket';

const isDev = process.env.NODE_ENV === 'development';
const port = Number(process.env.PORT ?? 3000);
const app = express();
const server = createServer(app);

if (isDev) {
  void import('source-map-support')
    .then((mod) => mod.install())
    .catch((error) => console.error('Could not enable source maps:', error));
  app.use('/__shell_dev', express.static('dist/client/static'));
  app.get('/api/v1/auth/start', (_req, res) => {
    res.set('Cache-Control', 'no-store').redirect(302, 'https://localhost:3443/api/v1/auth/start');
  });
  initWebSocket(server);
}

app.use('/static', expressStaticGzip(process.env.PUBLIC_STATIC || 'dist/static', { orderPreference: ['gz'] }));
const pwaDirectory = resolve('dist/pwa');
const serviceWorkerPath = resolve(pwaDirectory, 'sw.js');
app.use(
  '/pwa',
  express.static(pwaDirectory, {
    setHeaders(res, filePath) {
      if (filePath === serviceWorkerPath) res.setHeader('Service-Worker-Allowed', '/');
    },
  }),
  (_req, res) => {
    res.sendStatus(404);
  },
);
app.use(cookieParser());
app.use(ssr);

const handleError: express.ErrorRequestHandler = (error: unknown, _req, res, next) => {
  console.error('Server error:', error);
  if (res.headersSent) {
    next(error);
    return;
  }
  const message = isDev && error instanceof Error ? error.message : 'Internal Server Error';
  res.status(500).set('Cache-Control', 'no-store').json({ error: message });
};

app.use(handleError);

server.listen(port, () => {
  const address = server.address();
  if (address && typeof address === 'object') {
    console.info(`Shell listening on http://localhost:${address.port}`);
  }
});

export default app;
