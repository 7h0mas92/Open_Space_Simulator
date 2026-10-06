import { defineConfig } from 'vitest/config';
import { TEST_DATABASE_URL } from './tests/test-database.js';

export default defineConfig({
  test: {
    include: ['tests/**/*.test.ts'],
    globalSetup: ['tests/global-setup.ts'],
    env: { DATABASE_URL: TEST_DATABASE_URL },
    // Les tests partagent une base : on les exécute dans un seul processus, l'un après l'autre.
    fileParallelism: false,
    testTimeout: 15_000,
    hookTimeout: 30_000,
    coverage: {
      include: ['src/**/*.ts'],
      exclude: ['src/generated/**', 'src/server.ts', 'src/scripts/**'],
    },
  },
});
