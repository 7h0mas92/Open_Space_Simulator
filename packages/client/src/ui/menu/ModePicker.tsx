import { GAME_MODES, type GameMode } from '@oss/shared';
import { useTranslation } from 'react-i18next';

const MODE_ICONS: Record<GameMode, string> = {
  EASY: '🐣',
  NORMAL: '🚀',
  HARDCORE: '🔥',
  INTERNS_ONLY: '🎒',
  SHIP_IN_3: '⏱️',
  DAILY: '📅',
};

/** Choix du mode de jeu : un bouton par mode, avec sa règle en une ligne. */
export function ModePicker({
  onPick,
  disabled,
}: {
  onPick: (mode: GameMode) => void;
  disabled: boolean;
}) {
  const { t } = useTranslation();
  return (
    <ul className="mode-list" aria-label={t('modes.title')}>
      {GAME_MODES.map((mode) => (
        <li key={mode}>
          <button
            type="button"
            className={`mode-button ${mode === 'NORMAL' ? 'primary' : ''}`}
            disabled={disabled}
            onClick={() => onPick(mode)}
            data-testid={`mode-${mode}`}
          >
            <span className="mode-icon" aria-hidden="true">
              {MODE_ICONS[mode]}
            </span>
            <span className="mode-text">
              <strong>{t(`modes.${mode}.name`)}</strong>
              <small>{t(`modes.${mode}.rule`)}</small>
            </span>
          </button>
        </li>
      ))}
    </ul>
  );
}
