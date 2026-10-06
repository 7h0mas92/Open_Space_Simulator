import { z } from 'zod';

/** Langues supportées par le jeu. Le français est la langue par défaut. */
export const LOCALES = ['fr', 'en'] as const;
export const DEFAULT_LOCALE = 'fr' satisfies Locale;

export const LocaleSchema = z.enum(LOCALES);
export type Locale = z.infer<typeof LocaleSchema>;

/** Texte traduit dans toutes les langues (cartes d'événements, succès...). */
export const LocalizedTextSchema = z.object({
  fr: z.string().min(1),
  en: z.string().min(1),
});
export type LocalizedText = z.infer<typeof LocalizedTextSchema>;
