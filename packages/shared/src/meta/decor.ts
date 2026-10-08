import { z } from 'zod';
import { DecorModeSchema, DecorThemeSchema } from '../sim/calendar.js';

/**
 * Décorations de saison réglées depuis le back-office, sur le modèle des packs de personnages
 * (mêmes thèmes : Noël, Halloween, Pâques…). Chaque thème est désactivé, décoré pendant sa
 * période (réglage par défaut) ou décoré en permanence.
 */
export const DecorThemeSettingSchema = z.object({
  id: DecorThemeSchema,
  mode: DecorModeSchema,
});
export type DecorThemeSetting = z.infer<typeof DecorThemeSettingSchema>;

/** Tous les thèmes, dans l'ordre de `DECOR_THEMES`, avec leur réglage. */
export const DecorThemesResponseSchema = z.object({ themes: z.array(DecorThemeSettingSchema) });
export type DecorThemesResponse = z.infer<typeof DecorThemesResponseSchema>;

export const UpdateDecorThemeBodySchema = z.object({ mode: DecorModeSchema });
export type UpdateDecorThemeBody = z.infer<typeof UpdateDecorThemeBodySchema>;
