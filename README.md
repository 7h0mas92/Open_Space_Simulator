# Open Space Simulator 2026

> « Ta startup a levé 2 millions. Tu as 18 mois avant que tout explose. Bonne chance. »

Jeu de gestion de startup jouable dans le navigateur, en 3D low-poly isométrique.
Le cahier des charges complet est dans [`docs/cahier-des-charges/`](./docs/cahier-des-charges/), la liste de tout ce qui est livré dans [`docs/etat/`](./docs/etat/), et l'index de la doc dans [`CLAUDE.md`](./CLAUDE.md).
Le relais entre les développeurs (travaux en cours, décisions en attente, journal des
passations) est dans [`CONTEXTE.md`](./CONTEXTE.md), mis à jour à la fin de chaque travail.
Le rôle et l'emplacement de chaque fichier du dépôt sont dans [`ARBORESCENCE.md`](./ARBORESCENCE.md).

**État actuel : jeu complet, prêt à déployer.** Socle, simulation, rendu 3D, interface,
événements, progression, méta-jeu (succès, modes, Daily, classements, replays vérifiés),
Slack simulé (templates ou IA), back-office, PWA hors ligne et configuration de déploiement.

**Jouer en ligne (comptes, classements, Daily) :** <https://open-space-simulator.vercel.app>
(le serveur gratuit met environ 50 s à se réveiller après 15 min sans visite) · **Mode invité
seul :** <https://7h0mas92.github.io/Open_Space_Simulator/>

| Menu                               | Partie (ordinateur)                                         | Partie (mobile)                                        |
| ---------------------------------- | ----------------------------------------------------------- | ------------------------------------------------------ |
| ![Menu](docs/screenshots/menu.png) | ![Partie sur ordinateur](docs/screenshots/game-desktop.png) | ![Partie sur mobile](docs/screenshots/game-mobile.png) |

## Démarrage rapide

Prérequis : Node.js 22.12+, pnpm 10 (`corepack enable`), Docker.

```bash
pnpm install         # génère aussi le client Prisma (postinstall)
cp packages/server/.env.example packages/server/.env   # puis adapter si besoin
pnpm db:up          # PostgreSQL 16 dans Docker
pnpm db:migrate     # applique les migrations Prisma
pnpm db:seed        # compile @oss/shared, puis crée admin@oss.local / admin-dev-password et les 130 cartes
pnpm dev            # client sur http://localhost:5173, API sur http://localhost:3000
```

- Jeu : http://localhost:5173
- Documentation de l'API (Swagger UI) : http://localhost:3000/docs
- Santé du serveur : http://localhost:3000/api/health

Le port 5432 est celui de PostgreSQL : il ne s'ouvre pas dans un navigateur (« ERR_EMPTY_RESPONSE »,
et une ligne « invalid length of startup packet » dans les logs de la base, sans gravité).

### Se connecter à la base

Les identifiants viennent de `docker-compose.yml` et sont les mêmes dans
`packages/server/.env.example` :

| Champ        | Valeur                                    |
| ------------ | ----------------------------------------- |
| Hôte         | `localhost`                               |
| Port         | `5432`                                    |
| Utilisateur  | `oss`                                     |
| Mot de passe | `oss`                                     |
| Base         | `oss`                                     |
| URL complète | `postgresql://oss:oss@localhost:5432/oss` |

Trois façons de regarder les données :

```bash
# 1. psql dans le conteneur (rien à installer sur le Mac)
docker compose exec db psql -U oss -d oss
#    \dt pour lister les tables, \q pour sortir
docker compose exec db psql -U oss -d oss -c 'select email, role from "User";'

# 2. Prisma Studio, dans le navigateur sur http://localhost:5555
pnpm --filter @oss/server db:studio

# 3. Un client graphique (TablePlus, DBeaver, pgAdmin, DataGrip) :
#    nouvelle connexion PostgreSQL avec les valeurs du tableau ci-dessus.
```

Les tests créent deux bases supplémentaires sur le même serveur, `oss_test`
(`pnpm test`) et `oss_e2e` (`pnpm test:e2e`). Elles sont créées et migrées
automatiquement, puis vidées entre les tests : la base `oss` du jeu n'est jamais
touchée.

