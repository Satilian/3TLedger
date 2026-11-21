import chokidar from 'chokidar';
import type { Server } from 'node:http';
import WebSocket, { WebSocketServer } from 'ws';

export function initWebSocket(server: Server) {
  const wss = new WebSocketServer({ server });
  const watcher = chokidar.watch('dist', { ignoreInitial: true });

  watcher.on('change', () => {
    for (const client of wss.clients) {
      if (client.readyState === WebSocket.OPEN) {
        client.send(JSON.stringify({ type: 'reload' }));
      }
    }
  });
  watcher.on('error', (error) => console.error('Dev watcher error:', error));
}
