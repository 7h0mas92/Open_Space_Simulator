import type { ErrorCode } from '@oss/shared';

/**
 * Erreur métier levée par les routes et services.
 * Le gestionnaire d'erreurs global la transforme en { error: { code, message } }.
 */
export class AppError extends Error {
  constructor(
    public readonly statusCode: number,
    public readonly code: ErrorCode,
    message: string,
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export const unauthorized = (message = 'Connexion requise pour cette action') =>
  new AppError(401, 'UNAUTHORIZED', message);

export const forbidden = (message = 'Accès refusé pour ce compte') =>
  new AppError(403, 'FORBIDDEN', message);
