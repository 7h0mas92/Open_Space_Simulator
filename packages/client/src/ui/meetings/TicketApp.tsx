import { useTranslation } from 'react-i18next';
import type { GameView } from '../../view/types';
import {
  TICKET_APP,
  TICKET_TYPE_COLORS,
  ticketBoard,
  type TicketCard,
  type TicketPerson,
} from '../../view/ticketBoard';
import { localized } from '../game/format';

/*
 * « Kanbanana », l'appli de tickets du bureau, en grand : la même chose que ce que le
 * projecteur affiche dans la salle de réunion pendant le Daily (`render/dailyBoard.ts`).
 * Lecture seule : on déplace et on confie les tickets dans le Kanban de la planification.
 */

const percent = (value: number) => Math.round(value * 100);

function Avatar({ who }: { who: TicketPerson | null }) {
  const { t } = useTranslation();
  return (
    <span
      className="ticket-avatar"
      style={{ background: who?.color ?? '#6b7385' }}
      title={who?.name ?? t('tickets.unassigned')}
      aria-label={who?.name ?? t('tickets.unassigned')}
    >
      {who?.initials ?? '?'}
    </span>
  );
}

function Ticket({ card }: { card: TicketCard }) {
  const { t, i18n } = useTranslation();
  return (
    <li
      className={`ticket ${card.daily ? 'is-discussed' : ''} ${card.kind === 'URGENT' ? 'is-urgent' : ''}`}
    >
      <p className="ticket-title">{localized(card.title, i18n.language)}</p>
      {card.column === 'DOING' && (
        <span
          className="ticket-progress"
          role="progressbar"
          aria-valuenow={percent(card.progress)}
          aria-valuemin={0}
          aria-valuemax={100}
          aria-label={t('tickets.progress')}
        >
          <span style={{ width: `${percent(card.progress)}%` }} />
        </span>
      )}
      <div className="ticket-meta">
        <span
          className="ticket-type"
          style={{ background: TICKET_TYPE_COLORS[card.type] }}
          title={t(`taskTypes.${card.type}`)}
          aria-label={t(`taskTypes.${card.type}`)}
        />
        <span className="ticket-key">{card.key}</span>
        {card.kind && <span className="ticket-flag">{t(`tickets.kinds.${card.kind}`)}</span>}
        <span className="ticket-points" title={t('tickets.points')}>
          {card.size}
        </span>
        <Avatar who={card.assignee} />
      </div>
    </li>
  );
}

export function TicketApp({ view }: { view: GameView }) {
  const { t, i18n } = useTranslation();
  const board = ticketBoard(view);
  const daily = board.daily;
  return (
    <div className="ticket-app" data-testid="ticket-app">
      <header className="ticket-app-bar">
        <span className="ticket-logo" aria-hidden="true">
          🍌
        </span>
        <strong>{TICKET_APP.name}</strong>
        <span className="ticket-app-project">
          {TICKET_APP.project} · {t('tickets.sprint', { sprint: board.sprint })}
        </span>
        <span className="ticket-app-points">
          {t('tickets.pointsDone', { done: board.donePoints, total: board.totalPoints })}
        </span>
      </header>
      <p className="hint">{t('tickets.intro')}</p>

      <section className="ticket-daily" aria-labelledby="ticket-daily-title">
        <h3 id="ticket-daily-title" className="group-heading">
          {t('tickets.dailyTitle')}
        </h3>
        {!daily ? (
          <p className="hint">{t('tickets.noDaily')}</p>
        ) : (
          <>
            <p className={daily.useful ? 'up' : 'down'}>
              {daily.useful
                ? daily.focus > 0
                  ? t('tickets.useful', { focus: daily.focus })
                  : t('tickets.usefulPast')
                : t('tickets.useless')}
              {!daily.today && ` ${t('tickets.notToday')}`}
            </p>
            <ul className="ticket-speakers">
              {daily.speakers.map((speaker) => {
                const ticket = speaker.ticket;
                const before = ticket?.daily?.before ?? null;
                const now = ticket?.daily?.progress ?? 0;
                return (
                  <li key={speaker.id}>
                    <Avatar who={speaker} />
                    <span className="ticket-speaker">
                      <span className="ticket-speaker-name">{speaker.name}</span>
                      {ticket ? (
                        <span className="ticket-speaker-point">
                          <span className="ticket-key">{ticket.key}</span>{' '}
                          {localized(ticket.title, i18n.language)} ·{' '}
                          {before === null
                            ? t('tickets.started', { now: percent(now) })
                            : t('tickets.moved', { before: percent(before), now: percent(now) })}
                        </span>
                      ) : (
                        <span className="ticket-speaker-point hint">{t('tickets.nothing')}</span>
                      )}
                    </span>
                  </li>
                );
              })}
            </ul>
          </>
        )}
        <p className="hint">{t('tickets.duplicates', { count: view.meetingRoom.duplicates })}</p>
      </section>

      <div className="ticket-columns">
        {board.columns.map((column) => (
          <section
            key={column.id}
            className="ticket-column"
            aria-label={t(`kanban.columns.${column.id}`)}
          >
            <h3>
              {t(`kanban.columns.${column.id}`)}{' '}
              <span className="ticket-count">{column.cards.length}</span>
            </h3>
            {column.cards.length === 0 ? (
              <p className="hint">{t('tickets.empty')}</p>
            ) : (
              <ul>
                {column.cards.map((card) => (
                  <Ticket key={card.id} card={card} />
                ))}
              </ul>
            )}
          </section>
        ))}
      </div>
      {board.backlog > 0 && (
        <p className="hint">{t('tickets.backlog', { count: board.backlog })}</p>
      )}
    </div>
  );
}
