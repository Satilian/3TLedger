import cookieParser from 'cookie-parser';
import express from 'express';
import expressStaticGzip from 'express-static-gzip';
import { createServer } from 'http';
import { BaseRequest } from 'src/types';
import ssr from './ssr';
import { initWebSocket } from './websocket';

// Настройка обработки ошибок для dev режима
if (process.env.NODE_ENV === 'development') {
  // Включаем source maps для правильного отображения стек-трейсов
  import('source-map-support').then((mod) => mod.install());
}

// Обработка необработанных исключений
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  if (process.env.NODE_ENV === 'development') {
    console.error('Stack:', err.stack);
  }
});

// Обработка необработанных отклонений промисов
process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  if (process.env.NODE_ENV === 'development' && reason instanceof Error) {
    console.error('Stack:', reason.stack);
  }
});

const PORT = process.env.PORT || 3000;

const app = express();
const server = createServer(app);

initWebSocket(server);

async function initServer() {
  app.use('/static', expressStaticGzip(`${process.env.PUBLIC_STATIC}`, { orderPreference: ['gz'] }));
  app.use(express.json());
  app.use(cookieParser());
  app.get('*splat', ssr);

  // Глобальная обработка ошибок
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  app.use((err: Error, req: BaseRequest, res: express.Response, _: express.NextFunction) => {
    console.error('Server Error:', err);
    if (process.env.NODE_ENV === 'development') {
      res.status(500).json({
        error: err.message,
        stack: err.stack,
        path: req.path,
        method: req.method,
      });
    } else {
      res.status(500).json({ error: 'Internal Server Error' });
    }
  });

  server.listen(PORT, () => {
    console.info(`👂 [${new Date().toISOString()}]`, `🌎 http://localhost:${PORT}`);
  });
}

initServer();

export default app;
