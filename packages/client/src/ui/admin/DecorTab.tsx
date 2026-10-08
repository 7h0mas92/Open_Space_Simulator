import {
  DECOR_MODES,
  SEASONS,
  daysFromCivil,
  seasonsAt,
  type DecorMode,
  type DecorTheme,
  type DecorThemeSetting,
} from '@oss/shared';
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiRequestError } from '../../api/client';
import { metaApi } from '../../api/meta';
import { useDecorThemes } from '../../save/decor';
import { localized } from '../game/format';

type Message = { text: string; tone: 'error' | 'up' } | null;

/** Thèmes dont la période couvre la date réelle d'aujourd'hui. */
function seasonsToday(): DecorTheme[] {
  const now = new Date();
  return seasonsAt(
    daysFromCivil({ year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate() }),
  );
}

/** Aperçu 3D d'un coin de bureau décoré, rendu à la demande (Three.js chargé à ce moment-là). */
function DecorPreview({ theme, name }: { theme: DecorTheme; name: string }) {
  const { t } = useTranslation();
  const [image, setImage] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    import('../../render/decorPreview')
      .then(({ decorPreview }) => decorPreview(theme))
      .then(
        (url) => !cancelled && setImage(url),
        () => !cancelled && setImage(null),
      );
    return () => {
      cancelled = true;
    };
  }, [theme]);
  if (image === undefined) return <div className="admin-decor-preview" aria-busy="true" />;
  if (image === null) return null;
  return (
    <img
      className="admin-decor-preview"
      src={image}
      alt={t('admin.decor.previewAlt', { theme: name })}
    />
  );
}

/**
 * Décorations de saison : pour chaque thème (les mêmes que les packs de personnages, plus le
 * Nouvel An et la Saint-Valentin), désactivé, décoré pendant sa période, ou toujours décoré.
 */
export function DecorTab() {
  const { t, i18n } = useTranslation();
  const [themes, setThemes] = useState<DecorThemeSetting[] | null>(null);
  const [error, setError] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  const [today] = useState(seasonsToday);
  useEffect(() => {
    metaApi.admin.decorThemes().then(setThemes, () => setError(true));
  }, []);

  const change = async (id: DecorTheme, mode: DecorMode) => {
    const name = localized(SEASONS[id].name, i18n.language);
    try {
      const updated = await metaApi.admin.setDecorTheme(id, mode);
      setThemes((list) => list?.map((item) => (item.id === updated.id ? updated : item)) ?? null);
      setMessage({ text: t(`admin.decor.changed.${updated.mode}`, { theme: name }), tone: 'up' });
      // La partie en cours (même onglet) se redécore aussitôt.
      void useDecorThemes.getState().refresh();
    } catch (cause) {
      setMessage({
        text: cause instanceof ApiRequestError ? cause.message : t('leaderboard.error'),
        tone: 'error',
      });
    }
  };

  if (error)
    return (
      <p className="error" role="alert">
        {t('leaderboard.error')}
      </p>
    );
  if (!themes) return <p aria-live="polite">{t('auth.loading')}</p>;
  return (
    <div className="admin-packs">
      <p className="admin-packs-intro">{t('admin.decor.intro')}</p>
      {message && (
        <p className={message.tone} role="status">
          {message.text}
        </p>
      )}
      <ul className="admin-pack-list">
        {themes.map(({ id, mode }) => {
          const season = SEASONS[id];
          const name = localized(season.name, i18n.language);
          const live = mode === 'ALWAYS' || (mode === 'SEASON' && today.includes(id));
          return (
            <li key={id} className={`admin-card${mode === 'OFF' ? ' inactive' : ''}`}>
              <div className="admin-card-head">
                <h3>{name}</h3>
                <span className={`admin-state ${live ? 'on' : 'off'}`}>
                  {t(live ? 'admin.decor.live' : `admin.decor.state.${mode}`)}
                </span>
              </div>
              <p className="admin-card-desc">{localized(season.reason, i18n.language)}</p>
              <DecorPreview theme={id} name={name} />
              <fieldset className="admin-decor-modes">
                <legend className="visually-hidden">
                  {t('admin.decor.legend', { theme: name })}
                </legend>
                {DECOR_MODES.map((option) => (
                  <label key={option} className={option === mode ? 'selected' : undefined}>
                    <input
                      type="radio"
                      name={`decor-${id}`}
                      value={option}
                      checked={option === mode}
                      onChange={() => void change(id, option)}
                      data-testid={`decor-${id}-${option}`}
                    />
                    {t(`admin.decor.mode.${option}`)}
                  </label>
                ))}
              </fieldset>
            </li>
          );
        })}
      </ul>
    </div>
  );
}
