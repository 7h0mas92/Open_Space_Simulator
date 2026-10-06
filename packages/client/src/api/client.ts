import { ApiErrorSchema, type ErrorCode } from '@oss/shared';
import type { z } from 'zod';

/** Code d'erreur de l'API, plus NETWORK_ERROR quand le serveur est injoignable. */
export type ClientErrorCode = ErrorCode | 'NETWORK_ERROR';

/** Erreur typée levée par le client HTTP. Le code sert à afficher un message traduit. */
export class ApiRequestError extends Error {
  constructor(
    public readonly status: number,
    public readonly code: ClientErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'ApiRequestError';
  }
}

interface RequestOptions<T> {
  method?: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';
  body?: unknown;
  /** Schéma Zod de la réponse : les données reçues sont validées avant d'être utilisées. */
  schema: z.ZodType<T>;
  /** Tenter un rafraîchissement de session si l'API répond 401 (par défaut : oui). */
  retryOnUnauthorized?: boolean;
}

const API_BASE = '/api';

async function send(path: string, method: string, body: unknown): Promise<Response> {
  try {
    return await fetch(`${API_BASE}${path}`, {
      method,
      credentials: 'include', // envoie les cookies httpOnly de session
      headers: body === undefined ? {} : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiRequestError(0, 'NETWORK_ERROR', 'Serveur injoignable');
  }
}

/** Un seul rafraîchissement à la fois, même si plusieurs requêtes échouent ensemble. */
let refreshing: Promise<boolean> | undefined;
function refreshSession(): Promise<boolean> {
  refreshing ??= send('/auth/refresh', 'POST', undefined)
    .then((response) => response.ok)
    .catch(() => false)
    .finally(() => {
      refreshing = undefined;
    });
  return refreshing;
}

/**
 * Appel typé à l'API. Si le JWT d'accès a expiré (401), on rafraîchit la session
 * une fois grâce au refresh token puis on rejoue la requête.
 */
export async function apiRequest<T>(path: string, options: RequestOptions<T>): Promise<T> {
  const { method = 'GET', body, schema, retryOnUnauthorized = true } = options;
  let response = await send(path, method, body);

  if (response.status === 401 && retryOnUnauthorized && (await refreshSession())) {
    response = await send(path, method, body);
  }

  const json: unknown = await response.json().catch(() => null);
  if (!response.ok) {
    const parsed = ApiErrorSchema.safeParse(json);
    throw parsed.success
      ? new ApiRequestError(response.status, parsed.data.error.code, parsed.data.error.message)
      : new ApiRequestError(response.status, 'INTERNAL_ERROR', `HTTP ${response.status}`);
  }
  return schema.parse(json);
}
