import { ACHIEVEMENTS, getAchievement, type AchievementDto } from '@oss/shared';
import type { PrismaClient } from '../lib/prisma.js';

/**
 * Recopie le catalogue des succès (défini dans `@oss/shared`) dans la table Achievement.
 * Appelé au démarrage du serveur : la base suit toujours le code.
 */
export async function syncAchievementCatalog(prisma: PrismaClient): Promise<void> {
  await prisma.$transaction(
    ACHIEVEMENTS.map(({ id, title, description, icon }) =>
      prisma.achievement.upsert({
        where: { id },
        update: { title, description, icon },
        create: { id, title, description, icon },
      }),
    ),
  );
}

/**
 * Débloque des succès pour un joueur et renvoie ceux qui sont nouveaux.
 * Les identifiants inconnus du catalogue sont ignorés.
 */
export async function unlockForUser(
  prisma: PrismaClient,
  userId: string,
  ids: readonly string[],
): Promise<string[]> {
  const known = [...new Set(ids)].filter((id) => getAchievement(id) !== undefined);
  if (known.length === 0) return [];
  const existing = await prisma.userAchievement.findMany({
    where: { userId, achievementId: { in: known } },
    select: { achievementId: true },
  });
  const already = new Set(existing.map((row) => row.achievementId));
  const fresh = known.filter((id) => !already.has(id));
  await prisma.userAchievement.createMany({
    data: fresh.map((achievementId) => ({ userId, achievementId })),
    skipDuplicates: true,
  });
  return fresh;
}

/** Catalogue complet, avec la date de déblocage du joueur (s'il est connecté). */
export async function achievementsFor(
  prisma: PrismaClient,
  userId: string | null,
): Promise<AchievementDto[]> {
  const unlocked = userId ? await prisma.userAchievement.findMany({ where: { userId } }) : [];
  const dates = new Map(unlocked.map((row) => [row.achievementId, row.unlockedAt]));
  return ACHIEVEMENTS.map(({ id, title, description, icon, difficulty, secret = false }) => ({
    id,
    title,
    description,
    icon,
    difficulty,
    secret,
    unlockedAt: dates.get(id)?.toISOString() ?? null,
  }));
}
