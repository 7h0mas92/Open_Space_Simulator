import { afterAll, describe, expect, it } from 'vitest';
import { createPrismaClient } from '../src/lib/prisma.js';
import { TEST_DATABASE_URL } from './test-database.js';

// En production, la base est sur Supabase, qui expose le schéma `public` en API REST.
// Chaque table doit donc avoir la sécurité ligne par ligne (RLS) activée, sinon cette API
// publique pourrait la lire. Voir la migration `row_level_security`.
const prisma = createPrismaClient(TEST_DATABASE_URL);

afterAll(async () => {
  await prisma.$disconnect();
});

describe('sécurité ligne par ligne', () => {
  it('est activée sur toutes les tables, migrations comprises', async () => {
    const tables = await prisma.$queryRaw<{ name: string; rls: boolean }[]>`
      SELECT c.relname AS name, c.relrowsecurity AS rls
      FROM pg_class c
      JOIN pg_namespace n ON n.oid = c.relnamespace
      WHERE n.nspname = current_schema() AND c.relkind = 'r'
      ORDER BY c.relname`;
    expect(tables.length).toBeGreaterThan(10);
    expect(tables.filter((table) => !table.rls).map((table) => table.name)).toEqual([]);
  });
});
