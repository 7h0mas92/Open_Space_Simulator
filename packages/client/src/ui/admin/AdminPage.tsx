import type { AdminCard, AdminStatsResponse, EventCard } from '@oss/shared';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiRequestError } from '../../api/client';
import { metaApi } from '../../api/meta';
import { localized } from '../game/format';
import { CardEditor, editableCard, NEW_CARD } from './CardEditor';

type Editing = { card: EventCard; active: boolean; isNew: boolean } | null;

/** Liste des cartes : recherche, état, édition et désactivation. */
function CardsTab() {
  const { t, i18n } = useTranslation();
  const [cards, setCards] = useState<AdminCard[] | null>(null);
  const [query, setQuery] = useState('');
  const [editing, setEditing] = useState<Editing>(null);
  const [message, setMessage] = useState<{ text: string; tone: 'error' | 'up' } | null>(null);

  // Incrémenté après chaque modification pour relire la liste.
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);

  useEffect(() => {
    let cancelled = false;
    metaApi.admin.cards().then(
      (list) => !cancelled && setCards(list),
      () => !cancelled && setMessage({ text: t('leaderboard.error'), tone: 'error' }),
    );
    return () => {
      cancelled = true;
    };
  }, [t, version]);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!cards || !needle) return cards ?? [];
    return cards.filter(
      (card) =>
        card.id.includes(needle) ||
        card.title.fr.toLowerCase().includes(needle) ||
        card.title.en.toLowerCase().includes(needle),
    );
  }, [cards, query]);

  const failure = (error: unknown) =>
    setMessage({
      text: t(`errors.${error instanceof ApiRequestError ? error.code : 'INTERNAL_ERROR'}`),
      tone: 'error',
    });

  async function save(card: EventCard, active: boolean) {
    try {
      const body = { ...card, active };
      await (editing?.isNew ? metaApi.admin.create(body) : metaApi.admin.update(body));
      setEditing(null);
      setMessage({ text: t('admin.saved'), tone: 'up' });
      refresh();
    } catch (error) {
      failure(error);
    }
  }

  async function disable(card: AdminCard) {
    if (!window.confirm(t('admin.confirmDisable', { title: localized(card.title, i18n.language) })))
      return;
    try {
      await metaApi.admin.disable(card.id);
      refresh();
    } catch (error) {
      failure(error);
    }
  }

  if (editing)
    return (
      <CardEditor
        key={editing.card.id}
        initial={editing.card}
        isNew={editing.isNew}
        active={editing.active}
        onSave={save}
        onCancel={() => setEditing(null)}
      />
    );

  return (
    <div className="admin-cards">
      {message && (
        <p className={message.tone} role="status">
          {message.text}
        </p>
      )}
      <div className="admin-toolbar">
        <label className="visually-hidden" htmlFor="card-search">
          {t('admin.search')}
        </label>
        <input
          id="card-search"
          type="search"
          placeholder={t('admin.search')}
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        <button
          type="button"
          className="primary"
          onClick={() => setEditing({ card: NEW_CARD, active: true, isNew: true })}
        >
          + {t('admin.newCard')}
        </button>
      </div>
      {cards === null ? (
        <p aria-live="polite">{t('auth.loading')}</p>
      ) : (
        <>
          <p>{t('admin.count', { shown: filtered.length, total: cards.length })}</p>
          <div className="table-scroll">
            <table className="score-table admin-table">
              <thead>
                <tr>
                  <th scope="col">{t('admin.cardTitle')}</th>
                  <th scope="col" className="hide-narrow">
                    {t('admin.weight')}
                  </th>
                  <th scope="col">{t('admin.state')}</th>
                  <th scope="col">
                    <span className="visually-hidden">{t('admin.actions')}</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((card) => (
                  <tr key={card.id} className={card.active ? undefined : 'inactive'}>
                    <th scope="row">
                      {localized(card.title, i18n.language)}
                      <small>{card.id}</small>
                    </th>
                    <td className="hide-narrow">{card.weight}</td>
                    <td>{card.active ? t('admin.on') : t('admin.off')}</td>
                    <td className="row-actions">
                      <button
                        type="button"
                        onClick={() =>
                          setEditing({
                            card: editableCard(card),
                            active: card.active,
                            isNew: false,
                          })
                        }
                      >
                        {t('admin.edit')}
                      </button>
                      {card.active && (
                        <button type="button" className="danger" onClick={() => void disable(card)}>
                          {t('admin.disable')}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

const percent = (value: number) => `${Math.round(value * 1000) / 10} %`;

/** Statistiques : cartes les plus tirées, choix les plus fréquents, faillites par phase. */
function StatsTab() {
  const { t, i18n } = useTranslation();
  const [stats, setStats] = useState<AdminStatsResponse | null>(null);
  const [error, setError] = useState(false);
  useEffect(() => {
    metaApi.admin.stats().then(setStats, () => setError(true));
  }, []);
  if (error)
    return (
      <p className="error" role="alert">
        {t('leaderboard.error')}
      </p>
    );
  if (!stats) return <p aria-live="polite">{t('auth.loading')}</p>;
  return (
    <div className="admin-stats">
      <dl className="profile-stats">
        <div>
          <dt>{t('admin.users')}</dt>
          <dd>{stats.totals.users}</dd>
        </div>
        <div>
          <dt>{t('admin.games')}</dt>
          <dd>{stats.totals.games}</dd>
        </div>
        <div>
          <dt>{t('admin.cards')}</dt>
          <dd>{stats.totals.cards}</dd>
        </div>
        {Object.entries(stats.outcomes).map(([outcome, count]) => (
          <div key={outcome}>
            <dt>{t(`end.outcomes.${outcome as 'IPO'}`)}</dt>
            <dd>{count}</dd>
          </div>
        ))}
      </dl>
      <h2>{t('admin.bankruptcy')}</h2>
      <table className="score-table">
        <thead>
          <tr>
            <th scope="col">{t('admin.phase')}</th>
            <th scope="col">{t('admin.games')}</th>
            <th scope="col">{t('admin.bankruptcies')}</th>
            <th scope="col">{t('admin.rate')}</th>
          </tr>
        </thead>
        <tbody>
          {stats.bankruptcyByPhase.map((row) => (
            <tr key={row.phase}>
              <th scope="row">{t(`phases.${row.phase}`)}</th>
              <td>{row.games}</td>
              <td>{row.bankruptcies}</td>
              <td>{percent(row.rate)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <h2>{t('admin.topCards')}</h2>
      {stats.topCards.length === 0 ? (
        <p>{t('admin.noData')}</p>
      ) : (
        <ol className="bar-list">
          {stats.topCards.map((row) => (
            <li key={row.cardId}>
              <span>{localized(row.title, i18n.language)}</span>
              <strong>{row.count}</strong>
            </li>
          ))}
        </ol>
      )}
      <h2>{t('admin.topChoices')}</h2>
      {stats.topChoices.length === 0 ? (
        <p>{t('admin.noData')}</p>
      ) : (
        <ol className="bar-list">
          {stats.topChoices.map((row) => (
            <li key={`${row.cardId}-${row.choiceIndex}`}>
              <span>
                {localized(row.title, i18n.language)} → {localized(row.label, i18n.language)}
              </span>
              <strong>
                {row.count} ({percent(row.share)})
              </strong>
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Back-office (rôle ADMIN, vérifié aussi par le serveur sur chaque route). */
export function AdminPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'cards' | 'stats'>('cards');
  return (
    <div className="admin">
      <div className="tabs" role="tablist" aria-label={t('admin.heading')}>
        {(['cards', 'stats'] as const).map((id) => (
          <button
            key={id}
            type="button"
            role="tab"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
          >
            {t(`admin.tabs.${id}`)}
          </button>
        ))}
      </div>
      {tab === 'cards' ? <CardsTab /> : <StatsTab />}
    </div>
  );
}
