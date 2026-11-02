import { SERVER_ROOM_NEEDS } from '@oss/shared';
import { useTranslation } from 'react-i18next';
import { catalogItem } from '../../view/catalog';
import type { GameView, ServerRoomView } from '../../view/types';
import { localized } from '../game/format';
import { useGame } from '../store/game';
import { ServiceSubscription } from '../subscriptions/Subscriptions';

/*
 * Panneau « Salle des serveurs » (ouvert depuis le rayon Serveurs du mode construction, ou en
 * sélectionnant une salle) : l'état de chaque salle (ce qui manque pour qu'elle tourne), les
 * économies d'hébergement, puis l'abonnement internet (le même que dans la rubrique Abonnements).
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
