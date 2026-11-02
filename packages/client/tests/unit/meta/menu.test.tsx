import {
  ACHIEVEMENTS,
  companyName,
  type LeaderboardEntry,
  type ProfileResponse,
} from '@oss/shared';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../../src/i18n';
import { pendingAchievements } from '../../../src/save/achievements';
import { localScores } from '../../../src/save/localScores';
import { MemoryStore, setLocalStore } from '../../../src/save/storage';
import { App } from '../../../src/ui/App';
import { AchievementsPage } from '../../../src/ui/meta/Achievements';
import { Leaderboard } from '../../../src/ui/meta/Leaderboard';
import { Profile } from '../../../src/ui/meta/Profile';
import { useGame } from '../../../src/ui/store/game';
import { useSession } from '../../../src/ui/store/session';
import { calls, mockApi } from './helpers';

const USER = {
  id: 'u1',
  email: 'kevin@startup.io',
  pseudo: 'kevin_ninja',
  role: 'USER',
  locale: 'fr',
  hasPassword: true,
  hasGithub: false,
  createdAt: '2026-10-06T10:00:00.000Z',
} as const;

function entry(rank: number, pseudo: string): LeaderboardEntry {
  return {
    id: `score-${rank}`,
    rank,
    pseudo,
    mode: 'NORMAL',
    valuation: 400_000_000,
    outcome: 'IPO',
    phaseReached: 'UNICORN',
    sprintsPlayed: 39,
    company: `Startup ${pseudo}`,
    dailyDate: null,
    createdAt: '2026-10-06T10:00:00.000Z',
  };
}

const PROFILE: ProfileResponse = {
  user: USER,
  totals: {
    gamesPlayed: 12,
    bestValuation: 1_000_000_000,
    outcomes: { BANKRUPTCY: 7, IPO: 1, ACQUISITION: 2, ZOMBIE: 2 },
    stats: {
      featuresShipped: 120,
      prodOutages: 34,
      burnouts: 5,
      resignations: 3,
      hired: 20,
      fired: 4,
      meetings: 512,
      cardsResolved: 80,
    },
  },
  bestGames: [entry(1, 'kevin_ninja')],
  achievements: ACHIEVEMENTS.slice(0, 3).map(({ id, title, description, icon }, index) => ({
    id,
    title,
    description,
    icon,
    difficulty: 'EASY' as const,
    secret: false,
    unlockedAt: index === 0 ? '2026-10-01T10:00:00.000Z' : null,
  })),
};

const board =
  (...entries: LeaderboardEntry[]) =>
  () =>
    Response.json({ entries });

