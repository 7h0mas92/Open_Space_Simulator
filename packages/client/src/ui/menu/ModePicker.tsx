import { MENU_MODES, type GameMode } from '@oss/shared';
import { useTranslation } from 'react-i18next';

export const MODE_ICONS: Record<GameMode, string> = {
  EASY: '🐣',
  NORMAL: '🚀',
  HARDCORE: '🔥',
  INTERNS_ONLY: '🎒',
  SHIP_IN_3: '⏱️',
  DAILY: '📅',
  CAREER: '🧭',
  STORY: '📖',
};

/**
 * Choix du mode de jeu : une carte par mode, avec son étiquette et sa règle en une ligne. Le
 * mode Histoire a sa propre carte, qui ouvre l'écran des chapitres.
 */
export function ModePicker({
  onPick,
  disabled,
}: {
  onPick: (mode: GameMode) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  return (
    <ul className="mode-grid" aria-label={t('modes.title')}>
      {MENU_MODES.map((mode) => (
        <li key={mode}>
          <button
            type="button"
            className={`mode-card mode-${mode.toLowerCase()}`}
            disabled={disabled}
            onClick={() => onPick(mode)}
            data-testid={`mode-${mode}`}
          >
            <span className="mode-icon" aria-hidden="true">
              {MODE_ICONS[mode]}
            </span>
            <span className="mode-text">
              <span className="mode-name">
                <strong>{t(`modes.${mode}.name`)}</strong>
                <span className="mode-tag">{t(`modes.${mode}.tag`)}</span>
              </span>
              <small>{t(`modes.${mode}.rule`)}</small>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
