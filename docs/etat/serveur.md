# État d'avancement : Serveur, base de données, déploiement, reste à faire

> Fonctionnalités livrées dans `develop` (anciennement « ÉTAT D'AVANCEMENT » de `CLAUDE.md`). Ajouter une puce ici à chaque fusion. Index : [`CLAUDE.md`](../../CLAUDE.md).

- Base de production sur Supabase (projet `open-space-simulator`, offre gratuite,
  `eu-central-1`) : simple PostgreSQL hébergé derrière Prisma, sans auth ni SDK Supabase. Toutes
  les migrations y sont appliquées et notées dans `_prisma_migrations`. Migration
  `row_level_security` : RLS sur toutes les tables, sans politique, pour que l'API REST publique
  de Supabase ne lise rien (le serveur, propriétaire des tables, n'est pas concerné) ; toute
  nouvelle table l'active aussi (`tests/rls.test.ts`). `DATABASE_URL` = URL du _Session pooler_
  (5432, IPv4) + `?sslmode=require` ; `createPrismaClient` ajoute `uselibpqcompat=true` pour que
  `pg` accepte le certificat de Supabase (`withLibpqSslMode`, `src/lib/prisma.ts`). `render.yaml`
  ne crée plus de base Render. En local, docker compose ne change pas.

- Mise en production du 3 novembre 2026 (PR #166, T6) : `develop` (PR #123 à #165) fusionné dans
  `main` en merge commit ; migration `endless_mode` appliquée sur Supabase au démarrage de Render.
  Vercel, Render et GitHub Pages servent désormais tout ce qui précède.

## Reste à faire

- Connexion GitHub : créer l'application GitHub OAuth (callback
  `https://open-space-simulator.vercel.app/api/auth/github/callback`) et mettre ses clés sur
  Render (étapes dans le README, section Déploiement). Le jeu avec comptes est en ligne sur
  https://open-space-simulator.vercel.app (serveur Render `https://oss-server-e90i.onrender.com`,
  base Supabase) ; la version invité reste sur https://7h0mas92.github.io/Open_Space_Simulator/.
  Les deux se redéploient à chaque fusion.
- Effets sonores et ambiance : le lecteur Howler est prêt (`audio/manifest.ts`), les fichiers
  restent à déposer (les bruits de clavier et de souris sont faits).

## Développement local

Développement local : `pnpm db:up`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm dev` (jeu sur
localhost:5173, API et Swagger sur localhost:3000/docs). Base : `pnpm --filter @oss/server
db:studio` (Prisma Studio sur localhost:5555) ou `docker compose exec db psql -U oss -d oss`. Production :
tableau de bord Supabase (Table Editor, SQL Editor).
Compte admin de développement créé par le seed : `admin@oss.local` / `admin-dev-password`.
