import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import i18n from '../../src/i18n';
import { App } from '../../src/ui/App';
import { useSession } from '../../src/ui/store/session';

const user = {
  id: 'u1',
  email: 'kevin@startup.io',
  pseudo: 'kevin_ninja',
  role: 'USER',
  locale: 'fr',
  hasPassword: true,
  hasGithub: false,
  createdAt: '2026-10-06T10:00:00.000Z',
};

type Handler = (init?: RequestInit) => Response;

/** Faux serveur : associe "MÉTHODE /chemin" à une réponse. */
function mockApi(routes: Record<string, Handler>) {
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const key = `${init?.method ?? 'GET'} ${String(input)}`;
    const handler = routes[key];
    return handler
      ? handler(init)
      : Response.json({ error: { code: 'UNAUTHORIZED', message: '' } }, { status: 401 });
  });
  vi.stubGlobal('fetch', fetchMock);
  return fetchMock;
}

beforeEach(async () => {
  useSession.setState({ status: 'loading', user: null, error: null, githubEnabled: false });
  await i18n.changeLanguage('fr');
});

afterEach(() => {
  vi.unstubAllGlobals();
});

/** Ouvre la fenêtre de connexion depuis le coin du compte. */
async function openAccount() {
  await userEvent.click(await screen.findByRole('button', { name: /Connexion/ }));
}

describe('App', () => {
  it('affiche le formulaire de connexion à un visiteur', async () => {
    mockApi({
      'GET /api/auth/providers': () => Response.json({ password: true, github: true }),
    });
    render(<App />);

    await openAccount();
    expect(screen.getByRole('dialog', { name: 'Compte' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Se connecter' })).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: 'Open Space Simulator 2026' })).toBeInTheDocument();
    expect(await screen.findByRole('link', { name: 'Continuer avec GitHub' })).toHaveAttribute(
      'href',
      '/api/auth/github',
    );
  });

  it('connecte le joueur puis affiche son pseudo', async () => {
    const fetchMock = mockApi({
      'POST /api/auth/login': () => Response.json({ user }),
    });
    render(<App />);

    await openAccount();
    await userEvent.type(screen.getByLabelText('Email'), 'kevin@startup.io');
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'ninja-du-code');
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByText('Bienvenue, kevin_ninja !')).toBeInTheDocument();
    const loginCall = fetchMock.mock.calls.find(([url]) => url === '/api/auth/login');
    expect(JSON.parse(String(loginCall?.[1]?.body))).toEqual({
      email: 'kevin@startup.io',
      password: 'ninja-du-code',
    });
  });

  it('affiche une erreur traduite si les identifiants sont faux', async () => {
    mockApi({
      'POST /api/auth/login': () =>
        Response.json({ error: { code: 'INVALID_CREDENTIALS', message: 'x' } }, { status: 401 }),
    });
    render(<App />);

    await openAccount();
    await userEvent.type(screen.getByLabelText('Email'), 'kevin@startup.io');
    await userEvent.type(screen.getByLabelText('Mot de passe'), 'mauvais');
    await userEvent.click(screen.getByRole('button', { name: 'Se connecter' }));

    expect(await screen.findByRole('alert')).toHaveTextContent('Email ou mot de passe incorrect.');
  });

  it('inscrit un joueur avec la langue courante', async () => {
    const fetchMock = mockApi({
      'POST /api/auth/register': () => Response.json({ user }, { status: 201 }),
    });
    render(<App />);

    await openAccount();
    await userEvent.click(screen.getByRole('tab', { name: 'Inscription' }));
    await userEvent.type(screen.getByLabelText('Email'), 'kevin@startup.io');
    await userEvent.type(screen.getByLabelText(/Pseudo/), 'kevin_ninja');
    await userEvent.type(screen.getByLabelText(/Mot de passe/), 'ninja-du-code');
    await userEvent.click(screen.getByRole('button', { name: 'Créer mon compte' }));

    expect(await screen.findByText('Bienvenue, kevin_ninja !')).toBeInTheDocument();
    // Connecté : la fenêtre se ferme toute seule.
    expect(screen.queryByRole('dialog')).not.toBeInTheDocument();
    const call = fetchMock.mock.calls.find(([url]) => url === '/api/auth/register');
    expect(JSON.parse(String(call?.[1]?.body))).toMatchObject({ locale: 'fr' });
  });

  it('restaure une session existante et permet de se déconnecter', async () => {
    mockApi({
      'GET /api/me': () => Response.json({ user }),
      'POST /api/auth/logout': () => Response.json({ ok: true }),
    });
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: 'Se déconnecter' }));
    expect(await screen.findByRole('button', { name: /Connexion/ })).toBeInTheDocument();
  });

  it('change de langue', async () => {
    mockApi({});
    render(<App />);

    await userEvent.click(await screen.findByRole('button', { name: 'English' }));
    expect(await screen.findByRole('button', { name: /Sign in/ })).toBeInTheDocument();
    expect(document.documentElement.lang).toBe('en');
    expect(screen.getByRole('button', { name: 'English' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('propose de jouer en Facile au premier lancement', async () => {
    mockApi({});
    render(<App />);
    expect(
      await screen.findByRole('button', { name: /Jouer.*Nouvelle partie en mode Facile/ }),
    ).toBeInTheDocument();
    expect(
      screen.getAllByRole('button', { name: /Facile|Normal|Hardcore/ }).length,
    ).toBeGreaterThan(3);
  });

  it('ouvre les options depuis le menu, sans les actions de partie', async () => {
    mockApi({});
    render(<App />);
    await userEvent.click(await screen.findByRole('button', { name: /Options/ }));
    expect(screen.getByRole('heading', { level: 1, name: 'Options' })).toBeInTheDocument();
    expect(screen.getByText('Qualité graphique')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Quitter la partie' })).not.toBeInTheDocument();
  });

  it('affiche l’erreur renvoyée par le retour GitHub', async () => {
    window.history.pushState(null, '', '/?authError=OAUTH_FAILED');
    mockApi({});
    render(<App />);

    // L'erreur ouvre d'elle-même la fenêtre de connexion.
    expect(await screen.findByRole('alert')).toHaveTextContent('La connexion GitHub a échoué.');
    expect(screen.getByRole('dialog', { name: 'Compte' })).toBeInTheDocument();
    expect(window.location.search).toBe('');
  });
});
