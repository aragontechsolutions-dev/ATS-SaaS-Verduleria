import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

// Panel de administración del tenant. En dev proxya /api → :3000.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5175,
    proxy: {
      '/api': { target: 'http://localhost:3000', changeOrigin: true },
    },
  },
});
