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
