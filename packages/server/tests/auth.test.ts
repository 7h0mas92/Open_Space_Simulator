import type { FastifyInstance } from 'fastify';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { cookiesOf, createTestApp, registerUser, validUser } from './helpers.js';

let app: FastifyInstance;

beforeEach(async () => {
  app = await createTestApp();
});

afterEach(async () => {
  await app.close();
});

describe('POST /api/auth/register', () => {
  it('crée le compte, hache le mot de passe et ouvre une session', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { ...validUser, email: 'Kevin@Startup.IO', locale: 'en' },
    });

    expect(response.statusCode).toBe(201);
    expect(response.json().user).toMatchObject({
      email: 'kevin@startup.io',
      pseudo: 'kevin_ninja',
      role: 'USER',
      locale: 'en',
      hasPassword: true,
      hasGithub: false,
    });
    expect(response.body).not.toContain('passwordHash');

    const access = response.cookies.find((cookie) => cookie.name === 'access_token');
    const refresh = response.cookies.find((cookie) => cookie.name === 'refresh_token');
    expect(access).toMatchObject({ httpOnly: true, sameSite: 'Lax', path: '/' });
    expect(refresh).toMatchObject({ httpOnly: true, path: '/api/auth' });

    const stored = await app.prisma.user.findUniqueOrThrow({
      where: { email: 'kevin@startup.io' },
    });
    expect(stored.passwordHash).toMatch(/^\$argon2id\$/);
  });

  it('refuse un email déjà utilisé', async () => {
    await registerUser(app);
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { ...validUser, pseudo: 'autre_pseudo' },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json()).toEqual({
      error: { code: 'EMAIL_TAKEN', message: expect.any(String) },
    });
  });

  it('refuse un pseudo déjà utilisé', async () => {
    await registerUser(app);
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { ...validUser, email: 'autre@startup.io' },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('PSEUDO_TAKEN');
  });

  it('renvoie une erreur de validation au format homogène', async () => {
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/register',
      payload: { email: 'pas-un-email', password: '123', pseudo: 'x' },
    });
    expect(response.statusCode).toBe(400);
    const { error } = response.json();
    expect(error.code).toBe('VALIDATION_ERROR');
    expect(error.message).toContain('email');
    expect(error.message).toContain('password');
  });
});

describe('POST /api/auth/login', () => {
  it('connecte avec les bons identifiants', async () => {
    await registerUser(app);
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: validUser.email, password: validUser.password },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().user.pseudo).toBe(validUser.pseudo);
    expect(cookiesOf(response)).toHaveProperty('access_token');
  });

  it.each([
    ['mauvais mot de passe', validUser.email, 'mauvais-mot-de-passe'],
    ['email inconnu', 'inconnu@startup.io', validUser.password],
  ])('refuse un %s sans révéler si le compte existe', async (_case, email, password) => {
    await registerUser(app);
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email, password },
    });
    expect(response.statusCode).toBe(401);
    expect(response.json().error).toEqual({
      code: 'INVALID_CREDENTIALS',
      message: 'Email ou mot de passe incorrect',
    });
  });
});

describe('GET /api/me', () => {
  it('renvoie l’utilisateur connecté', async () => {
    const cookies = await registerUser(app);
    const response = await app.inject({ method: 'GET', url: '/api/me', cookies });
    expect(response.statusCode).toBe(200);
    expect(response.json().user.email).toBe(validUser.email);
  });

  it('exige une session', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/me' });
    expect(response.statusCode).toBe(401);
    expect(response.json().error.code).toBe('UNAUTHORIZED');
  });

  it('refuse un JWT falsifié', async () => {
    const response = await app.inject({
      method: 'GET',
      url: '/api/me',
      cookies: { access_token: 'eyJhbGciOiJub25lIn0.eyJzdWIiOiJ4In0.' },
    });
    expect(response.statusCode).toBe(401);
  });

  it('permet de changer de langue et de pseudo', async () => {
    const cookies = await registerUser(app);
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/me',
      cookies,
      payload: { locale: 'en', pseudo: 'senior_barbu' },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json().user).toMatchObject({ locale: 'en', pseudo: 'senior_barbu' });
  });

  it('refuse un pseudo déjà pris', async () => {
    await registerUser(app, { email: 'autre@startup.io', pseudo: 'senior_barbu' });
    const cookies = await registerUser(app);
    const response = await app.inject({
      method: 'PATCH',
      url: '/api/me',
      cookies,
      payload: { pseudo: 'senior_barbu' },
    });
    expect(response.statusCode).toBe(409);
    expect(response.json().error.code).toBe('PSEUDO_TAKEN');
  });
});

