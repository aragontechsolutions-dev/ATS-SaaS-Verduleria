import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Sitio público. En dev proxya /api → :3000 (backend NestJS).
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
});
