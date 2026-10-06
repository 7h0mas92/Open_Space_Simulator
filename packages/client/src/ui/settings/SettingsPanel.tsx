import { PHASES, type Phase } from '@oss/shared';
import { useTranslation } from 'react-i18next';
import { QUALITY_LEVELS } from '../../render/quality';
import { MockGame } from '../../view/mock';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useGame } from '../store/game';
import { TEXT_SCALES, useSettings } from '../store/settings';

/** Options : qualité graphique, accessibilité, langue, et outils de démonstration. */
export function SettingsPanel() {
  const { t } = useTranslation();
  const settings = useSettings();
  const source = useGame((s) => s.source);
  const view = useGame((s) => s.view);
  const quit = useGame((s) => s.quit);
  const openPanel = useGame((s) => s.openPanel);

  return (
    <div className="settings">
      <fieldset>
        <legend>{t('settings.quality')}</legend>
        <div className="segmented">
          {QUALITY_LEVELS.map((level) => (
            <button
              key={level}
              type="button"
              aria-pressed={settings.quality === level}
              onClick={() => settings.update({ quality: level })}
            >
              {t(`settings.qualities.${level}`)}
            </button>
          ))}
        </div>
      </fieldset>
      <fieldset>
        <legend>{t('settings.textSize')}</legend>
        <div className="segmented">
          {TEXT_SCALES.map((scale) => (
            <button
              key={scale}
              type="button"
              aria-pressed={settings.textScale === scale}
              onClick={() => settings.update({ textScale: scale })}
              style={{ fontSize: `${scale}em` }}
            >
              A
            </button>
          ))}
        </div>
      </fieldset>
      <label className="switch">
        <input
          type="checkbox"
          checked={settings.reducedMotion}
          onChange={(e) => settings.update({ reducedMotion: e.target.checked })}
        />
        {t('settings.reducedMotion')}
      </label>
      <label className="switch">
        <input
          type="checkbox"
          checked={settings.showFps}
          onChange={(e) => settings.update({ showFps: e.target.checked })}
        />
        {t('settings.showFps')}
      </label>
      <fieldset>
        <legend>{t('settings.language')}</legend>
        <LanguageSwitcher />
      </fieldset>
      {source instanceof MockGame && view && (
        <label>
          {t('settings.demoPhase')}
          <select
            value={view.phase}
            onChange={(event) => {
              source.setPhase(event.target.value as Phase);
              useGame.setState({ view: source.view, selected: null });
            }}
          >
            {PHASES.filter((phase) => phase !== 'END').map((phase) => (
              <option key={phase} value={phase}>
                {t(`phases.${phase}`)}
              </option>
            ))}
          </select>
        </label>
      )}
      <button
        type="button"
        onClick={() => {
          settings.update({ tutorialDone: false });
          openPanel(null);
        }}
      >
        {t('settings.tutorial')}
      </button>
      <button type="button" onClick={() => openPanel('credits')}>
        {t('panels.credits')}
      </button>
      <button type="button" className="danger" onClick={quit}>
        {t('settings.quit')}
      </button>
    </div>
  );
}
