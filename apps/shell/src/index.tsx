import App from './pages';
import { createRoot, hydrateRoot } from 'react-dom/client';

import './index.css';

function bootstrap() {
  const rootEl = document.getElementById('root');
  if (rootEl) {
    if (!rootEl.innerHTML.trim()) createRoot(rootEl).render(<App />);
    else hydrateRoot(rootEl, <App />);
  }
}

bootstrap();

if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  void navigator.serviceWorker.register('/pwa/sw.js', { scope: '/' }).catch((error: unknown) => {
    console.error('Could not register the service worker:', error);
  });
}
