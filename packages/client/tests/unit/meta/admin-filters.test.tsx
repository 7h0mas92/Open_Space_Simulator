import { EVENT_CARDS, type AdminCardListItem, type EventCard } from '@oss/shared';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../../src/i18n';
import { AdminPage } from '../../../src/ui/admin/AdminPage';
import {
  activeFilterCount,
  cardTraits,
  DEFAULT_FILTERS,
  filterCards,
  loadFilters,
  matchesFilters,
  phaseRange,
  saveFilters,
  touchedGauges,
  type CardFilters,
} from '../../../src/ui/admin/cardFilters';
import { bodyOf, calls, mockApi } from './helpers';

/** Carte de back-office construite à partir d'une carte du jeu. */
function item(card: Partial<EventCard> & { id: string }, extra: Partial<AdminCardListItem> = {}) {
  const base = EVENT_CARDS[0]!;
  return {
    ...base,
    conditions: {},
    ...card,
    active: true,
    updatedAt: '2026-10-01T10:00:00.000Z',
    draws: 0,
    ...extra,
  } as AdminCardListItem;
}

const CAFE = item({
  id: 'machine-cafe',
  title: { fr: 'La machine à café est en panne', en: 'The coffee machine is broken' },
  description: { fr: 'Équipe en manque.', en: 'Team in withdrawal.' },
  weight: 8,
  choices: [
    { label: { fr: 'Réparer', en: 'Fix it' }, effects: { treasury: -500, coffee: 40 } },
    { label: { fr: 'On en reparle', en: 'Later' }, effects: { requeue: {}, 'moral.INTERN': -5 } },
  ],
});
const STAGIAIRE = item(
  {
    id: 'stagiaire-force-push',
    title: { fr: 'Le stagiaire a push --force', en: 'The intern force-pushed' },
    conditions: { hasRole: 'INTERN', minPhase: 'SEED', maxPhase: 'SERIES_A' },
    weight: 0,
    choices: [
      { label: { fr: 'Le virer', en: 'Fire them' }, effects: { fireDev: 'INTERN', stability: 10 } },
      { label: { fr: 'Pardonner', en: 'Forgive' }, effects: { debt: 5 } },
    ],
  },
  { active: false, draws: 12, updatedAt: '2026-10-05T10:00:00.000Z' },
);
const VENDREDI = item(
  {
    id: 'vendredi-17h',
    title: { fr: 'Vendredi 17h04, la prod est down', en: 'Friday 5:04pm, prod is down' },
    conditions: { dayOfWeek: 5, afterHour: 17, gauges: { stability: { max: 40 } } },
    weight: 6,
    choices: [
      { label: { fr: 'Rollback', en: 'Rollback' }, effects: { stability: 20, hype: 0 } },
      { label: { fr: 'Lundi', en: 'Monday' }, effects: { users: -10, unlockAchievement: 'x' } },
    ],
  },
  { draws: 30 },
);
const CARDS = [CAFE, STAGIAIRE, VENDREDI];

const ids = (filters: Partial<CardFilters>, language = 'fr') =>
  filterCards(CARDS, { ...DEFAULT_FILTERS, ...filters }, language).map((card) => card.id);

