import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { cookiesOf, createTestApp, registerUser, validUser } from './helpers.js';

const githubEnv = {
  GITHUB_CLIENT_ID: 'client-id',
  GITHUB_CLIENT_SECRET: 'client-secret',
  CLIENT_URL: 'http://localhost:5173',
};

interface FakeGithubProfile {
  id: number;
  login: string;
  emails?: { email: string; primary: boolean; verified: boolean }[];
}

/** Simule les trois appels faits à GitHub pendant le callback OAuth. */
function fakeGithub(profile: FakeGithubProfile, { tokenOk = true } = {}) {
  return vi.fn<typeof fetch>(async (input) => {
    const url = String(input);
    if (url.includes('/login/oauth/access_token')) {
      return Response.json(
        tokenOk ? { access_token: 'gho_fake' } : { error: 'bad_verification_code' },
      );
    }
    if (url.endsWith('/user')) return Response.json({ id: profile.id, login: profile.login });
    if (url.endsWith('/user/emails')) return Response.json(profile.emails ?? []);
    return new Response('not found', { status: 404 });
  });
}

let app: FastifyInstance;
afterEach(async () => {
  await app.close();
});

/** Démarre le flux OAuth puis revient sur le callback avec un état valide. */
async function loginWithGithub(app: FastifyInstance, code = 'code-github') {
  const start = await app.inject({ method: 'GET', url: '/api/auth/github' });
  const location = new URL(start.headers.location!);
  const state = location.searchParams.get('state')!;
  return app.inject({
    method: 'GET',
    url: `/api/auth/github/callback?code=${code}&state=${state}`,
    cookies: { oauth_state: cookiesOf(start).oauth_state! },
  });
}

describe('Connexion GitHub', () => {
  it('signale quand GitHub n’est pas configuré', async () => {
    app = await createTestApp();
    const providers = await app.inject({ method: 'GET', url: '/api/auth/providers' });
    expect(providers.json()).toEqual({ password: true, github: false });

    const start = await app.inject({ method: 'GET', url: '/api/auth/github' });
    expect(start.statusCode).toBe(503);
    expect(start.json().error.code).toBe('OAUTH_NOT_CONFIGURED');
  });

  it('redirige vers GitHub avec un état anti-CSRF', async () => {
    app = await createTestApp(githubEnv);
    const response = await app.inject({ method: 'GET', url: '/api/auth/github' });
    expect(response.statusCode).toBe(302);
    const location = new URL(response.headers.location!);
    expect(location.origin).toBe('https://github.com');
    expect(location.searchParams.get('client_id')).toBe('client-id');
    expect(location.searchParams.get('redirect_uri')).toBe(
      'http://localhost:5173/api/auth/github/callback',
    );
    expect(location.searchParams.get('state')).toBeTruthy();
    expect(cookiesOf(response).oauth_state).toBeTruthy();
  });

  it('crée un compte au premier retour de GitHub', async () => {
    const fetchMock = fakeGithub({
      id: 42,
      login: 'octocat',
      emails: [{ email: 'Octo@GitHub.com', primary: true, verified: true }],
    });
    app = await createTestApp(githubEnv, { fetch: fetchMock });

    const response = await loginWithGithub(app);

    expect(response.statusCode).toBe(302);
    expect(response.headers.location).toBe('http://localhost:5173/?login=github');
    const cookies = cookiesOf(response);
    expect(cookies.access_token).toBeTruthy();

    const me = await app.inject({ method: 'GET', url: '/api/me', cookies });
    expect(me.json().user).toMatchObject({
      pseudo: 'octocat',
      email: 'octo@github.com',
      hasGithub: true,
      hasPassword: false,
    });
  });

  it('reconnecte le même compte au retour suivant', async () => {
    app = await createTestApp(githubEnv, { fetch: fakeGithub({ id: 42, login: 'octocat' }) });
    await loginWithGithub(app);
    await loginWithGithub(app);
    expect(await app.prisma.user.count()).toBe(1);
  });

  it('lie GitHub à un compte existant ayant le même email vérifié', async () => {
    app = await createTestApp(githubEnv, {
      fetch: fakeGithub({
        id: 7,
        login: 'kevin',
        emails: [{ email: validUser.email, primary: true, verified: true }],
      }),
    });
    await registerUser(app);
    await loginWithGithub(app);

    const user = await app.prisma.user.findUniqueOrThrow({ where: { email: validUser.email } });
    expect(user.githubId).toBe('7');
    expect(await app.prisma.user.count()).toBe(1);
  });

  it('ne lie pas un email non vérifié et choisit un pseudo libre', async () => {
    app = await createTestApp(githubEnv, {
      fetch: fakeGithub({
        id: 8,
        login: 'kevin_ninja',
        emails: [{ email: validUser.email, primary: true, verified: false }],
      }),
    });
    await registerUser(app);
    await loginWithGithub(app);

    const created = await app.prisma.user.findUniqueOrThrow({ where: { githubId: '8' } });
    expect(created.email).toBeNull();
    expect(created.pseudo).toBe('kevin_ninja-2');
  });

  it('rejette un état OAuth falsifié', async () => {
    const fetchMock = fakeGithub({ id: 42, login: 'octocat' });
    app = await createTestApp(githubEnv, { fetch: fetchMock });
    const start = await app.inject({ method: 'GET', url: '/api/auth/github' });
    const response = await app.inject({
      method: 'GET',
      url: '/api/auth/github/callback?code=abc&state=etat-pirate',
      cookies: { oauth_state: cookiesOf(start).oauth_state! },
    });
    expect(response.headers.location).toBe('http://localhost:5173/?authError=OAUTH_FAILED');
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it('redirige avec une erreur si GitHub refuse le code', async () => {
    app = await createTestApp(githubEnv, {
      fetch: fakeGithub({ id: 42, login: 'octocat' }, { tokenOk: false }),
    });
    const response = await loginWithGithub(app);
    expect(response.headers.location).toBe('http://localhost:5173/?authError=OAUTH_FAILED');
    expect(await app.prisma.user.count()).toBe(0);
  });
});
