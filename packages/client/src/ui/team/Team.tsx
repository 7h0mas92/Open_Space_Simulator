import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import type { DevView, GameView } from '../../view/types';
import { formatMoney } from '../game/format';
import { useGame } from '../store/game';
import { moodEmoji, StatBars } from './StatBars';

/** Liste de l'équipe, puis fiche détaillée du dev choisi (ou sélectionné dans la scène). */
export function Team({ view }: { view: GameView }) {
  const { t } = useTranslation();
  const selected = useGame((s) => s.selected);
  const select = useGame((s) => s.select);
  const selectedDev =
    selected?.type === 'dev' ? view.devs.find((dev) => dev.id === selected.id) : undefined;

  if (selectedDev) return <DevSheet dev={selectedDev} view={view} onBack={() => select(null)} />;
  if (view.devs.length === 0) return <p>{t('team.empty')}</p>;
  return (
    <ul className="team-list">
      {view.devs.map((dev) => (
        <li key={dev.id}>
          <button
            type="button"
            className="dev-row"
            onClick={() => select({ type: 'dev', id: dev.id })}
          >
            <span className="mood" aria-hidden="true">
              {moodEmoji(dev.morale)}
            </span>
            <span className="dev-row-main">
              <strong>{dev.name}</strong>
              <span>{t(`roles.${dev.role}`)}</span>
            </span>
            <span className="dev-row-activity">{t(`activities.${dev.activity}`)}</span>
          </button>
        </li>
      ))}
    </ul>
  );
}

function DevSheet({ dev, view, onBack }: { dev: DevView; view: GameView; onBack: () => void }) {
  const { t, i18n } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const notify = useGame((s) => s.notify);
  const [confirming, setConfirming] = useState(false);
  const colleagues = view.devs.filter((other) => other.id !== dev.id);

  return (
    <article className="dev-sheet" aria-labelledby={`dev-${dev.id}`}>
      <button type="button" onClick={onBack}>
        ← {t('team.back')}
      </button>
      <header>
        <h3 id={`dev-${dev.id}`}>
          {dev.name}, {t('team.age', { age: dev.age })}
        </h3>
        <p className="role">
          {t(`roles.${dev.role}`)} · {t('team.level', { level: dev.level })}
        </p>
        <p className="bio">
          {dev.name} {t(`bios.${dev.bio}` as never)}
        </p>
        <p className="hint">{t(`roleDescriptions.${dev.role}`)}</p>
      </header>
      <dl className="facts">
        <div>
          <dt>{t('team.activity')}</dt>
          <dd>{t(`activities.${dev.activity}`)}</dd>
        </div>
        <div>
          <dt>{t('team.trait')}</dt>
          <dd>{t(`traits.${dev.trait}` as never)}</dd>
        </div>
        <div>
          <dt>{t('team.mood')}</dt>
          <dd>
            {moodEmoji(dev.morale)} {Math.round(dev.morale)}/100
          </dd>
        </div>
        <div>
          <dt>{t('gauges.treasury.name')}</dt>
          <dd>{t('team.salary', { salary: formatMoney(dev.salary, i18n.language) })}</dd>
        </div>
      </dl>
      <StatBars stats={dev.stats} />
      {colleagues.length > 0 && (
        <section>
          <h4>{t('team.relations')}</h4>
          <ul className="relations">
            {colleagues.map((other) => {
              const value = dev.relations[other.id] ?? 0;
              const kind = value > 25 ? 'friend' : value < -25 ? 'enemy' : 'neutral';
              return (
                <li key={other.id} className={`relation ${kind}`}>
                  <span>{other.name}</span>
                  <span>
                    {t(`team.${kind}`)} ({value > 0 ? '+' : ''}
                    {value})
                  </span>
                </li>
              );
            })}
          </ul>
        </section>
      )}
      <section>
        <h4>{t('team.history')}</h4>
        <ul className="history">
          {dev.history.map((entry, index) => (
            <li key={index}>{t(`history.${entry}` as never)}</li>
          ))}
        </ul>
      </section>
      {confirming ? (
        <div
          className="confirm"
          role="alertdialog"
          aria-label={t('team.confirmFire', { name: dev.name })}
        >
          <p>{t('team.confirmFire', { name: dev.name })}</p>
          <button
            type="button"
            className="danger"
            onClick={() => {
              if (dispatch({ type: 'fire', devId: dev.id }).ok) {
                notify('results.fired', 'info', { name: dev.name });
                onBack();
              }
            }}
          >
            {t('team.confirm')}
          </button>
          <button type="button" onClick={() => setConfirming(false)}>
            {t('team.cancel')}
          </button>
        </div>
      ) : (
        <button type="button" className="danger" onClick={() => setConfirming(true)}>
          {t('team.fire')}
        </button>
      )}
    </article>
  );
}
