// Donne le rôle ADMIN à un utilisateur existant.
// Usage : pnpm --filter @oss/server user:promote kevin@startup.io
import 'dotenv/config';
import { loadEnv } from '../config/env.js';
import { createPrismaClient } from '../lib/prisma.js';

const email = process.argv[2]?.toLowerCase();
if (!email) {
  console.error('Usage : pnpm user:promote <email>');
  process.exit(1);
}

const prisma = createPrismaClient(loadEnv().DATABASE_URL);
try {
  const user = await prisma.user.update({ where: { email }, data: { role: 'ADMIN' } });
  console.log(`${user.pseudo} (${email}) est maintenant ADMIN.`);
} catch {
  console.error(`Aucun utilisateur avec l'email ${email}.`);
  process.exitCode = 1;
} finally {
  await prisma.$disconnect();
}
