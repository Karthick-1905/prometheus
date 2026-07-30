import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { VitePWA } from 'vite-plugin-pwa';

const offlineResponse = {
  configure: (proxy: { on: (event: string, handler: (...args: any[]) => void) => void }) => {
    proxy.on('error', (_error, _request, response) => {
      if (!('writeHead' in response) || response.headersSent) return;
      response.writeHead(502, { 'Content-Type': 'application/json' });
      response.end(
        JSON.stringify({
          detail: 'Cannot reach the backend API. Start FastAPI on port 8000 and try again.',
        }),
      );
    });
  },
};

export default defineConfig({
  plugins: [
    react(),
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: [
        'favicon.svg',
        'icons/favicon-32.png',
        'icons/apple-touch-icon.png',
        'icons/pwa-192x192.png',
        'icons/pwa-512x512.png',
        'icons/maskable-512x512.png',
      ],
      manifest: {
        id: '/',
        name: 'CAT Smart Rental',
        short_name: 'CAT Rental',
        description:
          'Caterpillar smart rental tracking — fleet, dealer, site, and operator workspaces. Install on your phone for app-like use.',
        theme_color: '#FFCD00',
        background_color: '#111111',
        display: 'standalone',
        display_override: ['standalone', 'minimal-ui', 'browser'],
        orientation: 'any',
        scope: '/',
        start_url: '/',
        lang: 'en',
        categories: ['business', 'productivity', 'utilities'],
        icons: [
          {
            src: 'icons/pwa-192x192.png',
            sizes: '192x192',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/pwa-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'any',
          },
          {
            src: 'icons/maskable-512x512.png',
            sizes: '512x512',
            type: 'image/png',
            purpose: 'maskable',
          },
        ],
        shortcuts: [
          {
            name: 'Fleet dashboard',
            short_name: 'Fleet',
            url: '/fleet/dashboard',
            icons: [{ src: 'icons/pwa-192x192.png', sizes: '192x192' }],
          },
          {
            name: 'Operator scan',
            short_name: 'Scan',
            url: '/operator/scan',
            icons: [{ src: 'icons/pwa-192x192.png', sizes: '192x192' }],
          },
        ],
      },
      workbox: {
        // App shell + static assets offline; API calls stay network-first.
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/api/, /^\/health/, /^\/docs/],
        globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2,webmanifest}'],
        runtimeCaching: [
          {
            urlPattern: ({ url }) =>
              url.pathname.startsWith('/api') || url.pathname.startsWith('/health'),
            handler: 'NetworkFirst',
            options: {
              cacheName: 'cat-api-cache',
              networkTimeoutSeconds: 8,
              expiration: {
                maxEntries: 64,
                maxAgeSeconds: 60 * 5,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
          {
            urlPattern: /^https:\/\/fonts\.(googleapis|gstatic)\.com\/.*/i,
            handler: 'CacheFirst',
            options: {
              cacheName: 'google-fonts',
              expiration: {
                maxEntries: 20,
                maxAgeSeconds: 60 * 60 * 24 * 365,
              },
              cacheableResponse: {
                statuses: [0, 200],
              },
            },
          },
        ],
      },
      devOptions: {
        // Keep PWA off in pure dev to avoid SW cache confusion while coding.
        enabled: false,
      },
    }),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        ...offlineResponse,
      },
      '/health': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        ...offlineResponse,
      },
      '/backend-root': {
        target: 'http://localhost:8000',
        changeOrigin: true,
        rewrite: () => '/',
        ...offlineResponse,
      },
    },
  },
});
