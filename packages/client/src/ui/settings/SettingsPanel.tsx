import { useTranslation } from 'react-i18next';
import { QUALITY_LEVELS } from '../../render/quality';
import { LanguageSwitcher } from '../components/LanguageSwitcher';
import { useGame } from '../store/game';
import { TEXT_SCALES, useSettings, VOLUME_KEYS } from '../store/settings';

/** Options : qualité graphique, audio, Slack IA, accessibilité, langue. */
export function SettingsPanel() {
  const { t } = useTranslation();
  const settings = useSettings();
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
          checked={settings.edgePan}
          onChange={(e) => settings.update({ edgePan: e.target.checked })}
        />
        {t('settings.edgePan')}
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
        <legend>{t('settings.audio')}</legend>
        {VOLUME_KEYS.map((key) => (
          <label key={key} className="slider">
            <span>{t(`settings.volumes.${key}`)}</span>
            <input
              type="range"
              min={0}
              max={100}
              step={5}
              value={Math.round(settings[key] * 100)}
              onChange={(e) => settings.update({ [key]: Number(e.target.value) / 100 })}
            />
            <output>{Math.round(settings[key] * 100)} %</output>
          </label>
        ))}
      </fieldset>
      <label className="switch">
        <input
          type="checkbox"
          checked={settings.slackAi}
          onChange={(e) => settings.update({ slackAi: e.target.checked })}
        />
        <span>
          {t('settings.slackAi')}
          <small>{t('settings.slackAiHint')}</small>
        </span>
      </label>
      <fieldset>
        <legend>{t('settings.language')}</legend>
        <LanguageSwitcher />
      </fieldset>
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
