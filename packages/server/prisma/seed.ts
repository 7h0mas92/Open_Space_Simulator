// Données initiales : les 100 cartes d'événements, le catalogue des succès et un compte
// administrateur. Le script est idempotent : le relancer ne crée pas de doublon et ne
// remplace pas les cartes modifiées depuis le back-office.
// Les objets du mode construction (catalogue FURNITURE_CATALOG de @oss/shared) font partie
// des règles du jeu : ils restent dans le code, pas en base, pour que le rejeu côté serveur
// utilise exactement les mêmes prix et effets que le client.
import 'dotenv/config';
import { AdminCardBodySchema, EVENT_CARDS } from '@oss/shared';
import { createPrismaClient } from '../src/lib/prisma.js';
import { syncAchievementCatalog } from '../src/services/achievement.service.js';
import { cardData, ensureBuiltinCardSet } from '../src/services/cards.service.js';
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

let created = 0;
for (const card of EVENT_CARDS) {
  const exists = await prisma.eventCard.findUnique({ where: { id: card.id } });
  if (exists) continue;
  await prisma.eventCard.create({
    data: { id: card.id, ...cardData(AdminCardBodySchema.parse(card)) },
  });
  created += 1;
}
console.log(
  `Cartes d'événements : ${created} créées, ${EVENT_CARDS.length - created} déjà présentes`,
);

await syncAchievementCatalog(prisma);
await ensureBuiltinCardSet(prisma);
console.log('Succès et cartes intégrées synchronisés');

await prisma.$disconnect();
