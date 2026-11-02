import { SERVER_ROOM_NEEDS } from '@oss/shared';
import { useTranslation } from 'react-i18next';
import { catalogItem } from '../../view/catalog';
import type { GameView, ServerRoomView } from '../../view/types';
import { localized } from '../game/format';
import { useGame } from '../store/game';
import { ServiceSubscription } from '../subscriptions/Subscriptions';

/*
 * Panneau « Salle des serveurs » (ouvert depuis le rayon Serveurs du mode construction, ou en
 * sélectionnant une salle) : l'état de chaque salle (ce qui manque pour qu'elle tourne, sa
 * température face à la clim), les économies d'hébergement, puis l'abonnement internet (le
 * même que dans la rubrique Abonnements), de la box 4G à la fibre dédiée.
 */

const NEED_ICONS = { server: '🗄️', network: '🔌', cooling: '❄️' } as const;

export function ServerRoom({ view }: { view: GameView }) {
  const { t } = useTranslation();
  const openPanel = useGame((s) => s.openPanel);
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
                <RoomCard room={room} summer={servers.summer} />
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

      <ServiceSubscription view={view} service="internet" />
      <button
        type="button"
        onClick={() => openPanel('subscriptions')}
        data-testid="servers-open-subscriptions"
      >
        🧾 {t('subscriptions.manageAll')}
      </button>
    </div>
  );
}

function RoomCard({ room, summer }: { room: ServerRoomView; summer: boolean }) {
  const { t, i18n } = useTranslation();
  const def = catalogItem(room.kind);
  const kw = (value: number) => value.toLocaleString(i18n.language, { maximumFractionDigits: 1 });
  const ready = room.missing.length === 0;
  const state = !ready
    ? 'missing'
    : room.level === 'overheat'
      ? 'overheat'
      : room.level === 'warm'
        ? 'warm'
        : 'running';
  // Charge thermique : chaleur sur froid, affichée jusqu'à 150 %.
  const load = room.cooling > 0 ? room.heat / room.cooling : room.heat > 0 ? 1.5 : 0;
  return (
    <article className="server-room-card" data-testid={`server-room-${room.id}`}>
      <h4>
        {def ? localized(def.name, i18n.language) : room.kind}{' '}
        <span className="hint">{t('servers.slots', { count: room.gear, max: room.slots })}</span>
      </h4>
      <p
        className={state === 'running' ? 'server-state up' : 'server-state down'}
        data-testid="server-room-state"
      >
        {state === 'running'
          ? `✅ ${t('servers.running')}`
          : state === 'warm'
            ? `🌡️ ${t('servers.warm', { percent: Math.round(room.efficiency * 100) })}`
            : state === 'overheat'
              ? `🔥 ${t('servers.overheat')}`
              : `⬜ ${t('servers.overheating')}`}
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
      <div className="server-heat" data-testid="server-heat">
        <p>
          {t('servers.heat.load', { heat: kw(room.heat), cooling: kw(room.cooling) })}
          {summer && <span className="server-summer"> · ☀️ {t('servers.heat.summer')}</span>}
        </p>
        <div
          className={`server-heat-bar ${room.level}`}
          role="meter"
          aria-label={t('servers.heat.meter')}
          aria-valuemin={0}
          aria-valuemax={150}
          aria-valuenow={Math.round(Math.min(1.5, load) * 100)}
        >
          <span style={{ width: `${(Math.min(1.5, load) / 1.5) * 100}%` }} />
        </div>
        <p className={room.monitored ? `server-temp ${room.level}` : 'hint'}>
          {room.monitored
            ? t('servers.heat.temperature', {
                temp: Math.round(room.temperature),
                level: t(`servers.heat.levels.${room.level}`),
              })
            : t('servers.heat.unmonitored')}
        </p>
      </div>
    </article>
  );
}
