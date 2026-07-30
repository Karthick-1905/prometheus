import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

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
  plugins: [react()],
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
