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
    projects: [
      {
        extends: true,
        test: {
          name: 'ui',
          environment: 'jsdom',
          include: ['tests/unit/**/*.test.{ts,tsx}'],
          setupFiles: ['tests/unit/setup.ts'],
        },
      },
      {
        // La simulation est du TypeScript pur : ses tests tournent dans Node, sans DOM.
        extends: true,
        test: {
          name: 'simulation',
          environment: 'node',
          include: ['tests/simulation/**/*.test.ts'],
        },
      },
    ],
    coverage: {
      include: ['src/**/*.{ts,tsx}'],
      exclude: ['src/engine/simulation.worker.ts'],
      thresholds: {
        // Exigence du cahier des charges : couverture de la simulation > 80 %.
        'src/{simulation,events,engine}/**': {
          statements: 80,
          lines: 80,
          functions: 80,
          branches: 75,
        },
      },
    },
  },
});
