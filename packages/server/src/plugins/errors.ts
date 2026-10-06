import type { ApiError, ErrorCode } from '@oss/shared';
import type { FastifyError, FastifyInstance } from 'fastify';
import fp from 'fastify-plugin';
import { hasZodFastifySchemaValidationErrors } from 'fastify-type-provider-zod';
import { AppError } from '../lib/errors.js';

function codeForStatus(statusCode: number): ErrorCode {
  switch (statusCode) {
    case 401:
      return 'UNAUTHORIZED';
    case 403:
      return 'FORBIDDEN';
    case 404:
      return 'NOT_FOUND';
    case 409:
      return 'CONFLICT';
    case 413:
      return 'PAYLOAD_TOO_LARGE';
    case 429:
      return 'RATE_LIMITED';
    default:
      return 'VALIDATION_ERROR';
  }
}

function body(code: ErrorCode, message: string): ApiError {
  return { error: { code, message } };
}

/** Garantit le format d'erreur homogène { error: { code, message } } sur toute l'API. */
export const errorsPlugin = fp(async (app: FastifyInstance) => {
  app.setErrorHandler((error: FastifyError | AppError, request, reply) => {
    if (error instanceof AppError) {
      return reply.status(error.statusCode).send(body(error.code, error.message));
    }

    if (hasZodFastifySchemaValidationErrors(error)) {
      const message = error.validation
        .map((issue) => {
          const field = issue.instancePath.replace(/^\//, '').replaceAll('/', '.');
          return field ? `${field}: ${issue.message}` : issue.message;
        })
        .join(' ; ');
      return reply.status(400).send(body('VALIDATION_ERROR', message));
    }

    const statusCode = error.statusCode ?? 500;
    if (statusCode < 500) {
      return reply.status(statusCode).send(body(codeForStatus(statusCode), error.message));
    }

    // Erreur inattendue : on journalise le détail mais on ne l'expose pas au client.
    request.log.error({ err: error }, 'Erreur interne');
    return reply.status(500).send(body('INTERNAL_ERROR', 'Erreur interne du serveur'));
  });

  app.setNotFoundHandler((request, reply) => {
    return reply
      .status(404)
      .send(body('NOT_FOUND', `Route ${request.method} ${request.url} introuvable`));
  });
});
