import { useTranslation } from 'react-i18next';
import { MISSING_ASSETS } from '../../render/assetManifest';

/** Page Crédits : Kenney (CC0) et liste des assets remplacés par des formes Three.js. */
export function Credits() {
  const { t } = useTranslation();
  return (
    <div className="credits">
      <p>{t('credits.kenney')}</p>
      <p>
        <a href="https://kenney.nl" target="_blank" rel="noreferrer">
          kenney.nl
        </a>{' '}
        ·{' '}
        <a
          href="https://creativecommons.org/publicdomain/zero/1.0/"
          target="_blank"
          rel="noreferrer"
        >
          CC0 1.0
        </a>
      </p>
      <p>{t('credits.three')}</p>
      <h3>{t('credits.missing')}</h3>
      <ul>
        {MISSING_ASSETS.map((asset) => (
          <li key={asset.id}>{t(`credits.missingItems.${asset.id}`)}</li>
        ))}
      </ul>
    </div>
  );
}