### Réinitialiser la base

```bash
# Repartir de zéro : supprime le conteneur et le volume de données
docker compose down -v
pnpm db:up && pnpm db:migrate && pnpm db:seed

# Variante Prisma : rejoue les migrations et le seed sans toucher au conteneur
pnpm --filter @oss/server exec prisma migrate reset
```

Arrêter la base sans perdre les données : `docker compose stop db`, puis
`pnpm db:up` pour la relancer. Les données vivent dans un volume Docker nommé
d'après le dossier du projet (`docker volume ls` pour le voir, par exemple
`open_space_simulator_pgdata`) : `docker compose down` seul le conserve, c'est
l'option `-v` qui l'efface.

En cas de `ERR_MODULE_NOT_FOUND` :

- `.../src/generated/prisma/client.js` : le client Prisma n'est pas généré, lancer
  `pnpm --filter @oss/server db:generate` (Prisma 7 ne le fait plus pendant `migrate dev`) ;
- `.../@oss/shared/dist/index.js` : le paquet partagé n'est pas compilé, lancer
  `pnpm --filter @oss/shared build`.

### Comptes et compte administrateur

Les comptes (inscription, connexion, classements en ligne) ont besoin du serveur. La version
en ligne sur GitHub Pages n'en a pas : la fenêtre « Connexion » y explique que les comptes sont
indisponibles et le jeu reste jouable en invité. En local, avec `pnpm dev` lancé, l'inscription
fonctionne normalement.

`pnpm db:seed` crée un compte administrateur, **pour le développement uniquement** :

| Champ        | Valeur               |
| ------------ | -------------------- |
| Email        | `admin@oss.local`    |
| Mot de passe | `admin-dev-password` |

