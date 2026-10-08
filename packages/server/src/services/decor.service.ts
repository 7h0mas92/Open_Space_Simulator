import {
  DECOR_THEMES,
  DecorModeSchema,
  type DecorMode,
  type DecorTheme,
  type DecorThemeSetting,
} from '@oss/shared';
import type { PrismaClient } from '../generated/prisma/client.js';

/**
 * Tous les thèmes de décoration, dans l'ordre du jeu. Un thème absent de la base (ou dont la
 * valeur n'est plus reconnue) garde le réglage par défaut : décoré pendant sa période.
 */
export async function listDecorThemes(prisma: PrismaClient): Promise<DecorThemeSetting[]> {
  const rows = await prisma.decorTheme.findMany();
  const modes = new Map(rows.map((row) => [row.id, DecorModeSchema.safeParse(row.mode)]));
  return DECOR_THEMES.map((id) => {
    const parsed = modes.get(id);
    return { id, mode: parsed?.success ? parsed.data : 'SEASON' };
  });
}

/** Change le réglage d'un thème (la ligne est créée au premier changement). */
export async function setDecorTheme(
  prisma: PrismaClient,
  id: DecorTheme,
  mode: DecorMode,
): Promise<DecorThemeSetting> {
  await prisma.decorTheme.upsert({ where: { id }, create: { id, mode }, update: { mode } });
  return { id, mode };
}
