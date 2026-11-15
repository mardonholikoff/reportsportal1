import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import { ErrorBoundary } from './components/ErrorBoundary';
import './index.css';

if (typeof window !== 'undefined' && 'caches' in window) {
  caches
    .keys()
    .then((names) => {
      for (const name of names) {
        if (name.includes('workbox') || name.includes('html-pages-cache')) {
          caches.delete(name).catch(() => {});
        }
      }
    })
    .catch(() => {});
}

if (typeof window !== 'undefined' && 'serviceWorker' in navigator) {
  let refreshing = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (refreshing) return;
    try {
      const lastReload = Number(sessionStorage.getItem('sw_reloaded_ts') || '0');
      if (Date.now() - lastReload < 15000) return;
      sessionStorage.setItem('sw_reloaded_ts', String(Date.now()));
    } catch {
      // ignore sessionStorage errors
    }
    refreshing = true;
    window.location.reload();
  });

  navigator.serviceWorker
    .getRegistrations()
    .then(async (registrations) => {
      for (const reg of registrations) {
        try {
          await reg.update();
          const unregistered = await reg.unregister();
          if (unregistered && navigator.serviceWorker.controller) {
            const lastReload = Number(sessionStorage.getItem('sw_reloaded_ts') || '0');
            if (Date.now() - lastReload >= 15000) {
              sessionStorage.setItem('sw_reloaded_ts', String(Date.now()));
              window.location.reload();
              return;
            }
          }
        } catch {
          // ignore sw cleanup errors
        }
      }
    })
    .catch(() => {});
}

createRoot(document.getElementById('root')!).render(
  <ErrorBoundary>
    <App />
  </ErrorBoundary>
);