Une fois connecté avec ce compte, un badge « Administrateur » s'affiche en haut à droite du
menu et un bouton 🛠 Back-office apparaît dans le menu principal (gestion des cartes
d'événements avec filtres, et statistiques : voir [Back-office](docs/architecture/back-office.md)).

Pour donner le rôle ADMIN à un compte créé depuis le jeu :

```bash
pnpm --filter @oss/server user:promote ton@email.fr
```

En production, `SEED_ADMIN_EMAIL` et `SEED_ADMIN_PASSWORD` sont obligatoires (voir
[Déploiement](#déploiement)) : le mot de passe de développement n'est jamais utilisé en ligne.

### Connexion GitHub (facultative)

1. Sur https://github.com/settings/developers, créer une **OAuth App**.
2. _Authorization callback URL_ : `http://localhost:5173/api/auth/github/callback`.
3. Renseigner `GITHUB_CLIENT_ID` et `GITHUB_CLIENT_SECRET` dans `packages/server/.env`.

Sans ces variables, le bouton « Continuer avec GitHub » est simplement masqué.

### Scripts utiles

| Commande                                         | Effet                                                                 |
| ------------------------------------------------ | --------------------------------------------------------------------- |
| `pnpm dev`                                       | Lance shared (watch), le serveur et le client                         |
| `pnpm test`                                      | Tests Vitest de tous les paquets (le serveur utilise `oss_test`)      |
| `pnpm test:e2e`                                  | Tests Playwright sur 5 viewports (serveur + client réels)             |
| `pnpm lint`                                      | ESLint                                                                |
| `pnpm format`                                    | Prettier                                                              |
| `pnpm typecheck`                                 | TypeScript strict sur tout le monorepo                                |
| `pnpm build`                                     | Build de production des trois paquets                                 |
| `pnpm balance`                                   | Simule 10 000 parties et écrit `packages/client/reports/balance.md`   |
| `pnpm balance:story`                             | Joue chaque mission du mode Histoire avec les bots (taux de réussite) |
| `pnpm db:up`                                     | Démarre PostgreSQL 16 dans Docker                                     |
| `pnpm db:migrate`                                | Crée / applique une migration Prisma                                  |
| `pnpm --filter @oss/server db:studio`            | Ouvre Prisma Studio sur http://localhost:5555                         |
| `pnpm --filter @oss/server db:generate`          | Régénère le client Prisma (après un changement de schéma)             |
| `pnpm --filter @oss/server user:promote <email>` | Donne le rôle ADMIN                                                   |

Les messages de commit suivent les [commits conventionnels](https://www.conventionalcommits.org/fr/)
(`feat:`, `fix:`, `docs:`...), vérifiés par un hook `commit-msg` (husky + commitlint).

## Architecture

```mermaid
flowchart LR
  subgraph Navigateur
    UI[ui/ React + Zustand] -- commandes typées --> ENG[engine/ horloge + Web Worker]
    ENG --> SIM[simulation/ ECS déterministe]
    SIM -- snapshots --> R[render/ Three.js]
    SIM -- snapshots --> UI
    API[api/ client HTTP typé]
  end
  API -- "/api (cookies httpOnly)" --> S[Fastify]
  S --> DB[(PostgreSQL<br/>Supabase en prod)]
  SH[[shared/ types + schémas Zod]] -.-> UI
  SH -.-> API
  SH -.-> S
```

### Monorepo

```
packages/
├── shared/   Types et schémas Zod communs (DTO d'API, codes d'erreur, constantes de jeu)
├── server/   Fastify + Prisma + PostgreSQL
│   ├── prisma/          schema.prisma, migrations, seed
│   ├── src/config/      variables d'environnement validées par Zod
│   ├── src/plugins/     sécurité, erreurs, JWT, Prisma, Swagger
│   ├── src/routes/      auth, me, saves, events, scores, daily, achievements,
│   │                    slack-ai, admin, packs, decor, health
│   ├── src/services/    sessions, GitHub OAuth, cartes, rejeu anti-triche, scores,
│   │                    succès, Slack IA (Claude), packs de personnages, décorations
│   └── tests/           tests d'intégration (vraie base PostgreSQL)
└── client/   Vite + React + Three.js + i18next, PWA
    ├── src/             voir src/README.md pour le rôle de chaque dossier
    └── tests/           unit/ (Vitest) et e2e/ (Playwright)
```

Le paquet `shared` est la source de vérité des contrats : le serveur valide les entrées avec
les schémas Zod, le client valide les réponses avec les mêmes schémas. Un changement d'API
casse donc la compilation des deux côtés.

### Authentification

```mermaid
sequenceDiagram
  participant C as Client
  participant S as Serveur
  participant DB as PostgreSQL
  C->>S: POST /api/auth/login {email, password}
  S->>DB: utilisateur + vérification argon2id
  S->>DB: refresh token (empreinte SHA-256)
  S-->>C: cookies httpOnly access_token (JWT 15 min) + refresh_token (30 j)
  C->>S: GET /api/me (cookie access_token)
  Note over C,S: 15 minutes plus tard, le JWT expire
  C->>S: GET /api/me → 401
  C->>S: POST /api/auth/refresh (cookie refresh_token)
  S->>DB: révoque l'ancien jeton, en crée un nouveau (rotation)
  S-->>C: nouveaux cookies, puis la requête est rejouée
```

- **Mots de passe** : argon2id. Message identique pour un email inconnu ou un mauvais mot de
  passe, avec un temps de réponse comparable.
- **Jetons** : JWT d'accès court + refresh token opaque, tous deux en cookies `httpOnly`
  (inaccessibles au JavaScript, donc aux attaques XSS). Le refresh token n'est envoyé qu'aux
  routes `/api/auth`. En base, seule son empreinte est stockée.
- **Rotation et détection de vol** : chaque refresh token ne sert qu'une fois. Si un jeton
  déjà utilisé est présenté, toutes les sessions de l'utilisateur sont révoquées.
- **GitHub OAuth** : paramètre `state` signé contre le CSRF ; liaison automatique à un compte
  existant uniquement si GitHub certifie l'email.
- **Rôles** : `USER` et `ADMIN`, vérifiés par `app.requireRole('ADMIN')`.
- **Protections** : Helmet, CORS restreint au client, rate limiting (global + 10 tentatives
  par minute sur la connexion), logs structurés pino sans cookies.
- **Erreurs** : toujours `{ error: { code, message } }` ; le client traduit le `code`.

### Rendu 3D, méta-jeu et back-office

Détaillés dans des fichiers à part :

- [Rendu 3D et interface](docs/architecture/rendu-interface.md)
- [Méta-jeu et anti-triche](docs/architecture/meta-jeu.md)
- [Back-office](docs/architecture/back-office.md)

### Choix techniques

| Choix                                                                                                    | Pourquoi                                                                                                                                                 |
| -------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Client et API sur la **même origine** (`/api`) via le proxy Vite en dev et une réécriture Vercel en prod | Les cookies de session restent « first-party » : pas de cookies tiers (bloqués par Safari et bientôt Chrome), pas besoin de `SameSite=None`.             |
| **Prisma 7** avec l'adaptateur `pg`                                                                      | Version actuelle de Prisma : plus de moteur Rust à embarquer, client TypeScript généré dans `src/generated`.                                             |
| **TypeScript 6.0**                                                                                       | TypeScript 7 (réécriture en Go) n'est pas encore supporté par typescript-eslint.                                                                         |
| **Zod 4** + `fastify-type-provider-zod`                                                                  | Un seul schéma sert à valider, typer et documenter (OpenAPI) chaque route.                                                                               |
| Tests serveur sur une **vraie base**                                                                     | Les contraintes d'unicité et la rotation des jetons sont testées pour de vrai, pas simulées.                                                             |
| Règle ESLint sur `simulation/` et `events/`                                                              | Interdit d'y importer Three.js, React ou le DOM, ainsi que `Math.random` et `Date.now` : la simulation reste déterministe et exécutable sans navigateur. |
| IA des personnages **hors** de la simulation (`ai/`)                                                     | La simulation dit _ce que_ fait un dev ; l'IA visuelle décide _comment on le voit_. Elle est déterministe mais ne touche jamais l'état du jeu.           |
| Glisser-déposer maison (Pointer Events) plutôt qu'une bibliothèque                                       | Un seul code pour la souris, le doigt et le stylet, sans dépendance ; alternative clavier par des boutons fléchés.                                       |
| Le serveur **réutilise la simulation du client**                                                         | Une seule implémentation des règles : le rejeu anti-triche ne peut pas diverger du jeu. Le build serveur (esbuild) l'embarque dans `dist/server.js`.     |
| Éditeur de cartes en **JSON validé par Zod**                                                             | Toutes les conditions et tous les effets restent éditables sans formulaire géant ; le schéma partagé donne les mêmes erreurs que le serveur.             |

## Équilibrage

`pnpm balance` joue 10 000 parties avec sept stratégies automatiques (aléatoire, « ship it »,
équilibrée, prudente, investisseuse qui crée des filiales, financière qui use des
financements hors tour de table, organisatrice qui aménage la salle de réunion) et produit un rapport : taux de faillite (global et par phase),
valorisation moyenne et médiane, cartes les plus tirées et choix trop forts. Il suit aussi la
trajectoire de chaque jauge (sprints 5, 13, 26 et 39), la part des jours où une jauge reste
collée à 0 ou à 100, et rejoue 700 parties dans chaque autre mode (Facile, Hardcore, Stagiaires
Only, 3 sprints), puis 140 parties par légende du mode Carrière (étoiles et réussite de chaque
jalon). Une section suit les tâches dynamiques : urgences et tâches de la semaine
finies à temps, réussite des objectifs par type et difficulté. Le dernier rapport est dans
[`docs/balance.md`](docs/balance.md).

**Difficulté des modes** (`packages/shared/src/sim/difficulty.ts`, `difficultyOf(mode)`) : un
profil de multiplicateurs par mode (trésorerie de départ, cartes par sprint, chance de tirage,
effets négatifs des cartes, dépenses, revenus, pannes, barre des investisseurs). Le Normal, le
Daily, Stagiaires Only et 3 sprints gardent le profil neutre, donc les mêmes parties qu'avant.

| Mode     | Départ | Effets négatifs | Cartes / sprint | Dépenses | Revenus | Pannes | Investisseurs |
| -------- | -----: | --------------: | --------------: | -------: | ------: | -----: | ------------: |
| Facile   | 2,2 M€ |           -15 % |               3 |        = |       = |      = |             = |
| Normal   |   2 M€ |               = |               3 |        = |       = |      = |             = |
| Hardcore | 1,5 M€ |           +30 % | 4 (tirage x1,5) |    +15 % |   -15 % |  +50 % |    barre +0,3 |

Mesuré par la section « Difficulté par mode et par stratégie » du rapport : en Facile, un
joueur au hasard fait encore faillite ou finit zombie une fois sur quatre et les bons bots ne
deviennent pas plus souvent licornes qu'en Normal ; en Hardcore, le joueur au hasard et le
prudent qui attend coulent trois à neuf fois sur dix, les bonnes stratégies une fois sur dix
environ, et la licorne reste possible (2 à 4 %).

Règles qui empêchent une jauge de s'emballer ou de rester à 0 (toutes dans
`packages/shared/src/sim/balance.ts`) :

- **Trésorerie** : une levée finance au plus 18 mois de dépenses, trésorerie en caisse comprise.
  Il faut relever pour grandir, au lieu de dormir sur 20 M€.
- **Hype** : elle revient chaque jour vers 15 ; haute, elle retombe vite, à 0 elle remonte seule.
- **Café** : la cuisine (Seed), puis la cantine, livrent du café et stockent plus ; les machines
  restent nécessaires pour une grande équipe.
- **Dette et stabilité** : le code vieillit un peu chaque jour (plus vite avec une grande équipe)
  et la charge des utilisateurs use la prod : rien ne reste à 0 de dette ou à 100 de stabilité
  sans entretien.

## Branches et contributions

```text
feat/… fix/… docs/…  ──PR (squash)──▶  develop  ──PR « release » (merge commit)──▶  main  ──▶  GitHub Pages
        ▲                                 tests de Thomas et Melvin                     │
        └──────────── correctif urgent : PR vers main, puis main fusionnée dans develop ◀┘
```

- **`main`** : la version publiée. Seule cette branche est déployée (GitHub Pages, Render). On
  n'y pousse jamais directement.
- **`develop`** : la branche de test. Chaque fonctionnalité ou correctif part de `develop` dans
  sa propre branche et revient par une PR vers `develop` (CI verte, validation, squash merge).
  Une idée qu'on ne garde pas se retire de `develop` par un revert, sans toucher à `main`.
- **Mise en production** : quand Thomas et Melvin ont validé `develop`, une PR `develop` →
  `main` fusionnée en _merge commit_ (pas de squash : les deux branches gardent le même
  historique). Les migrations Prisma s'appliquent seules au démarrage de Render
  (`db:deploy`). Dernière mise en production : 3 novembre 2026 (PR #166).
- La CI ([`ci.yml`](.github/workflows/ci.yml) : lint, format, typecheck, tests, build, e2e)
  tourne à chaque push sur toutes les branches et sur chaque PR.

```bash
git switch develop && git pull
git switch -c feat/ma-fonctionnalite
# … commits conventionnels en français …
git push -u origin feat/ma-fonctionnalite   # puis PR vers develop sur GitHub
```

Protection conseillée (_Settings_ → _Branches_ → _Add branch ruleset_, à régler par le
propriétaire du dépôt) : sur `main` et `develop`, PR obligatoire, CI « Lint, typecheck, tests,
build » et « Tests end-to-end (Playwright) » obligatoires, pas de force-push ni de suppression ;
sur `main`, en plus, une approbation. Dans _Settings_ → _General_ → _Pull Requests_, garder le
squash et le merge commit autorisés.

## Déploiement

Le client va sur **Vercel**, le serveur sur **Render** et la base PostgreSQL sur **Supabase**
(fichiers prêts : [`render.yaml`](render.yaml) et
[`packages/client/vercel.json`](packages/client/vercel.json)). En local, rien ne change : la
base reste celle de `docker compose`.

### Base de données sur Supabase

Le projet Supabase `open-space-simulator` (offre gratuite, région `eu-central-1`, Francfort,
comme le serveur Render) contient déjà toutes les tables : les migrations Prisma y sont
appliquées et notées dans `_prisma_migrations`, donc `prisma migrate deploy` ne rejoue que les
nouvelles. Le serveur ne passe que par Prisma : Supabase sert de PostgreSQL hébergé (pas
d'auth Supabase, pas de SDK `supabase-js`).

- **Quelle URL ?** _Connect_ → _Session pooler_ (port 5432), en ajoutant `?sslmode=require` :
  `postgresql://postgres.<ref>:<mot-de-passe>@<hôte>.pooler.supabase.com:5432/postgres?sslmode=require`.
  La _Direct connection_ n'est joignable qu'en IPv6 sur l'offre gratuite (Render ne l'atteint
  pas) et le _Transaction pooler_ (6543) ne convient pas aux migrations Prisma. Une seule URL
  sert donc aux migrations, au seed et au serveur.
- **Le mot de passe** se choisit dans _Database_ → _Settings_ → _Reset database password_ et ne
  se saisit que dans Render (variable `DATABASE_URL`) ou dans un `.env` local, jamais dans le
  dépôt.
- **SSL** : le driver `pg` lit `sslmode=require` comme `verify-full` et refuserait le certificat
  de Supabase. `createPrismaClient` (`src/lib/prisma.ts`) ajoute `uselibpqcompat=true` pour lui
  donner le sens standard de PostgreSQL : connexion chiffrée, comme avec la CLI Prisma.
- **API publique de Supabase** : Supabase expose le schéma `public` en REST à qui possède la clé
  publique du projet. La migration `row_level_security` active la RLS sur toutes les tables,
  sans politique : cette API ne voit aucune ligne, alors que le serveur (rôle propriétaire)
  n'est pas concerné. Une nouvelle table doit faire de même ; `tests/rls.test.ts` le vérifie.
- **Remplir la base** (100 cartes, succès, compte administrateur) : c'est fait par le
  `startCommand` de Render à chaque démarrage (seed idempotent). Depuis un poste, avec l'URL
  Supabase dans `packages/server/.env` : `pnpm --filter @oss/server db:deploy` puis
  `SEED_ADMIN_EMAIL=… SEED_ADMIN_PASSWORD=… pnpm --filter @oss/server db:seed`.
- **Offre gratuite** : 500 Mo, et le projet se met en pause après 7 jours sans requête ; il se
  relance depuis le tableau de bord Supabase (_Restore project_).

### Serveur sur Render et client sur Vercel

1. **Render** → _New_ → _Blueprint_ → ce dépôt. Render crée le service `oss-server` (build,
   migrations, seed puis démarrage). Il demande :
   - `DATABASE_URL` : l'URL Supabase du _Session pooler_ ci-dessus ;
   - `CLIENT_URL` : l'URL Vercel du client, `https://open-space-simulator.vercel.app` ;
   - `SEED_ADMIN_EMAIL` et `SEED_ADMIN_PASSWORD` : le compte administrateur ;
   - facultatif : `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` (OAuth App GitHub, callback
     `${CLIENT_URL}/api/auth/github/callback`) et `ANTHROPIC_API_KEY` (Slack IA).
     `JWT_SECRET` est généré par Render.
2. `packages/client/vercel.json` renvoie `/api` et `/docs` vers le service Render
   `oss-server-e90i.onrender.com` (à changer si le service est recréé).
3. **Vercel** → _Add New Project_ → ce dépôt, _Root Directory_ `packages/client`. Les
   commandes d'installation et de build sont dans `vercel.json`.

### Version invité sur GitHub Pages

Le workflow [`pages.yml`](.github/workflows/pages.yml) publie le client seul sur GitHub Pages à
chaque push sur `main`, donc à chaque fusion de `develop` dans `main` (variable `BASE_PATH=/Open_Space_Simulator/` pour le sous-chemin).
Sans serveur, le jeu se joue en invité avec les 130 cartes intégrées et les sauvegardes
locales ; le compte, les classements en ligne, le Daily en ligne et le Slack IA demandent le serveur
Render et sa base Supabase (le classement « Sur cet appareil » fonctionne sans). Dans _Settings_ →
_Pages_, la source doit être _GitHub Actions_.

Les secrets ne vont jamais dans le dépôt : ils se saisissent dans les tableaux de bord de
Render et Vercel (le mot de passe de la base, dans Supabase puis dans Render). Toutes les variables sont décrites dans
[`packages/server/.env.example`](packages/server/.env.example).

## Ce que l'application fait et ne fait pas

Elle fait : un jeu de gestion solo complet (8 modes dont un mode illimité et la Carrière, 39 sprints, 100 cartes, 8 profils de
devs et 10 métiers d'une équipe web, 4 phases et 4 fins, plus 24 cartes de saison, des décorations par période, les
anniversaires des devs et jusqu'à 3 filiales avec 6 cartes dédiées), jouable hors ligne en invité, avec classements en ligne (global,
Daily, par mode) et sur l'appareil, replays vérifiés par le serveur, 70 succès (dont 22 secrets), un back-office et un Slack
optionnellement animé par l'IA.

Elle ne fait pas : de multijoueur en temps réel, d'achats intégrés ni de publicité, de chat
entre joueurs, d'application mobile native (PWA uniquement), ni d'assets payants. L'IA ne
génère que des messages Slack.

## Crédits

- Modèles 3D : [Kenney](https://kenney.nl) (licence CC0), packs Furniture Kit et Blocky
  Characters, inclus dans `packages/client/public/assets/kenney/` (voir le README de ce dossier).
  Le manifeste typé `render/assetManifest.ts` liste exactement les fichiers des packs.
- Assets absents des packs, remplacés par des formes Three.js ou du CSS : babyfoot, toboggan,
  sieste-pod, standing desk, station de recharge d'écouteurs, baie de serveurs, cafetière à
  filtre, machine à expresso et moulin, micro-ondes, bouilloire, cuiseur à riz, meubles de
  cuisine (tiroirs, portes, évier, colonne, vaisselier, îlot), frigo à boissons vitré, cactus, écran de métriques, pot
  de ramen, mug, canard en plastique, trophée de hackathon, étui d'écouteurs sans fil ouvert,
  mini-cactus de bureau, clavier QWERTY à touches, tapis de souris, tours de PC sobre et gaming,
  MacBook Pro sans logo, cinq écrans sur pied ou sur bras articulé (dont un incurvé), bornes d'arcade, flipper, enseigne néon, arbre, fontaine, scène,
  pupitre et écran géant des annexes (aussi en vente), ville, fenêtres et baies vitrées, murs fins pleins et vitrés, vidéoprojecteur, projecteur de plafond et écrans déroulants,
  local et salle des serveurs, serveurs rack, lames et GPU, switch, box fibre, climatisation de
  précision, climatiseur mural, clim en rangée, sonde de supervision, onduleur, NAS de sauvegarde, pare-feu, extinction au gaz,
  déchets au sol et agents de nettoyage (chariot, aspirateur, serpillière), litières,
  gamelles, arbres à chat et chats, canapé, bibliothèque, bureaux, chaises, cuisine, détente et
  accessoires détaillés, huit plantes d'intérieur, tableau blanc, horloge,
  aquarium, mur d'écrans et tableau des salles de réunion, pack UI (interface en CSS), packs sons. Les autres objets du mode construction
  combinent plusieurs modèles Kenney (bureau avec écran et souris, table de cantine et
  ses bancs…), pour que chacun ait un rendu qui lui est propre. Pour les
  effets sonores et l'ambiance, le lecteur audio (Howler.js) est prêt : il suffit de déposer les
  fichiers et de remplir `packages/client/src/audio/manifest.ts`. Liste aussi visible dans la
  page Crédits du jeu.
- Musiques : compositions originales de l'équipe du projet (tycoon, Détente, aria math), dans
  `packages/client/public/assets/music/` (voir le README de ce dossier). Elles appartiennent à leur
  auteur et ne sont pas sous licence CC0.
- Bruits de bureau : frappes au clavier tirées d'un enregistrement fourni par l'équipe du projet
  (`packages/client/public/assets/sounds/`, voir le README de ce dossier), clics de souris
  synthétisés en Web Audio.
- Personnages : 10 des 18 Blocky Characters sont hors thème (pirate, ninja, zombies, policier…)
  et ne sont jamais tirés. Chaque profil a sa liste de looks (`render/officeCharacters.ts`) :
  les personnages Kenney adaptés, complétés d'accessoires Three.js (barbe, écouteurs, béret, badge,
  crabe Ferris), et 13 personnages construits en Three.js avec la même hiérarchie que les GLB, ce
  qui leur permet de jouer les clips d'animation Kenney.
- Rendu : [Three.js](https://threejs.org). Interface : React, Zustand, i18next. Audio :
  Howler.js. Slack IA : API Claude d'Anthropic.
