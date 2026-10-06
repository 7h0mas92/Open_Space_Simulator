import { z } from 'zod';

/** Variable booléenne lue depuis l'environnement ("true" / "false"). */
const booleanFromEnv = z.enum(['true', 'false']).transform((value) => value === 'true');

/**
 * Schéma de toutes les variables d'environnement du serveur.
 * Le serveur refuse de démarrer si l'une d'elles est invalide (voir .env.example).
 */
export const EnvSchema = z
  .object({
    NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),
    HOST: z.string().default('0.0.0.0'),
    PORT: z.coerce.number().int().positive().default(3000),
    LOG_LEVEL: z
      .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace', 'silent'])
      .default('info'),

    DATABASE_URL: z.url(),

    /** Secret de signature des JWT d'accès (32 caractères minimum). */
    JWT_SECRET: z.string().min(32),
    ACCESS_TOKEN_TTL_SECONDS: z.coerce
      .number()
      .int()
      .positive()
      .default(15 * 60),
    REFRESH_TOKEN_TTL_DAYS: z.coerce.number().int().positive().default(30),
    /** En production, les cookies doivent être Secure (HTTPS). */
    COOKIE_SECURE: booleanFromEnv.optional(),

    /** URL publique du client : redirections OAuth et origine CORS par défaut. */
    CLIENT_URL: z.url().default('http://localhost:5173'),
    /** Origines CORS autorisées, séparées par des virgules. Par défaut : CLIENT_URL. */
    CORS_ORIGINS: z.string().optional(),

    RATE_LIMIT_MAX: z.coerce.number().int().positive().default(200),
    AUTH_RATE_LIMIT_MAX: z.coerce.number().int().positive().default(10),

    GITHUB_CLIENT_ID: z.string().optional(),
    GITHUB_CLIENT_SECRET: z.string().optional(),
    /** Par défaut : `${CLIENT_URL}/api/auth/github/callback` (via le proxy du client). */
    GITHUB_CALLBACK_URL: z.url().optional(),

    /** Slack piloté par l'IA (facultatif) : sans clé, le jeu utilise ses templates. */
    ANTHROPIC_API_KEY: z.string().min(1).optional(),
    ANTHROPIC_MODEL: z.string().min(1).default('claude-opus-5-5'),
    /** Appels à l'IA par joueur et par jour (les réponses en cache ne comptent pas). */
    AI_DAILY_QUOTA: z.coerce.number().int().min(0).default(40),
    /** Durée de vie du cache des réponses de l'IA, en secondes. */
    AI_CACHE_TTL_SECONDS: z.coerce.number().int().min(0).default(3600),
  })
  .transform((env) => ({
    ...env,
    COOKIE_SECURE: env.COOKIE_SECURE ?? env.NODE_ENV === 'production',
    CORS_ORIGINS: (env.CORS_ORIGINS ?? env.CLIENT_URL)
      .split(',')
      .map((origin) => origin.trim())
      .filter(Boolean),
    GITHUB_CALLBACK_URL: env.GITHUB_CALLBACK_URL ?? `${env.CLIENT_URL}/api/auth/github/callback`,
  }));

export type Env = z.infer<typeof EnvSchema>;

/** Valide `process.env` (ou un objet fourni par les tests) et renvoie une configuration typée. */
export function loadEnv(source: NodeJS.ProcessEnv = process.env): Env {
  const result = EnvSchema.safeParse(source);
  if (!result.success) {
    const details = result.error.issues
      .map((issue) => `  - ${issue.path.join('.')}: ${issue.message}`)
      .join('\n');
    throw new Error(`Configuration invalide :\n${details}`);
  }
  return result.data;
}