describe('POST /api/auth/refresh', () => {
  it('fait tourner le refresh token', async () => {
    const cookies = await registerUser(app);
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      cookies: { refresh_token: cookies.refresh_token! },
    });
    expect(response.statusCode).toBe(200);
    const renewed = cookiesOf(response);
    expect(renewed.refresh_token).toBeDefined();
    expect(renewed.refresh_token).not.toBe(cookies.refresh_token);
    expect(renewed.access_token).toBeDefined();
  });

  it('révoque toute la session si un ancien refresh token est réutilisé', async () => {
    const cookies = await registerUser(app);
    const first = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      cookies: { refresh_token: cookies.refresh_token! },
    });
    const stolenReuse = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      cookies: { refresh_token: cookies.refresh_token! },
    });
    expect(stolenReuse.statusCode).toBe(401);
    expect(stolenReuse.json().error.code).toBe('INVALID_REFRESH_TOKEN');

    // Le jeton légitime obtenu juste avant est lui aussi révoqué.
    const legit = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      cookies: { refresh_token: cookiesOf(first).refresh_token! },
    });
    expect(legit.statusCode).toBe(401);
  });

  it('refuse un refresh token expiré', async () => {
    const cookies = await registerUser(app);
    await app.prisma.refreshToken.updateMany({ data: { expiresAt: new Date(Date.now() - 1000) } });
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      cookies: { refresh_token: cookies.refresh_token! },
    });
    expect(response.statusCode).toBe(401);
  });

  it('refuse une requête sans cookie', async () => {
    const response = await app.inject({ method: 'POST', url: '/api/auth/refresh' });
    expect(response.statusCode).toBe(401);
  });
});

describe('POST /api/auth/logout', () => {
  it('révoque le refresh token et efface les cookies', async () => {
    const cookies = await registerUser(app);
    const response = await app.inject({
      method: 'POST',
      url: '/api/auth/logout',
      cookies: { refresh_token: cookies.refresh_token! },
    });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toEqual({ ok: true });
    const cleared = response.cookies.find((cookie) => cookie.name === 'access_token');
    expect(cleared?.value).toBe('');

    const refresh = await app.inject({
      method: 'POST',
      url: '/api/auth/refresh',
      cookies: { refresh_token: cookies.refresh_token! },
    });
    expect(refresh.statusCode).toBe(401);
  });
});

describe('Rôles', () => {
  it('interdit le back-office à un USER', async () => {
    const cookies = await registerUser(app);
    const response = await app.inject({ method: 'GET', url: '/api/admin/ping', cookies });
    expect(response.statusCode).toBe(403);
    expect(response.json().error.code).toBe('FORBIDDEN');
  });

  it('autorise le back-office à un ADMIN', async () => {
    await registerUser(app);
    await app.prisma.user.update({ where: { email: validUser.email }, data: { role: 'ADMIN' } });
    // Le rôle est inscrit dans le JWT : il faut se reconnecter pour en profiter.
    const login = await app.inject({
      method: 'POST',
      url: '/api/auth/login',
      payload: { email: validUser.email, password: validUser.password },
    });
    const response = await app.inject({
      method: 'GET',
      url: '/api/admin/ping',
      cookies: { access_token: cookiesOf(login).access_token! },
    });
    expect(response.statusCode).toBe(200);
  });

  it('exige une session pour le back-office', async () => {
    const response = await app.inject({ method: 'GET', url: '/api/admin/ping' });
    expect(response.statusCode).toBe(401);
  });
});
