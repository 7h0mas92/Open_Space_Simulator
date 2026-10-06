import { ApiErrorSchema } from '@oss/shared';

/** Réponses d'erreur communes, déclarées dans les schémas de route pour la doc OpenAPI. */
export const errorResponses = {
  400: ApiErrorSchema,
  401: ApiErrorSchema,
  403: ApiErrorSchema,
  404: ApiErrorSchema,
  409: ApiErrorSchema,
  429: ApiErrorSchema,
  500: ApiErrorSchema,
} as const;
