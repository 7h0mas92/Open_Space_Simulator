/// <reference types="vitest/config" />
import react from '@vitejs/plugin-react';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

// Chemin de publication : '/' par défaut (Vercel), '/Open_Space_Simulator/' sur GitHub Pages.
const base = process.env.BASE_PATH ?? '/';

export default defineConfig({
  base,
  plugins: [
    react(),
    // PWA : installable, et jouable hors ligne en invité. Tout le jeu (code, modèles Kenney,
    // icônes) est mis en cache à l'installation ; les cartes d'événements suivent le réseau
    // en priorité et retombent sur le cache (puis sur les 100 cartes intégrées au jeu).
    // Mise à jour : la nouvelle version attend que le joueur soit au menu pour s'appliquer
    // (`ui/appUpdate.ts`), au lieu de rester invisible jusqu'au rechargement suivant.
    VitePWA({
      registerType: 'prompt',
      injectRegister: false,
      includeAssets: ['favicon.svg', 'apple-touch-icon.png'],
      manifest: {
        name: 'Open Space Simulator 2026',
        short_name: 'Open Space',
        description:
          'Ta startup a levé 2 millions. Tu as 18 mois avant que tout explose. Bonne chance.',
        lang: 'fr',
        start_url: base,
        scope: base,
        display: 'standalone',
        orientation: 'any',
        background_color: '#1b1f2e',
        theme_color: '#1b1f2e',
        categories: ['games', 'entertainment'],
        icons: [
          { src: 'pwa-192.png', sizes: '192x192', type: 'image/png' },
          { src: 'pwa-512.png', sizes: '512x512', type: 'image/png' },
          { src: 'pwa-maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,svg,png,glb,gltf,ogg,mp3,woff2}'],
        // Les musiques (25 Mo) ne sont pas installées d'avance : elles sont lues en flux quand
        // on joue en ligne, et hors ligne le jeu reste jouable, simplement sans musique.
        globIgnores: ['**/assets/music/**'],
        // Le chunk Three.js et certains modèles dépassent la limite par défaut (2 Mo).
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        // Les routes de l'API ne doivent jamais recevoir index.html.
        navigateFallbackDenylist: [/^\/api\//, /^\/docs/],
        runtimeCaching: [
          {
            urlPattern: ({ url }) => url.pathname === '/api/events',
            handler: 'NetworkFirst',
            options: {
              cacheName: 'oss-events',
              networkTimeoutSeconds: 4,
              expiration: { maxEntries: 8 },
            },
          },
        ],
      },
    }),
  ],
  server: {
    port: 5173,
    // En développement, le client et l'API partagent la même origine grâce à ce proxy :
    // les cookies de session restent "first-party" (même principe que la réécriture Vercel en prod).
    proxy: {
      '/api': { target: process.env.VITE_API_PROXY_TARGET ?? 'http://localhost:3000' },
    },
  },
  preview: { port: 4173 },
  build: {
    // Three.js pèse à lui seul ~600 ko minifié ; il est isolé dans le chunk de l'écran de jeu,
    // chargé à la demande (le menu reste léger).
    chunkSizeWarningLimit: 900,
  },
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
          // Plusieurs tests jouent des parties complètes de 39 sprints, puis les rejouent.
          testTimeout: 20_000,
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
