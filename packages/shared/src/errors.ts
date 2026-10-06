import { z } from 'zod';

/**
 * Codes d'erreur de l'API. Le client s'appuie sur le code (stable) et non sur
 * le message (lisible par un humain, peut changer).
 */
export const ERROR_CODES = [
  'VALIDATION_ERROR',
  'UNAUTHORIZED',
  'FORBIDDEN',
  'NOT_FOUND',
  'CONFLICT',
  'INVALID_CREDENTIALS',
  'EMAIL_TAKEN',
  'PSEUDO_TAKEN',
  'INVALID_REFRESH_TOKEN',
  'OAUTH_FAILED',
  'OAUTH_NOT_CONFIGURED',
  'RATE_LIMITED',
  'PAYLOAD_TOO_LARGE',
  'GAME_NOT_FINISHED',
  'REPLAY_REJECTED',
  'SCORE_MISMATCH',
  'UNKNOWN_CARDS_VERSION',
  'DAILY_INVALID',
  'DAILY_ALREADY_PLAYED',
  'AI_UNAVAILABLE',
  'AI_QUOTA_EXCEEDED',
  'INTERNAL_ERROR',
] as const;

export const ErrorCodeSchema = z.enum(ERROR_CODES);
export type ErrorCode = z.infer<typeof ErrorCodeSchema>;

/** Format d'erreur homogène renvoyé par toutes les routes : { error: { code, message } }. */
export const ApiErrorSchema = z.object({
  error: z.object({
    code: ErrorCodeSchema,
    message: z.string(),
  }),
});
export type ApiError = z.infer<typeof ApiErrorSchema>;
