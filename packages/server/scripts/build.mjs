// Build de production du serveur : un seul fichier dist/server.js (ESM).
// Les dépendances npm restent externes (installées sur Render) ; seuls notre code, le client
// Prisma généré et la simulation du client (`@oss/client/simulation`) sont empaquetés.
import { build } from 'esbuild';
import { readFile } from 'node:fs/promises';
import { URL } from 'node:url';

const pkg = JSON.parse(await readFile(new URL('../package.json', import.meta.url), 'utf8'));
const external = Object.keys(pkg.dependencies).filter((name) => name !== '@oss/client');

await build({
  entryPoints: ['src/server.ts'],
  outfile: 'dist/server.js',
  bundle: true,
  platform: 'node',
  target: 'node22',
  format: 'esm',
  sourcemap: true,
  external: [...external, '@prisma/client/*'],
  // Certaines dépendances CommonJS utilisent `require` : on le fournit au bundle ESM.
  banner: {
    js: "import { createRequire } from 'node:module'; const require = createRequire(import.meta.url);",
  },
  logLevel: 'info',
});
