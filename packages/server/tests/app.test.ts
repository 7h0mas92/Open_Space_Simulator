import type { FastifyInstance } from 'fastify';
import { afterEach, describe, expect, it } from 'vitest';
import { loadEnv } from '../src/config/env.js';
import { createTestApp } from './helpers.js';

let app: FastifyInstance;
afterEach(async () => {
  await app?.close();
});

describe('Infrastructure', () => {
  it('répond sur /api/health avec l’état de la base', async () => {
    app = await createTestApp();
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    expect(response.statusCode).toBe(200);
    expect(response.json()).toMatchObject({ status: 'ok', database: 'up' });
  });

  it('renvoie 404 au format homogène', async () => {
    app = await createTestApp();
    const response = await app.inject({ method: 'GET', url: '/api/inexistant' });
    expect(response.statusCode).toBe(404);
    expect(response.json()).toEqual({
      error: { code: 'NOT_FOUND', message: 'Route GET /api/inexistant introuvable' },
    });
  });

  it('ajoute les en-têtes de sécurité Helmet', async () => {
    app = await createTestApp();
    const response = await app.inject({ method: 'GET', url: '/api/health' });
    expect(response.headers['x-content-type-options']).toBe('nosniff');
    expect(response.headers['content-security-policy']).toBeDefined();
  });

  it('autorise CORS uniquement pour le client', async () => {
    app = await createTestApp({ CLIENT_URL: 'https://jeu.example' });
    const allowed = await app.inject({
      method: 'OPTIONS',
      url: '/api/auth/login',
      headers: { origin: 'https://jeu.example', 'access-control-request-method': 'POST' },
    });
    expect(allowed.headers['access-control-allow-origin']).toBe('https://jeu.example');
    expect(allowed.headers['access-control-allow-credentials']).toBe('true');

    const denied = await app.inject({
      method: 'OPTIONS',
      url: '/api/auth/login',
      headers: { origin: 'https://pirate.example', 'access-control-request-method': 'POST' },
    });
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('limite le nombre de tentatives de connexion', async () => {
    app = await createTestApp({ AUTH_RATE_LIMIT_MAX: '2' });
    const attempt = () =>
      app.inject({
        method: 'POST',
        url: '/api/auth/login',
        payload: { email: 'a@b.io', password: 'x' },
      });
    await attempt();
    await attempt();
    const blocked = await attempt();
    expect(blocked.statusCode).toBe(429);
    expect(blocked.json().error.code).toBe('RATE_LIMITED');
  });

  it('expose la documentation OpenAPI', async () => {
    app = await createTestApp();
    const response = await app.inject({ method: 'GET', url: '/docs/json' });
    expect(response.statusCode).toBe(200);
    const spec = response.json();
    expect(spec.openapi).toMatch(/^3\./);
    expect(Object.keys(spec.paths)).toEqual(
      expect.arrayContaining(['/api/auth/register', '/api/auth/login', '/api/me/']),
    );
  });
});

describe('Configuration', () => {
  const base = {
    DATABASE_URL: 'postgresql://oss:oss@localhost:5432/oss',
    JWT_SECRET: 'x'.repeat(32),
  };

  it('applique les valeurs par défaut', () => {
    const env = loadEnv(base);
    expect(env.PORT).toBe(3000);
    expect(env.CORS_ORIGINS).toEqual(['http://localhost:5173']);
    expect(env.COOKIE_SECURE).toBe(false);
    expect(env.GITHUB_CALLBACK_URL).toBe('http://localhost:5173/api/auth/github/callback');
  });

  it('active les cookies Secure en production', () => {
    expect(loadEnv({ ...base, NODE_ENV: 'production' }).COOKIE_SECURE).toBe(true);
  });

  it('refuse un secret JWT trop court', () => {
    expect(() => loadEnv({ ...base, JWT_SECRET: 'court' })).toThrow(/JWT_SECRET/);
  });
});
