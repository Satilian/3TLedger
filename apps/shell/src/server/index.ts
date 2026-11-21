import cookieParser from 'cookie-parser';
import express from 'express';
import expressStaticGzip from 'express-static-gzip';
import { createServer } from 'node:http';
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
  initWebSocket(server);
}

app.use('/static', expressStaticGzip(process.env.PUBLIC_STATIC || 'dist/static', { orderPreference: ['gz'] }));
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
    console.info(`Listening on http://localhost:${address.port}`);
  }
});

export default app;
