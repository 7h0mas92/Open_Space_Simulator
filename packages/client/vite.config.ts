/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';

export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    // En développement, le client et l'API partagent la même origine grâce à ce proxy :
    // les cookies de session restent "first-party" (même principe que la réécriture Vercel en prod).
    proxy: {
      '/api': { target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000' },
    },
  },
  preview: { port: 4173 },
  test: {
    environment: 'jsdom',
    include: ['tests/unit/**/*.test.{ts,tsx}'],
    setupFiles: ['tests/unit/setup.ts'],
    coverage: { include: ['src/**/*.{ts,tsx}'] },
  },
});
