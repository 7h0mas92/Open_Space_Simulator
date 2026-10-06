import { LOCALES } from '@oss/shared';
import { useTranslation } from 'react-i18next';
import { currentLocale } from '../../i18n';
import { useSession } from '../store/session';

/** Sélecteur de langue accessible (groupe de boutons à bascule). */
export function LanguageSwitcher() {
  const { t } = useTranslation();
  const changeLanguage = useSession((state) => state.changeLanguage);
  const active = currentLocale();

  return (
    <div className="language-switcher" role="group" aria-label={t('language.label')}>
      {LOCALES.map((locale) => (
        <button
          key={locale}
          type="button"
          lang={locale}
          aria-pressed={active === locale}
          onClick={() => void changeLanguage(locale)}
        >
          {t(`language.${locale}`)}
        </button>
      ))}
    </div>
  );
}
