-- Sécurité ligne par ligne (RLS) sur toutes les tables du schéma.
--
-- Pourquoi : la base de production est hébergée sur Supabase, qui expose automatiquement le
-- schéma `public` en API REST (Data API) à quiconque possède la clé publique du projet. Sans
-- RLS, cette API pourrait lire la table "User" (hachés de mots de passe) ou modifier les scores.
-- Avec RLS activé et aucune politique, l'API ne voit plus aucune ligne.
--
-- Le serveur Fastify n'est pas concerné : il se connecte avec le rôle propriétaire des tables
-- (`postgres` sur Supabase, `oss` en local), qui n'est pas soumis à la RLS.
-- Sur un PostgreSQL ordinaire (docker compose, CI), la commande est sans effet visible.
--
-- Toute nouvelle table devra faire de même : le test `tests/rls.test.ts` le vérifie.
DO $$
DECLARE
  t record;
BEGIN
  FOR t IN SELECT tablename FROM pg_tables WHERE schemaname = current_schema() LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', t.tablename);
  END LOOP;
END $$;
