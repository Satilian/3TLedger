/* eslint-disable @typescript-eslint/ban-ts-comment */
// @ts-nocheck
let interval: NodeJS.Timeout | null = null;
let timeout = 3000; // 3 seconds

const connect = () => {
  const protocol = location.protocol === 'https:' ? 'wss:' : 'ws:';
  const socket = new WebSocket(`${protocol}//${location.host}`);
  socket.onmessage = onmessage;
  socket.onopen = onopen;
  socket.onerror = onerror;
  socket.onclose = tryReconnect;
};

const onmessage = (event: MessageEvent) => {
  const msg = JSON.parse(event.data);
  if (msg.type === 'reload') {
    console.log('♻️ Перезагрузка...');
    location.reload();
  }
};

const onopen = () => {
  if (interval) {
    clearInterval(interval);
    timeout = 3000;
    location.reload();
  }
};

const onerror = () => {
  timeout = timeout + 2000;
  tryReconnect();
};

const tryReconnect = () => {
  if (interval) clearInterval(interval);

  interval = setTimeout(() => {
    console.warn('🔴 Соединение потеряно, попытка переподключения...');
    connect();
  }, timeout);
};

connect();
