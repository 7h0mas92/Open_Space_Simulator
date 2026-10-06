import { execSync } from 'node:child_process';
import { TEST_DATABASE_URL } from './test-database.js';

/** Applique les migrations sur la base de test (créée si besoin) avant toute la suite. */
export default function setup(): void {
  execSync('pnpm exec prisma migrate deploy', {
    stdio: 'inherit',
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
  });
}
