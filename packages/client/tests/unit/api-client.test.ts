import { z } from 'zod';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { ApiRequestError, apiRequest } from '../../src/api/client';

const schema = z.object({ value: z.number() });
const json = (body: unknown, status = 200) => Response.json(body, { status });

afterEach(() => {
  vi.unstubAllGlobals();
});

describe('apiRequest', () => {
  it('valide et renvoie la réponse', async () => {
    const fetchMock = vi.fn(async () => json({ value: 42 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiRequest('/test', { schema })).resolves.toEqual({ value: 42 });
    expect(fetchMock).toHaveBeenCalledWith(
      '/api/test',
      expect.objectContaining({ method: 'GET', credentials: 'include' }),
    );
  });

  it('transforme le format d’erreur de l’API en ApiRequestError', async () => {
    vi.stubGlobal('fetch', async () =>
      json({ error: { code: 'EMAIL_TAKEN', message: 'Déjà pris' } }, 409),
    );
    const error = await apiRequest('/test', { schema }).catch((caught: unknown) => caught);
    expect(error).toBeInstanceOf(ApiRequestError);
    expect(error).toMatchObject({ status: 409, code: 'EMAIL_TAKEN' });
  });

  it('rafraîchit la session puis rejoue la requête après un 401', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ error: { code: 'UNAUTHORIZED', message: '' } }, 401))
      .mockResolvedValueOnce(json({ user: {} }))
      .mockResolvedValueOnce(json({ value: 1 }));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiRequest('/test', { schema })).resolves.toEqual({ value: 1 });
    expect(fetchMock.mock.calls.map(([url]) => url)).toEqual([
      '/api/test',
      '/api/auth/refresh',
      '/api/test',
    ]);
  });

  it('abandonne si le rafraîchissement échoue', async () => {
    const fetchMock = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(json({ error: { code: 'UNAUTHORIZED', message: '' } }, 401))
      .mockResolvedValueOnce(json({ error: { code: 'INVALID_REFRESH_TOKEN', message: '' } }, 401));
    vi.stubGlobal('fetch', fetchMock);

    await expect(apiRequest('/test', { schema })).rejects.toMatchObject({ code: 'UNAUTHORIZED' });
    expect(fetchMock).toHaveBeenCalledTimes(2);
  });

  it('signale un serveur injoignable', async () => {
    vi.stubGlobal('fetch', async () => {
      throw new TypeError('Failed to fetch');
    });
    await expect(apiRequest('/test', { schema })).rejects.toMatchObject({ code: 'NETWORK_ERROR' });
  });

  it('traite une réponse qui ne vient pas du serveur du jeu comme un serveur injoignable', async () => {
    vi.stubGlobal('fetch', async () => new Response('<h1>404</h1>', { status: 404 }));
    await expect(apiRequest('/test', { schema })).rejects.toMatchObject({
      status: 404,
      code: 'NETWORK_ERROR',
    });
  });

  it('refuse une réponse qui ne respecte pas le schéma', async () => {
    vi.stubGlobal('fetch', async () => json({ value: 'pas un nombre' }));
    await expect(apiRequest('/test', { schema })).rejects.toThrow();
  });
});
