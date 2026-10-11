import { SERVER_ROOM_NEEDS } from '@oss/shared';
import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { catalogItem } from '../../view/catalog';
import type { FibrePlanView, GameView, ServerRoomView } from '../../view/types';
import { formatMoney, localized } from '../game/format';
import { useGame } from '../store/game';

/*
 * Panneau « Salle des serveurs » (ouvert depuis le rayon Serveurs du mode construction, ou en
 * sélectionnant une salle) : l'état de chaque salle (ce qui manque pour qu'elle tourne), les
 * économies d'hébergement, puis l'abonnement fibre payé chaque semaine.
 */

const NEED_ICONS = { server: '🗄️', network: '🔌', cooling: '❄️' } as const;

export function ServerRoom({ view }: { view: GameView }) {
  const { t } = useTranslation();
  const servers = view.servers;
  return (
    <div className="servers-panel">
      <p className="hint">{t('servers.intro')}</p>

      <section aria-labelledby="servers-rooms-title">
        <h3 id="servers-rooms-title" className="group-heading">
          {t('servers.roomsTitle')}
        </h3>
        {servers.rooms.length === 0 ? (
          <p className="hint" data-testid="servers-no-room">
            {t('servers.noRoom')}
          </p>
        ) : (
          <ul className="server-rooms">
            {servers.rooms.map((room) => (
              <li key={room.id}>
                <RoomCard room={room} />
              </li>
            ))}
          </ul>
        )}
        <p className="server-saving" data-testid="hosting-saving">
          {t('servers.saving', {
            percent: Math.round(servers.hostingSaving * 100),
            max: Math.round(servers.hostingSavingMax * 100),
          })}
        </p>
      </section>

      <Fibre view={view} />
    </div>
  );
}

function RoomCard({ room }: { room: ServerRoomView }) {
  const { t, i18n } = useTranslation();
  const def = catalogItem(room.kind);
  return (
    <article className="server-room-card" data-testid={`server-room-${room.id}`}>
      <h4>
        {def ? localized(def.name, i18n.language) : room.kind}{' '}
        <span className="hint">{t('servers.slots', { count: room.gear, max: room.slots })}</span>
      </h4>
      <p className={room.running ? 'server-state up' : 'server-state down'}>
        {room.running ? `✅ ${t('servers.running')}` : `🔥 ${t('servers.overheating')}`}
      </p>
      <ul className="server-needs">
        {SERVER_ROOM_NEEDS.map((need) => {
          const ok = !room.missing.includes(need);
          return (
            <li key={need} className={ok ? 'up' : 'down'}>
              <span aria-hidden="true">{ok ? '✅' : '⬜'} </span>
              <span aria-hidden="true">{NEED_ICONS[need]} </span>
              {t(`servers.needs.${need}`)}
              <span className="visually-hidden">
                {' '}
                : {ok ? t('servers.installed') : t('servers.toInstall')}
              </span>
            </li>
          );
        })}
      </ul>
    </article>
  );
}

function Fibre({ view }: { view: GameView }) {
  const { t, i18n } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const replay = useGame((s) => s.replayOf !== null);
  const [confirming, setConfirming] = useState(false);
  const { fibre, plans, hasBox } = view.servers;
  const current = fibre ? plans.find((plan) => plan.id === fibre.plan) : undefined;
  const money = (amount: number) => formatMoney(amount, i18n.language);

  return (
    <section className="fibre" aria-labelledby="fibre-title">
      <h3 id="fibre-title" className="group-heading">
        {t('servers.fibre.title')}
      </h3>
      <p className="hint">{t('servers.fibre.intro')}</p>
      {fibre && current ? (
        <div className="fibre-current" data-testid="fibre-current">
          <p>
            <strong>
              🌐 {localized(current.name, i18n.language)} ·{' '}
              {localized(current.speed, i18n.language)}
            </strong>
          </p>
          <p className={fibre.connected ? 'server-state up' : 'server-state down'}>
            {fibre.connected ? t('servers.fibre.connected') : t('servers.fibre.noBox')}
          </p>
          <p className="hint">
            {t('servers.fibre.nextBill', {
              price: money(fibre.weeklyPrice),
              count: Math.max(1, Math.ceil(fibre.nextBillDays)),
            })}{' '}
            · {t('servers.fibre.totalPaid', { price: money(fibre.totalPaid) })}
          </p>
          {confirming ? (
            <div className="fibre-actions">
              <p className="hint">{t('servers.fibre.cancelWarning')}</p>
              <button
                type="button"
                className="danger"
                onClick={() => {
                  setConfirming(false);
                  void dispatch({ type: 'cancelFibre' });
                }}
                data-testid="fibre-cancel-confirm"
              >
                {t('servers.fibre.cancelConfirm')}
              </button>
              <button type="button" onClick={() => setConfirming(false)}>
                {t('group.cancel')}
              </button>
            </div>
          ) : (
            <button
              type="button"
              disabled={replay || view.step === 'PITCH'}
              onClick={() => setConfirming(true)}
              data-testid="fibre-cancel"
            >
              ✂️ {t('servers.fibre.cancel')}
            </button>
          )}
        </div>
      ) : (
        <p className="hint" data-testid="fibre-none">
          {hasBox ? t('servers.fibre.none') : t('servers.fibre.needBox')}
        </p>
      )}
      <ul className="fibre-plans">
        {plans.map((plan) => (
          <li key={plan.id}>
            <PlanCard plan={plan} subscribed={fibre !== null} disabled={replay} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function PlanCard({
  plan,
  subscribed,
  disabled,
}: {
  plan: FibrePlanView;
  subscribed: boolean;
  disabled: boolean;
}) {
  const { t, i18n } = useTranslation();
  const dispatch = useGame((s) => s.dispatch);
  const price = formatMoney(plan.weeklyPrice, i18n.language);
  const reason =
    plan.blocker === null || plan.blocker === 'CURRENT'
      ? null
      : plan.blocker === 'LOCKED'
        ? t('build.locked', { phase: t(`phases.${plan.minPhase}`) })
        : plan.blocker === 'NO_BOX'
          ? t('servers.fibre.needBoxShort')
          : t(`results.${plan.blocker}`);
  const current = plan.blocker === 'CURRENT';
  return (
    <article
      className={`fibre-plan${current ? ' current' : ''}${plan.blocker === 'LOCKED' ? ' locked' : ''}`}
      data-testid={`fibre-plan-${plan.id}`}
    >
      <h4>
        {localized(plan.name, i18n.language)}{' '}
        <span className="fibre-speed">{localized(plan.speed, i18n.language)}</span>
      </h4>
      <p className="fibre-price">{t('servers.fibre.perWeek', { price })}</p>
      <p className="hint">{localized(plan.description, i18n.language)}</p>
      {current ? (
        <p className="server-state up">{t('servers.fibre.currentPlan')}</p>
      ) : (
        <button
          type="button"
          className="primary"
          disabled={disabled || plan.blocker !== null}
          onClick={() => void dispatch({ type: 'subscribeFibre', plan: plan.id })}
          data-testid={`fibre-subscribe-${plan.id}`}
        >
          {subscribed
            ? t('servers.fibre.switch', { price })
            : t('servers.fibre.subscribe', { price })}
        </button>
      )}
      {reason && <p className="hint">{reason}</p>}
    </article>
  );
}
