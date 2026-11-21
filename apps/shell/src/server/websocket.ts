/* eslint-disable @typescript-eslint/no-explicit-any */
import chokidar from 'chokidar';
import { Server } from 'http';
import WebSocket, { WebSocketServer } from 'ws';

export function initWebSocket(server: Server) {
  const clients = new Set<WebSocket>();
  const wss = new WebSocketServer({ server });
  const watcher = chokidar.watch('dist', { ignoreInitial: true, ignored: [/^.*not-found.html?/] });

  wss.on('connection', (ws: WebSocket) => {
    // console.log('Клиент подключился');
    clients.add(ws);

    ws.on('close', () => {
      clients.delete(ws);
      // console.log('Клиент отключился');
    });
  });

  watcher.on('change', (filePath: any) => {
    console.log(`📝 Файл изменён: ${filePath}`);
    for (const client of clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'reload' }));
      }
    }
  });
}
