import {
  CARD_GAUGES,
  DEV_ROLES,
  type AdminCardListItem,
  type AdminStatsResponse,
  type CardGauge,
  type CharacterPack,
  type CharacterPackId,
  type EventCard,
} from '@oss/shared';
import { useEffect, useMemo, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { ApiRequestError } from '../../api/client';
import { metaApi } from '../../api/meta';
import { useCharacterPacks } from '../../save/packs';
import { localized } from '../game/format';
import { CardEditor, editableCard, NEW_CARD } from './CardEditor';
import { DecorTab } from './DecorTab';
import {
  activeFilterCount,
  CARD_SORTS,
  CARD_TRAITS,
  cardTraits,
  DEFAULT_FILTERS,
  filterCards,
  loadFilters,
  phaseRange,
  PLAYABLE_PHASES,
  saveFilters,
  touchedGauges,
  type CardFilters,
} from './cardFilters';

type Editing = { card: EventCard; active: boolean; isNew: boolean } | null;
type Message = { text: string; tone: 'error' | 'up' } | null;

/** Nom court d'une jauge (le moral a sa propre clé dans les traductions). */
function useGaugeName() {
  const { t } = useTranslation();
  return (gauge: CardGauge) =>
    gauge === 'moral' ? t('gauges.morale.name') : t(`gauges.${gauge}.short`);
}

/** Identifiant libre pour la copie d'une carte (« carte-copie », « carte-copie-2 »…). */
function copyId(id: string, taken: ReadonlySet<string>): string {
  const base = `${id.slice(0, 56)}-copie`;
  if (!taken.has(base)) return base;
  let n = 2;
  while (taken.has(`${base}-${n}`)) n += 1;
  return `${base}-${n}`;
}

/** Panneau de filtres : tous les champs se combinent. */
function FilterPanel({
  filters,
  onChange,
}: {
  filters: CardFilters;
  onChange: (filters: CardFilters) => void;
}) {
  const { t } = useTranslation();
  const gaugeName = useGaugeName();
  const set = <K extends keyof CardFilters>(key: K, value: CardFilters[K]) =>
    onChange({ ...filters, [key]: value });
  const toggleTrait = (trait: (typeof CARD_TRAITS)[number]) =>
    set(
      'traits',
      filters.traits.includes(trait)
        ? filters.traits.filter((item) => item !== trait)
        : CARD_TRAITS.filter((item) => item === trait || filters.traits.includes(item)),
    );

  return (
    <div className="admin-filter-fields">
      <fieldset className="admin-segmented">
        <legend>{t('admin.status.label')}</legend>
        <div>
          {(['all', 'active', 'inactive'] as const).map((status) => (
            <button
              key={status}
              type="button"
              aria-pressed={filters.status === status}
              onClick={() => set('status', status)}
            >
              {t(`admin.status.${status}`)}
            </button>
          ))}
        </div>
      </fieldset>
      <label>
        {t('admin.phaseFilter')}
        <select
          value={filters.phase}
          onChange={(e) => set('phase', e.target.value as CardFilters['phase'])}
        >
          <option value="all">{t('admin.allPhases')}</option>
          {PLAYABLE_PHASES.map((phase) => (
            <option key={phase} value={phase}>
              {t(`phases.${phase}`)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t('admin.roleFilter')}
        <select
          value={filters.role}
          onChange={(e) => set('role', e.target.value as CardFilters['role'])}
        >
          <option value="all">{t('admin.allRoles')}</option>
          <option value="none">{t('admin.noRole')}</option>
          {DEV_ROLES.map((role) => (
            <option key={role} value={role}>
              {t(`roles.${role}`)}
            </option>
          ))}
        </select>
      </label>
      <label>
        {t('admin.gaugeFilter')}
        <select
          value={filters.gauge}
          onChange={(e) => set('gauge', e.target.value as CardFilters['gauge'])}
        >
          <option value="all">{t('admin.allGauges')}</option>
          {CARD_GAUGES.map((gauge) => (
            <option key={gauge} value={gauge}>
              {gaugeName(gauge)}
            </option>
          ))}
        </select>
      </label>
      <fieldset className="admin-traits">
        <legend>{t('admin.traitsLabel')}</legend>
        {CARD_TRAITS.map((trait) => (
          <label key={trait} className="switch">
            <input
              type="checkbox"
              checked={filters.traits.includes(trait)}
              onChange={() => toggleTrait(trait)}
            />
            {t(`admin.traits.${trait}`)}
          </label>
        ))}
      </fieldset>
      <label>
        {t('admin.sort')}
        <select
          value={filters.sort}
          onChange={(e) => set('sort', e.target.value as CardFilters['sort'])}
        >
          {CARD_SORTS.map((sort) => (
            <option key={sort} value={sort}>
              {t(`admin.sorts.${sort}`)}
            </option>
          ))}
        </select>
      </label>
    </div>
  );
}

/** Pastilles des filtres actifs, chacune avec sa croix pour le retirer. */
function ActiveFilters({
  filters,
  onChange,
}: {
  filters: CardFilters;
  onChange: (filters: CardFilters) => void;
}) {
  const { t } = useTranslation();
  const gaugeName = useGaugeName();
  const chips: { key: string; label: string; next: CardFilters }[] = [];
  if (filters.text.trim())
    chips.push({
      key: 'text',
      label: `« ${filters.text.trim()} »`,
      next: { ...filters, text: '' },
    });
  if (filters.status !== 'all')
    chips.push({
      key: 'status',
      label: t(`admin.status.${filters.status}`),
      next: { ...filters, status: 'all' },
    });
  if (filters.phase !== 'all')
    chips.push({
      key: 'phase',
      label: t(`phases.${filters.phase}`),
      next: { ...filters, phase: 'all' },
    });
  if (filters.role !== 'all')
    chips.push({
      key: 'role',
      label: filters.role === 'none' ? t('admin.noRole') : t(`roles.${filters.role}`),
      next: { ...filters, role: 'all' },
    });
  if (filters.gauge !== 'all')
    chips.push({
      key: 'gauge',
      label: gaugeName(filters.gauge),
      next: { ...filters, gauge: 'all' },
    });
  for (const trait of filters.traits)
    chips.push({
      key: trait,
      label: t(`admin.traits.${trait}`),
      next: { ...filters, traits: filters.traits.filter((item) => item !== trait) },
    });
  if (chips.length === 0) return null;
  return (
    <ul className="admin-chips" aria-label={t('admin.filters')}>
      {chips.map((chip) => (
        <li key={chip.key}>
          <button
            type="button"
            className="admin-chip"
            aria-label={t('admin.removeFilter', { name: chip.label })}
            onClick={() => onChange(chip.next)}
          >
            {chip.label} <span aria-hidden="true">×</span>
          </button>
        </li>
      ))}
      <li>
        <button
          type="button"
          className="admin-chip-reset"
          onClick={() => onChange({ ...DEFAULT_FILTERS, sort: filters.sort })}
        >
          {t('admin.resetFilters')}
        </button>
      </li>
    </ul>
  );
}

/** Une carte de la liste : titre, résumé de ses règles et actions. */
function CardRow({
  card,
  onEdit,
  onDuplicate,
  onToggle,
}: {
  card: AdminCardListItem;
  onEdit: () => void;
  onDuplicate: () => void;
  onToggle: () => void;
}) {
  const { t, i18n } = useTranslation();
  const gaugeName = useGaugeName();
  const range = phaseRange(card);
  const phases =
    range.from === range.to
      ? t(`phases.${range.from}`)
      : `${t(`phases.${range.from}`)} → ${t(`phases.${range.to}`)}`;
  const gauges = touchedGauges(card);
  const traits = cardTraits(card);
  return (
    <li className={card.active ? 'admin-card' : 'admin-card inactive'}>
      <div className="admin-card-head">
        <h3>{localized(card.title, i18n.language)}</h3>
        <span className={card.active ? 'admin-state on' : 'admin-state off'}>
          {card.active ? t('admin.on') : t('admin.off')}
        </span>
      </div>
      <code className="admin-card-id">{card.id}</code>
      <p className="admin-card-desc">{localized(card.description, i18n.language)}</p>
      <dl className="admin-card-facts">
        <div>
          <dt>{t('admin.weight')}</dt>
          <dd>{card.weight}</dd>
        </div>
        <div>
          <dt>{t('admin.draws')}</dt>
          <dd>{card.draws}</dd>
        </div>
        <div>
          <dt>{t('admin.phases')}</dt>
          <dd>{phases}</dd>
        </div>
        {card.conditions.hasRole && (
          <div>
            <dt>{t('admin.role')}</dt>
            <dd>{t(`roles.${card.conditions.hasRole}`)}</dd>
          </div>
        )}
      </dl>
      {(gauges.length > 0 || traits.length > 0) && (
        <ul className="admin-tags" aria-label={t('admin.gaugesTouched')}>
          {gauges.map((gauge) => (
            <li key={gauge} className="admin-tag">
              {gaugeName(gauge)}
            </li>
          ))}
          {traits.map((trait) => (
            <li key={trait} className="admin-tag trait">
              {t(`admin.traits.${trait}`)}
            </li>
          ))}
        </ul>
      )}
      <div className="row-actions">
        <button type="button" onClick={onEdit}>
          {t('admin.edit')}
        </button>
        <button type="button" onClick={onDuplicate}>
          {t('admin.duplicate')}
        </button>
        <button type="button" className={card.active ? 'danger' : undefined} onClick={onToggle}>
          {card.active ? t('admin.disable') : t('admin.enable')}
        </button>
      </div>
    </li>
  );
}

/** Liste des cartes : recherche, filtres combinables, tri, édition et désactivation. */
function CardsTab() {
  const { t, i18n } = useTranslation();
  const [cards, setCards] = useState<AdminCardListItem[] | null>(null);
  const [filters, setFiltersState] = useState<CardFilters>(loadFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [editing, setEditing] = useState<Editing>(null);
  const [message, setMessage] = useState<Message>(null);

  // Incrémenté après chaque modification pour relire la liste.
  const [version, setVersion] = useState(0);
  const refresh = () => setVersion((v) => v + 1);

  const setFilters = (next: CardFilters) => {
    setFiltersState(next);
    saveFilters(next);
  };

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

  const filtered = useMemo(
    () => filterCards(cards ?? [], filters, i18n.language),
    [cards, filters, i18n.language],
  );
  const activeCount = cards?.filter((card) => card.active).length ?? 0;
  const filterCount = activeFilterCount({ ...filters, text: '' });

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

  async function toggle(card: AdminCardListItem) {
    const title = localized(card.title, i18n.language);
    if (card.active && !window.confirm(t('admin.confirmDisable', { title }))) return;
    try {
      if (card.active) await metaApi.admin.disable(card.id);
      else await metaApi.admin.update({ ...editableCard(card), active: true });
      setMessage({ text: t(card.active ? 'admin.disabled' : 'admin.enabled'), tone: 'up' });
      refresh();
    } catch (error) {
      failure(error);
    }
  }

  function duplicate(card: AdminCardListItem) {
    const taken = new Set((cards ?? []).map((item) => item.id));
    setEditing({
      card: { ...editableCard(card), id: copyId(card.id, taken) },
      active: false,
      isNew: true,
    });
  }

  if (editing)
    return (
      <div className="admin-editing">
        <div className="admin-editing-head">
          <button type="button" onClick={() => setEditing(null)}>
            ← {t('admin.back')}
          </button>
          <h2>
            {editing.isNew
              ? t('admin.creating')
              : t('admin.editing', { title: localized(editing.card.title, i18n.language) })}
          </h2>
        </div>
        {message?.tone === 'error' && (
          <p className="error" role="alert">
            {message.text}
          </p>
        )}
        <CardEditor
          key={editing.card.id}
          initial={editing.card}
          isNew={editing.isNew}
          active={editing.active}
          onSave={save}
          onCancel={() => setEditing(null)}
        />
      </div>
    );

  return (
    <div className="admin-cards">
      <div className="admin-toolbar">
        <label className="admin-search">
          <span className="visually-hidden">{t('admin.search')}</span>
          <input
            type="search"
            placeholder={t('admin.searchPlaceholder')}
            value={filters.text}
            onChange={(e) => setFilters({ ...filters, text: e.target.value })}
          />
        </label>
        <button
          type="button"
          className="admin-filters-toggle"
          aria-expanded={filtersOpen}
          aria-controls="admin-filters"
          onClick={() => setFiltersOpen((open) => !open)}
        >
          {t('admin.filters')}
          {filterCount > 0 && <span className="badge">{filterCount}</span>}
        </button>
        <button
          type="button"
          className="primary"
          onClick={() => setEditing({ card: NEW_CARD, active: true, isNew: true })}
        >
          + {t('admin.newCard')}
        </button>
      </div>
      {message && (
        <p className={message.tone} role="status">
          {message.text}
        </p>
      )}
      <div className="admin-layout">
        <aside
          id="admin-filters"
          className={filtersOpen ? 'admin-filters open' : 'admin-filters'}
          aria-label={t('admin.filters')}
        >
          <FilterPanel filters={filters} onChange={setFilters} />
          <button
            type="button"
            className="primary admin-filters-done"
            onClick={() => setFiltersOpen(false)}
          >
            {t('admin.showResults', { count: filtered.length })}
          </button>
        </aside>
        <section className="admin-results" aria-live="polite">
          {cards === null ? (
            <p>{t('auth.loading')}</p>
          ) : (
            <>
              <p className="admin-summary">
                <strong>{t('admin.count', { count: filtered.length, total: cards.length })}</strong>
                <small>
                  {t('admin.summary', {
                    active: activeCount,
                    inactive: cards.length - activeCount,
                  })}
                </small>
              </p>
              <ActiveFilters filters={filters} onChange={setFilters} />
              {filtered.length === 0 ? (
                <div className="admin-empty">
                  <p>{t('admin.empty')}</p>
                  <button
                    type="button"
                    onClick={() => setFilters({ ...DEFAULT_FILTERS, sort: filters.sort })}
                  >
                    {t('admin.resetFilters')}
                  </button>
                </div>
              ) : (
                <ul className="admin-card-list">
                  {filtered.map((card) => (
                    <CardRow
                      key={card.id}
                      card={card}
                      onEdit={() =>
                        setEditing({
                          card: editableCard(card),
                          active: card.active,
                          isNew: false,
                        })
                      }
                      onDuplicate={() => duplicate(card)}
                      onToggle={() => void toggle(card)}
                    />
                  ))}
                </ul>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

const percent = (value: number) => `${Math.round(value * 1000) / 10} %`;

/** Barre proportionnelle décorative (la valeur exacte est écrite à côté). */
function Bar({ share }: { share: number }) {
  const width = `${Math.max(0, Math.min(1, share)) * 100}%`;
  return (
    <span className="bar" aria-hidden="true">
      <span style={{ width }} />
    </span>
  );
}

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
              <Bar share={row.count / (stats.topCards[0]?.count || 1)} />
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
              <Bar share={row.share} />
            </li>
          ))}
        </ol>
      )}
    </div>
  );
}

/** Aperçu 3D d'un pack : rendu à la demande, Three.js n'est chargé qu'à ce moment-là. */
function PackPreview({ id }: { id: CharacterPackId }) {
  const { t } = useTranslation();
  const [image, setImage] = useState<string | null | undefined>(undefined);
  useEffect(() => {
    let cancelled = false;
    import('../../render/packPreview')
      .then(({ packPreview }) => packPreview(id))
      .then(
        (url) => !cancelled && setImage(url),
        () => !cancelled && setImage(null),
      );
    return () => {
      cancelled = true;
    };
  }, [id]);
  if (image === undefined) return <div className="admin-pack-preview" aria-busy="true" />;
  if (image === null) return null;
  return (
    <img
      className="admin-pack-preview"
      src={image}
      alt={t('admin.packs.previewAlt', { pack: t(`packs.${id}.name`) })}
    />
  );
}

/** Packs de personnages thématiques : costumes portés par toute l'équipe, désactivés au départ. */
function PacksTab() {
  const { t } = useTranslation();
  const [packs, setPacks] = useState<CharacterPack[] | null>(null);
  const [error, setError] = useState(false);
  const [message, setMessage] = useState<Message>(null);
  useEffect(() => {
    metaApi.admin.characterPacks().then(setPacks, () => setError(true));
  }, []);

  const toggle = async (pack: CharacterPack) => {
    const name = t(`packs.${pack.id}.name`);
    try {
      const updated = await metaApi.admin.setCharacterPack(pack.id, !pack.enabled);
      setPacks((list) => list?.map((item) => (item.id === updated.id ? updated : item)) ?? null);
      setMessage({
        text: t(updated.enabled ? 'admin.packs.enabled' : 'admin.packs.disabled', { pack: name }),
        tone: 'up',
      });
      // La partie en cours (même onglet) rhabille aussitôt son équipe.
      void useCharacterPacks.getState().refresh();
    } catch (cause) {
      setMessage({
        text: cause instanceof ApiRequestError ? cause.message : t('leaderboard.error'),
        tone: 'error',
      });
    }
  };

  if (error)
    return (
      <p className="error" role="alert">
        {t('leaderboard.error')}
      </p>
    );
  if (!packs) return <p aria-live="polite">{t('auth.loading')}</p>;
  return (
    <div className="admin-packs">
      <p className="admin-packs-intro">{t('admin.packs.intro')}</p>
      {message && (
        <p className={message.tone} role="status">
          {message.text}
        </p>
      )}
      <ul className="admin-pack-list">
        {packs.map((pack) => (
          <li key={pack.id} className={`admin-card${pack.enabled ? '' : ' inactive'}`}>
            <div className="admin-card-head">
              <h3>{t(`packs.${pack.id}.name`)}</h3>
              <span className={`admin-state ${pack.enabled ? 'on' : 'off'}`}>
                {t(pack.enabled ? 'admin.packs.on' : 'admin.packs.off')}
              </span>
            </div>
            <p className="admin-card-desc">{t(`packs.${pack.id}.description`)}</p>
            <PackPreview id={pack.id} />
            <label className="switch">
              <input
                type="checkbox"
                checked={pack.enabled}
                onChange={() => void toggle(pack)}
                data-testid={`pack-${pack.id}`}
              />
              {t('admin.packs.toggle')}
            </label>
          </li>
        ))}
      </ul>
    </div>
  );
}

/** Back-office (rôle ADMIN, vérifié aussi par le serveur sur chaque route). */
export function AdminPage() {
  const { t } = useTranslation();
  const [tab, setTab] = useState<'cards' | 'packs' | 'decor' | 'stats'>('cards');
  return (
    <div className="admin">
      <div className="tabs" role="tablist" aria-label={t('admin.heading')}>
        {(['cards', 'packs', 'decor', 'stats'] as const).map((id) => (
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
      {tab === 'cards' ? (
        <CardsTab />
      ) : tab === 'packs' ? (
        <PacksTab />
      ) : tab === 'decor' ? (
        <DecorTab />
      ) : (
        <StatsTab />
      )}
    </div>
  );
}