beforeEach(async () => {
  setLocalStore(new MemoryStore());
  useGame.getState().quit();
  useSession.setState({
    status: 'guest',
    user: null,
    error: null,
    githubEnabled: false,
    serverAvailable: true,
  });
  await i18n.changeLanguage('fr');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('Leaderboard', () => {
  it('affiche le classement global', async () => {
    const fetchMock = mockApi({
      'GET /api/scores/top?limit=50': board(entry(1, 'jade'), entry(2, 'kevin_ninja')),
    });
    render(<Leaderboard />);

    expect(await screen.findByRole('rowheader', { name: /jade/ })).toBeInTheDocument();
    expect(screen.getByRole('rowheader', { name: /kevin_ninja/ })).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Global' })).toHaveAttribute('aria-selected', 'true');
    expect(screen.getByRole('button', { name: 'Revoir la partie de jade' })).toBeEnabled();
    expect(calls(fetchMock)).toEqual(['GET /api/scores/top?limit=50']);
  });

  it('change de classement avec les onglets', async () => {
    const fetchMock = mockApi({
      'GET /api/scores/top?limit=50': board(entry(1, 'jade')),
      'GET /api/scores/top?daily=today&limit=50': board(entry(1, 'daily_dan')),
      'GET /api/scores/top?mode=HARDCORE&limit=50': board(),
    });
    render(<Leaderboard />);
    await screen.findByRole('rowheader', { name: /jade/ });

    await userEvent.click(screen.getByRole('tab', { name: 'Daily du jour' }));
    expect(await screen.findByRole('rowheader', { name: /daily_dan/ })).toBeInTheDocument();
    expect(screen.queryByRole('rowheader', { name: /jade/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('tab', { name: 'Hardcore' }));
    expect(await screen.findByText("Personne n'a encore publié de score ici.")).toBeInTheDocument();
    expect(screen.getByRole('tab', { name: 'Hardcore' })).toHaveAttribute('aria-selected', 'true');
    expect(calls(fetchMock)).toEqual([
      'GET /api/scores/top?limit=50',
      'GET /api/scores/top?daily=today&limit=50',
      'GET /api/scores/top?mode=HARDCORE&limit=50',
    ]);
  });

  it('propose un onglet par mode, sauf le Daily', () => {
    mockApi({});
    render(<Leaderboard />);
    const tabs = screen.getAllByRole('tab').map((tab) => tab.textContent);
    expect(tabs).toEqual([
      'Global',
      'Daily du jour',
      'Facile',
      'Normal',
      'Hardcore',
      'Stagiaires Only',
      'Défi 3 sprints',
      'Illimité',
    ]);
  });

  it('affiche une erreur si le serveur est injoignable', async () => {
    mockApi({});
    render(<Leaderboard />);
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Le classement en ligne a besoin du serveur du jeu',
    );
  });

  it('montre les entreprises de cet appareil sans serveur, illimité classé aux sprints', async () => {
    useSession.setState({ serverAvailable: false });
    const fetchMock = mockApi({});
    const ended = { outcome: 'BANKRUPTCY', phaseReached: 'SEED', valuation: 0 } as const;
    await localScores.add({ ...ended, seed: 'court', mode: 'ENDLESS', sprint: 45 });
    await localScores.add({ ...ended, seed: 'long', mode: 'ENDLESS', sprint: 90 });
    await localScores.add({
      seed: 'normale',
      mode: 'NORMAL',
      outcome: 'IPO',
      phaseReached: 'UNICORN',
      valuation: 2e9,
      sprint: 39,
    });
    render(<Leaderboard />);

    expect(screen.getByRole('button', { name: /Sur cet appareil/ })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(await screen.findByRole('rowheader', { name: companyName('normale') })).toBeVisible();
    // Le classement global ne mélange pas les parties illimitées.
    expect(screen.getAllByRole('rowheader')).toHaveLength(1);

    await userEvent.click(screen.getByRole('tab', { name: 'Illimité' }));
    await screen.findByRole('rowheader', { name: companyName('long') });
    expect(screen.getAllByRole('rowheader').map((cell) => cell.textContent)).toEqual([
      companyName('long'),
      companyName('court'),
    ]);
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('cache les replays quand il est ouvert en jeu', async () => {
    mockApi({ 'GET /api/scores/top?limit=50': board(entry(1, 'jade')) });
    render(<Leaderboard inGame />);
    expect(await screen.findByRole('rowheader', { name: /jade/ })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /Revoir/ })).not.toBeInTheDocument();
  });

  it('affiche une erreur si le replay ne se charge pas', async () => {
    mockApi({ 'GET /api/scores/top?limit=50': board(entry(1, 'jade')) });
    render(<Leaderboard />);
    await userEvent.click(await screen.findByRole('button', { name: 'Revoir la partie de jade' }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de charger ce replay.');
    // Le classement reste affiché : on peut essayer un autre replay.
    expect(screen.getByRole('button', { name: 'Revoir la partie de jade' })).toBeInTheDocument();
    expect(useGame.getState().view).toBeNull();
  });
});

/** Un succès du catalogue, choisi par sa visibilité. */
function pick(secret: boolean) {
  const found = ACHIEVEMENTS.find((a) => (a.secret ?? false) === secret);
  if (!found) throw new Error('catalogue incomplet');
  return found;
}

describe('AchievementsPage', () => {
  it('montre à un invité les succès de l’appareil, la condition des secrets en « ??? »', async () => {
    const visible = pick(false);
    const secrets = ACHIEVEMENTS.filter((a) => a.secret);
    const [found, hidden] = secrets;
    if (!found || !hidden) throw new Error('il faut au moins deux succès secrets');
    await pendingAchievements.add([found.id]);
    mockApi({});
    render(<AchievementsPage />);

    expect(await screen.findByText(/Connecte-toi pour les garder/)).toBeInTheDocument();
    expect(screen.getByText(`1 succès débloqués sur ${ACHIEVEMENTS.length}`)).toBeInTheDocument();
    // Succès visible verrouillé : titre et condition affichés.
    const visibleCard = screen.getByTestId(`achievement-${visible.id}`);
    expect(visibleCard).toHaveClass('locked');
    expect(visibleCard).toHaveTextContent(visible.title.fr);
    expect(visibleCard).toHaveTextContent(visible.description.fr);
    // Secret verrouillé : nom visible, condition remplacée par « ??? ».
    const hiddenCard = screen.getByTestId(`achievement-${hidden.id}`);
    expect(hiddenCard).toHaveTextContent('???');
    expect(hiddenCard).toHaveTextContent(hidden.title.fr);
    expect(hiddenCard).not.toHaveTextContent(hidden.description.fr);
    // Secret débloqué sur cet appareil : révélé.
    const foundCard = screen.getByTestId(`achievement-${found.id}`);
    expect(foundCard).toHaveClass('unlocked');
    expect(foundCard).toHaveTextContent(found.title.fr);
  });

  it('range les succès par difficulté et filtre les débloqués', async () => {
    const first = pick(false);
    mockApi({
      'GET /api/achievements': () =>
        Response.json({
          achievements: ACHIEVEMENTS.map(({ check: _check, secret = false, ...a }) => ({
            ...a,
            secret,
            unlockedAt: a.id === first.id ? '2026-10-01T10:00:00.000Z' : null,
          })),
        }),
    });
    render(<AchievementsPage />);

    for (const name of ['Faciles', 'Intermédiaires', 'Difficiles', 'Légendaires'])
      expect(await screen.findByRole('heading', { name: new RegExp(name) })).toBeInTheDocument();
    expect(screen.getAllByRole('listitem')).toHaveLength(ACHIEVEMENTS.length);

    await userEvent.click(screen.getByRole('tab', { name: 'Débloqués' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(1);
    expect(screen.getByTestId(`achievement-${first.id}`)).toHaveTextContent('Débloqué le');

    await userEvent.click(screen.getByRole('tab', { name: 'À débloquer' }));
    expect(screen.getAllByRole('listitem')).toHaveLength(ACHIEVEMENTS.length - 1);
  });
});

describe('Profile', () => {
  it('montre à un invité un résumé des succès de l’appareil', async () => {
    const first = ACHIEVEMENTS[0];
    if (!first) throw new Error('catalogue vide');
    await pendingAchievements.add([first.id]);
    mockApi({});
    const open = vi.fn();
    render(<Profile onOpenAchievements={open} />);

    expect(screen.getByText(/En invité, tes succès restent sur cet appareil/)).toBeInTheDocument();
    expect(
      await screen.findByText(`1 succès débloqués sur ${ACHIEVEMENTS.length}`),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: /Voir tous les succès/ }));
    expect(open).toHaveBeenCalled();
  });

  it('montre au joueur connecté ses statistiques et ses succès', async () => {
    useSession.setState({ status: 'authenticated', user: USER });
    mockApi({ 'GET /api/me/profile': () => Response.json(PROFILE) });
    render(<Profile onOpenAchievements={() => undefined} />);

    expect(await screen.findByRole('heading', { name: 'kevin_ninja' })).toBeInTheDocument();
    const games = screen.getByText('Parties publiées').parentElement;
    expect(games).toHaveTextContent('12');
    expect(screen.getByText('Réunions').parentElement).toHaveTextContent('512');
    expect(screen.getByText('1 succès débloqués sur 3')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Voir tous les succès/ })).toBeInTheDocument();
  });

  it('affiche une erreur si le profil ne se charge pas', async () => {
    useSession.setState({ status: 'authenticated', user: USER });
    mockApi({});
    render(<Profile onOpenAchievements={() => undefined} />);
    expect(await screen.findByRole('alert')).toHaveTextContent('Impossible de joindre le serveur.');
  });
});

describe('App : menu du méta-jeu', () => {
  it('ouvre le classement puis revient à l’accueil', async () => {
    const fetchMock = mockApi({
      'GET /api/me': () => Response.json({ user: USER }),
      'GET /api/scores/top?limit=50': board(entry(1, 'jade')),
    });
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: /Classements/ }));
    expect(screen.getByRole('heading', { level: 1, name: 'Classements' })).toBeInTheDocument();
    expect(await screen.findByRole('rowheader', { name: /jade/ })).toBeInTheDocument();
    expect(calls(fetchMock)).toContain('GET /api/scores/top?limit=50');

    await userEvent.click(screen.getByRole('button', { name: /Retour/ }));
    expect(await screen.findByText('Bienvenue, kevin_ninja !')).toBeInTheDocument();
  });

  it('ouvre le profil du joueur connecté', async () => {
    mockApi({
      'GET /api/me': () => Response.json({ user: USER }),
      'GET /api/me/profile': () => Response.json(PROFILE),
    });
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: /Profil/ }));
    expect(screen.getByRole('heading', { level: 1, name: 'Profil' })).toBeInTheDocument();
    expect(await screen.findByRole('heading', { name: 'kevin_ninja' })).toBeInTheDocument();
  });

  it('ouvre l’écran des succès depuis le menu principal', async () => {
    mockApi({});
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: /Succès/ }));
    expect(screen.getByRole('heading', { level: 1, name: 'Succès' })).toBeInTheDocument();
    expect(await screen.findAllByRole('listitem')).toHaveLength(ACHIEVEMENTS.length);
  });

  it('ouvre les succès depuis le profil', async () => {
    mockApi({});
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: /Profil/ }));
    await userEvent.click(await screen.findByRole('button', { name: /Voir tous les succès/ }));
    expect(screen.getByRole('heading', { level: 1, name: 'Succès' })).toBeInTheDocument();
  });

  it('réserve le back-office aux administrateurs', async () => {
    mockApi({ 'GET /api/me': () => Response.json({ user: USER }) });
    render(<App />);
    await screen.findByText('Bienvenue, kevin_ninja !');
    expect(screen.queryByRole('button', { name: /Back-office/ })).not.toBeInTheDocument();
  });

  it('affiche le lien vers le back-office à un administrateur', async () => {
    mockApi({ 'GET /api/me': () => Response.json({ user: { ...USER, role: 'ADMIN' } }) });
    render(<App />);
    expect(await screen.findByRole('button', { name: /Back-office/ })).toBeInTheDocument();
    expect(screen.getByText('Administrateur')).toBeInTheDocument();
  });
});
