import { DEFAULT_LOCALE, LOCALES, LocaleSchema, type Locale } from '@oss/shared';
import i18n from 'i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import { initReactI18next } from 'react-i18next';
import en from './en.json';
import fr from './fr.json';

/** Le français sert de référence : toutes les langues ont la même structure de clés. */
export const resources = {
  fr: { translation: fr },
  en: { translation: en },
} as const satisfies Record<Locale, { translation: typeof fr }>;

declare module 'i18next' {
  interface CustomTypeOptions {
    defaultNS: 'translation';
    resources: (typeof resources)['fr'];
  }
}

export const LANGUAGE_STORAGE_KEY = 'oss.language';

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources,
    fallbackLng: DEFAULT_LOCALE,
    supportedLngs: [...LOCALES],
    nonExplicitSupportedLngs: true,
    interpolation: { escapeValue: false }, // React échappe déjà le HTML.
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: LANGUAGE_STORAGE_KEY,
      caches: ['localStorage'],
    },
  });

// Garde l'attribut `lang` du document synchronisé (lecteurs d'écran, césure).
const syncHtmlLang = (lng: string) => document.documentElement.setAttribute('lang', lng);
syncHtmlLang(i18n.resolvedLanguage ?? DEFAULT_LOCALE);
i18n.on('languageChanged', syncHtmlLang);

/** Langue courante, ramenée à une langue supportée. */
export function currentLocale(): Locale {
  const parsed = LocaleSchema.safeParse(i18n.resolvedLanguage);
  return parsed.success ? parsed.data : DEFAULT_LOCALE;
}

export default i18n;