describe('cardFilters', () => {
  it('résume jauges touchées, particularités et phases', () => {
    expect(touchedGauges(CAFE)).toEqual(['treasury', 'coffee', 'moral']);
    // Un effet à 0 ne compte pas.
    expect(touchedGauges(VENDREDI)).toEqual(['stability', 'users']);
    expect(cardTraits(CAFE)).toEqual(['chain']);
    expect(cardTraits(STAGIAIRE)).toEqual(['drawOnly', 'team']);
    expect(cardTraits(VENDREDI)).toEqual(['timed', 'gaugeCondition', 'achievement']);
    expect(phaseRange(CAFE)).toEqual({ from: 'GARAGE', to: 'UNICORN' });
    expect(phaseRange(STAGIAIRE)).toEqual({ from: 'SEED', to: 'SERIES_A' });
  });

  it('cherche dans le titre, la description, les choix et l’id, sans accents ni casse', () => {
    expect(ids({ text: 'EQUIPE' })).toEqual(['machine-cafe']);
    expect(ids({ text: 'rollback' })).toEqual(['vendredi-17h']);
    expect(ids({ text: 'force-push' })).toEqual(['stagiaire-force-push']);
    expect(ids({ text: 'coffee broken' })).toEqual(['machine-cafe']);
    expect(ids({ text: 'café lundi' })).toEqual([]);
  });

  it('filtre par état, phase, profil et jauge', () => {
    expect(ids({ status: 'inactive' })).toEqual(['stagiaire-force-push']);
    expect(ids({ status: 'active' })).toHaveLength(2);
    expect(ids({ phase: 'GARAGE' })).toEqual(['machine-cafe', 'vendredi-17h']);
    expect(ids({ phase: 'SERIES_A' })).toHaveLength(3);
    expect(ids({ role: 'INTERN' })).toEqual(['stagiaire-force-push']);
    expect(ids({ role: 'none' })).toEqual(['machine-cafe', 'vendredi-17h']);
    expect(ids({ gauge: 'moral' })).toEqual(['machine-cafe']);
    expect(ids({ gauge: 'stability' })).toEqual(['stagiaire-force-push', 'vendredi-17h']);
  });

  it('combine les filtres : une carte doit tous les passer', () => {
    expect(ids({ gauge: 'stability', status: 'active' })).toEqual(['vendredi-17h']);
    expect(ids({ traits: ['timed', 'achievement'] })).toEqual(['vendredi-17h']);
    expect(ids({ traits: ['chain', 'team'] })).toEqual([]);
    expect(matchesFilters(CAFE, { ...DEFAULT_FILTERS, phase: 'SEED', traits: ['chain'] })).toBe(
      true,
    );
  });

  it('trie par titre (dans la langue affichée), poids, tirages ou date', () => {
    expect(ids({})).toEqual(['machine-cafe', 'stagiaire-force-push', 'vendredi-17h']);
    expect(ids({}, 'en')).toEqual(['vendredi-17h', 'machine-cafe', 'stagiaire-force-push']);
    expect(ids({ sort: 'weight' })).toEqual([
      'machine-cafe',
      'vendredi-17h',
      'stagiaire-force-push',
    ]);
    expect(ids({ sort: 'draws' })).toEqual([
      'vendredi-17h',
      'stagiaire-force-push',
      'machine-cafe',
    ]);
    expect(ids({ sort: 'updated' })[0]).toBe('stagiaire-force-push');
  });

  it('compte les filtres actifs hors tri', () => {
    expect(activeFilterCount(DEFAULT_FILTERS)).toBe(0);
    expect(
      activeFilterCount({
        ...DEFAULT_FILTERS,
        text: 'x',
        gauge: 'debt',
        traits: ['chain', 'team'],
        sort: 'draws',
      }),
    ).toBe(4);
  });

  it('retient les filtres de la session et ignore les valeurs abîmées', () => {
    sessionStorage.clear();
    expect(loadFilters()).toEqual(DEFAULT_FILTERS);
    const filters: CardFilters = { ...DEFAULT_FILTERS, phase: 'SEED', traits: ['chain'] };
    saveFilters(filters);
    expect(loadFilters()).toEqual(filters);
    sessionStorage.setItem(
      'oss.admin.cardFilters',
      JSON.stringify({ ...filters, phase: 'MARS', sort: 'au-pif' }),
    );
    expect(loadFilters()).toEqual({ ...filters, phase: 'all', sort: 'title' });
    sessionStorage.setItem('oss.admin.cardFilters', '{ pas du json');
    expect(loadFilters()).toEqual(DEFAULT_FILTERS);
  });
});

describe('Back-office : liste des cartes', () => {
  beforeEach(async () => {
    await i18n.changeLanguage('fr');
    sessionStorage.clear();
  });
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  const list = () => Response.json({ cards: CARDS });

  it('affiche les cartes et combine recherche et filtres, avec des pastilles retirables', async () => {
    mockApi({ 'GET /api/admin/events': list });
    render(<AdminPage />);
    expect(await screen.findByText('3 cartes affichées sur 3')).toBeInTheDocument();
    expect(screen.getByText('Actives : 2 · désactivées : 1')).toBeInTheDocument();

    await userEvent.selectOptions(
      screen.getByLabelText('Jauge modifiée par un choix'),
      'stability',
    );
    expect(screen.getByText('2 cartes affichées sur 3')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Actives' }));
    expect(screen.getByText('1 carte affichée sur 3')).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Vendredi 17h04, la prod est down' })).toBeVisible();

    await userEvent.click(screen.getByRole('button', { name: 'Retirer le filtre Actives' }));
    expect(screen.getByText('2 cartes affichées sur 3')).toBeInTheDocument();

    await userEvent.type(screen.getByPlaceholderText(/Titre, description/), 'zzz');
    expect(screen.getByText(/Aucune carte ne correspond/)).toBeInTheDocument();
    await userEvent.click(
      within(screen.getByText(/Aucune carte/).parentElement!).getByRole('button'),
    );
    expect(screen.getByText('3 cartes affichées sur 3')).toBeInTheDocument();
  });

  it('réactive une carte désactivée en un clic', async () => {
    const fetchMock = mockApi({
      'GET /api/admin/events': list,
      'PUT /api/admin/events/stagiaire-force-push': () =>
        Response.json({ ...STAGIAIRE, draws: undefined, active: true }),
    });
    render(<AdminPage />);
    await userEvent.click(await screen.findByRole('button', { name: 'Réactiver' }));
    expect(await screen.findByText('Carte réactivée.')).toBeInTheDocument();
    expect(calls(fetchMock)).toContain('PUT /api/admin/events/stagiaire-force-push');
    expect(bodyOf(fetchMock, 'PUT /api/admin/events/stagiaire-force-push')).toMatchObject({
      id: 'stagiaire-force-push',
      active: true,
    });
  });

  it('duplique une carte dans l’éditeur avec un nouvel identifiant', async () => {
    mockApi({ 'GET /api/admin/events': list });
    render(<AdminPage />);
    const tiles = await screen.findAllByRole('button', { name: 'Dupliquer' });
    await userEvent.click(tiles[0]!);
    expect(screen.getByRole('heading', { name: 'Nouvelle carte' })).toBeInTheDocument();
    expect((screen.getByLabelText('Carte (JSON)') as HTMLTextAreaElement).value).toContain(
      '"id": "machine-cafe-copie"',
    );
    await userEvent.click(screen.getByRole('button', { name: /Retour aux cartes/ }));
    expect(screen.getByText('3 cartes affichées sur 3')).toBeInTheDocument();
  });
});
