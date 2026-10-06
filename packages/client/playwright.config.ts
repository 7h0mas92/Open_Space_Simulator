import { defineConfig, devices } from '@playwright/test';

/**
 * Tests end-to-end sur la vraie pile : serveur Fastify + PostgreSQL + client buildé.
 * Viewports imposés par le cahier des charges : 375, 768, 1024 et 1440 px,
 * en portrait et en paysage.
 */
const DATABASE_URL = process.env.E2E_DATABASE_URL ?? 'postgresql://oss:oss@localhost:5432/oss_e2e';

const chromium = devices['Desktop Chrome'];
const touch = { isMobile: true, hasTouch: true };

export default defineConfig({
  testDir: 'tests/e2e',
  fullyParallel: true,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? [['github'], ['html', { open: 'never' }]] : 'list',
  use: {
    baseURL: 'http://localhost:4173',
    trace: 'retain-on-failure',
    // Le service worker de la PWA est testé à part (pwa.spec.ts) : ailleurs il est bloqué pour
    // que chaque test parte d'un état propre.
    serviceWorkers: 'block',
    // WebGL logiciel (SwiftShader) : la scène Three.js s'affiche aussi sur les runners sans GPU.
    launchOptions: { args: ['--use-angle=swiftshader', '--enable-unsafe-swiftshader'] },
  },
  projects: [
    {
      name: 'mobile-portrait-375',
      use: { ...chromium, ...touch, viewport: { width: 375, height: 812 } },
    },
    {
      name: 'mobile-landscape-812',
      use: { ...chromium, ...touch, viewport: { width: 812, height: 375 } },
    },
    {
      name: 'tablet-portrait-768',
      use: { ...chromium, ...touch, viewport: { width: 768, height: 1024 } },
    },
    {
      name: 'tablet-landscape-1024',
      use: { ...chromium, ...touch, viewport: { width: 1024, height: 768 } },
    },
    { name: 'desktop-1440', use: { ...chromium, viewport: { width: 1440, height: 900 } } },
  ],
  webServer: [
    {
      command:
        'pnpm --filter @oss/server db:deploy && pnpm --filter @oss/server exec tsx src/server.ts',
      url: 'http://localhost:3000/api/health',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      env: {
        NODE_ENV: 'test',
        LOG_LEVEL: 'warn',
        PORT: '3000',
        DATABASE_URL,
        JWT_SECRET: 'e2e-secret-e2e-secret-e2e-secret-e2e',
        CLIENT_URL: 'http://localhost:4173',
        AUTH_RATE_LIMIT_MAX: '1000',
        RATE_LIMIT_MAX: '10000',
      },
    },
    {
      command: 'pnpm build && pnpm preview --strictPort',
      url: 'http://localhost:4173',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
    },
  ],
});
