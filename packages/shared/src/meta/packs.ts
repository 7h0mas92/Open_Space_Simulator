import { z } from 'zod';

/**
 * Packs de personnages thématiques : des costumes portés par toute l'équipe (bonnets de
 * Noël, citrouilles, oreilles de lapin, capes de super-héros, casques d'astronaute…). Un administrateur les active
 * ou les désactive depuis le back-office ; seul « Base » est actif au départ.
 */
export const CHARACTER_PACKS = [
  'BASE',
  'CHRISTMAS',
  'HALLOWEEN',
  'EASTER',
  'SUPERHEROES',
  'SUMMER',
  'SPACE',
  'PIRATES',
  'MEDIEVAL',
  'RETRO_80S',
  'CYBERPUNK',
] as const;
export const CharacterPackIdSchema = z.enum(CHARACTER_PACKS);
export type CharacterPackId = z.infer<typeof CharacterPackIdSchema>;
/** Les packs à thème (tous sauf « Base », les looks habituels sans costume). */
export type ThemedPackId = Exclude<CharacterPackId, 'BASE'>;

/**
 * « Base » (les looks habituels) est le seul pack actif au départ. Il se mélange aux packs à
 * thème : avec Base et Noël actifs, la moitié de l'équipe est en costume.
 */
export const DEFAULT_ENABLED_PACKS: readonly CharacterPackId[] = ['BASE'];

export const CharacterPackSchema = z.object({
  id: CharacterPackIdSchema,
  enabled: z.boolean(),
});
export type CharacterPack = z.infer<typeof CharacterPackSchema>;

/** Tous les packs, dans l'ordre de `CHARACTER_PACKS`, avec leur état. */
export const CharacterPacksResponseSchema = z.object({ packs: z.array(CharacterPackSchema) });
export type CharacterPacksResponse = z.infer<typeof CharacterPacksResponseSchema>;

export const UpdateCharacterPackBodySchema = z.object({ enabled: z.boolean() });
export type UpdateCharacterPackBody = z.infer<typeof UpdateCharacterPackBodySchema>;
