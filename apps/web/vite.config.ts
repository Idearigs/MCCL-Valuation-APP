import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: 'localhost',
    port: 5174,
    // Same-origin in dev too, so session cookies behave exactly like production.
    // changeOrigin: false keeps the Host header, as Coolify's proxy does in production.
    proxy: { '/api': { target: 'http://localhost:5000', changeOrigin: false } },
  },
  build: { outDir: 'dist' },
});
