import { PrismaPg } from '@prisma/adapter-pg';
import { PrismaClient } from '../generated/prisma/client.js';

/** Modes SSL que le driver `pg` interprète aujourd'hui comme `verify-full`. */
const LIBPQ_SSL_MODES = new Set(['prefer', 'require', 'verify-ca']);

/**
 * Donne à `sslmode` le sens standard de PostgreSQL (libpq), comme le fait la CLI Prisma.
 *
 * Le driver `pg` traite `sslmode=require` comme `verify-full` : il refuse alors le certificat
 * de Supabase, signé par sa propre autorité, avec « self-signed certificate in certificate
 * chain ». Avec `uselibpqcompat=true`, `require` chiffre la connexion sans vérifier
 * l'autorité, ce qui est le comportement attendu par les URL que donne Supabase.
 * Une URL sans `sslmode` (base locale) ou en `verify-full` n'est pas modifiée.
 */
export function withLibpqSslMode(databaseUrl: string): string {
  let url: URL;
  try {
    url = new URL(databaseUrl);
  } catch {
    return databaseUrl;
  }
  const mode = url.searchParams.get('sslmode');
  if (!mode || !LIBPQ_SSL_MODES.has(mode) || url.searchParams.has('uselibpqcompat')) {
    return databaseUrl;
  }
  url.searchParams.set('uselibpqcompat', 'true');
  return url.toString();
}

/** Crée un client Prisma connecté à PostgreSQL via le driver `pg`. */
export function createPrismaClient(databaseUrl: string): PrismaClient {
  return new PrismaClient({
    adapter: new PrismaPg({ connectionString: withLibpqSslMode(databaseUrl) }),
  });
}

export type { PrismaClient };
