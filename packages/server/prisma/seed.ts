// Données initiales. Les 100 cartes, les succès et les objets seront ajoutés
// par les étapes suivantes. Pour l'instant : un compte administrateur de développement.
import 'dotenv/config';
import { createPrismaClient } from '../src/lib/prisma.js';
import { hashPassword } from '../src/services/password.service.js';

const databaseUrl = process.env.DATABASE_URL;
if (!databaseUrl) throw new Error('DATABASE_URL manquant');

const prisma = createPrismaClient(databaseUrl);

const email = process.env.SEED_ADMIN_EMAIL ?? 'admin@oss.local';
const password = process.env.SEED_ADMIN_PASSWORD;
if (!password && process.env.NODE_ENV === 'production') {
  throw new Error('SEED_ADMIN_PASSWORD est obligatoire en production');
}

const admin = await prisma.user.upsert({
  where: { email },
  update: { role: 'ADMIN' },
  create: {
    email,
    pseudo: 'admin',
    role: 'ADMIN',
    passwordHash: await hashPassword(password ?? 'admin-dev-password'),
  },
});
console.log(`Administrateur prêt : ${admin.email}`);

await prisma.$disconnect();
