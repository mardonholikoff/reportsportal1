import tailwindcss from '@tailwindcss/vite';
import react from '@vitejs/plugin-react';
import path from 'path';
import {defineConfig} from 'vite';
import {VitePWA} from 'vite-plugin-pwa';

export default defineConfig(() => {
  return {
    plugins: [
      react(),
      tailwindcss(),
      VitePWA({
        registerType: 'autoUpdate',
        includeAssets: ['favicon.ico', 'apple-touch-icon.png', 'icon.svg'],
        manifest: {
          id: '/',
          name: 'Savdo va Mijozlar Nazorati PWA',
          short_name: 'SavdoNazorat',
          description: 'Mijozlar hisobi, berilgan mahsulotlar va qarz-haqdorlik nazorati tizimi.',
          theme_color: '#BE123C',
          background_color: '#FFF1F2',
          display: 'standalone',
          start_url: '/',
          scope: '/',
          icons: [
            {
              src: '/pwa-192x192.png',
              sizes: '192x192',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'any',
            },
            {
              src: '/pwa-maskable-512x512.png',
              sizes: '512x512',
              type: 'image/png',
              purpose: 'maskable',
            },
          ],
        },
        workbox: {
          globPatterns: ['**/*.{js,css,ico,png,svg,woff,woff2}'],
          maximumFileSizeToCacheInBytes: 10 * 1024 * 1024,
          cleanupOutdatedCaches: true,
          skipWaiting: true,
          clientsClaim: true,
          navigateFallback: null,
          navigateFallbackDenylist: [/^\/api\//],
          runtimeCaching: [
            {
              urlPattern: ({request}) => request.mode === 'navigate',
              handler: 'NetworkFirst',
              options: {
                cacheName: 'html-pages-cache',
                networkTimeoutSeconds: 4,
              },
            },
            {
              urlPattern: ({url}) => url.pathname.startsWith('/api/'),
              handler: 'NetworkOnly',
            },
          ],
        },
        devOptions: {
          enabled: false,
          type: 'module',
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(import.meta.dirname, '.'),
      },
    },
    server: {
      // HMR is disabled in AI Studio to prevent WebSocket connection errors in middleware mode.
      hmr: false,
      watch: null,
    },
  };
});

