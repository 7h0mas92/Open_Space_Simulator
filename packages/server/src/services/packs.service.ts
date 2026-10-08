import {
  CHARACTER_PACKS,
  DEFAULT_ENABLED_PACKS,
  type CharacterPack,
  type CharacterPackId,
} from '@oss/shared';
import type { PrismaClient } from '../generated/prisma/client.js';

/**
 * Tous les packs de personnages, dans l'ordre du jeu. Un pack absent de la base garde son état
 * par défaut : « Base » actif, les packs à thème désactivés.
 */
export async function listCharacterPacks(prisma: PrismaClient): Promise<CharacterPack[]> {
  const rows = await prisma.characterPack.findMany();
  const enabled = new Map(rows.map((row) => [row.id, row.enabled]));
  return CHARACTER_PACKS.map((id) => ({
    id,
    enabled: enabled.get(id) ?? DEFAULT_ENABLED_PACKS.includes(id),
  }));
}

/** Active ou désactive un pack (la ligne est créée au premier changement). */
export async function setCharacterPack(
  prisma: PrismaClient,
  id: CharacterPackId,
  enabled: boolean,
): Promise<CharacterPack> {
  const row = await prisma.characterPack.upsert({
    where: { id },
    create: { id, enabled },
    update: { enabled },
  });
  return { id, enabled: row.enabled };
}
