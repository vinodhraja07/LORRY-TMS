import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

// Prevent noisy benign Vite HMR websocket disconnection toasts / unhandled rejections
if (typeof window !== 'undefined') {
  window.addEventListener('unhandledrejection', (event) => {
    if (
      event.reason &&
      typeof event.reason === 'string' &&
      event.reason.includes('WebSocket closed without opened')
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    } else if (
      event.reason instanceof Error &&
      event.reason.message &&
      event.reason.message.includes('WebSocket closed without opened')
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });

  window.addEventListener('error', (event) => {
    if (
      event.message &&
      typeof event.message === 'string' &&
      (event.message.includes('WebSocket closed without opened') ||
        event.message.includes('failed to connect to websocket'))
    ) {
      event.preventDefault();
      event.stopImmediatePropagation();
    }
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

