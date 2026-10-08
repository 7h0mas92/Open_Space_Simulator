# Open Space Simulator 2026

> « Ta startup a levé 2 millions. Tu as 18 mois avant que tout explose. Bonne chance. »

Jeu de gestion de startup jouable dans le navigateur, en 3D low-poly isométrique.
Le cahier des charges complet est dans [`CLAUDE.md`](./CLAUDE.md).

**État actuel : jeu complet, prêt à déployer.** Socle, simulation, rendu 3D, interface,
événements, progression, méta-jeu (succès, modes, Daily, classements, replays vérifiés),
Slack simulé (templates ou IA), back-office, PWA hors ligne et configuration de déploiement.

**Jouer en ligne (mode invité) :** <https://7h0mas92.github.io/Open_Space_Simulator/>

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
pnpm db:seed        # compile @oss/shared, puis crée admin@oss.local / admin-dev-password et les 100 cartes
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
d'événements avec filtres, et statistiques : voir [Back-office](#back-office)).

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

| Commande                                         | Effet                                                               |
| ------------------------------------------------ | ------------------------------------------------------------------- |
| `pnpm dev`                                       | Lance shared (watch), le serveur et le client                       |
| `pnpm test`                                      | Tests Vitest de tous les paquets (le serveur utilise `oss_test`)    |
| `pnpm test:e2e`                                  | Tests Playwright sur 5 viewports (serveur + client réels)           |
| `pnpm lint`                                      | ESLint                                                              |
| `pnpm format`                                    | Prettier                                                            |
| `pnpm typecheck`                                 | TypeScript strict sur tout le monorepo                              |
| `pnpm build`                                     | Build de production des trois paquets                               |
| `pnpm balance`                                   | Simule 10 000 parties et écrit `packages/client/reports/balance.md` |
| `pnpm db:up`                                     | Démarre PostgreSQL 16 dans Docker                                   |
| `pnpm db:migrate`                                | Crée / applique une migration Prisma                                |
| `pnpm --filter @oss/server db:studio`            | Ouvre Prisma Studio sur http://localhost:5555                       |
| `pnpm --filter @oss/server db:generate`          | Régénère le client Prisma (après un changement de schéma)           |
| `pnpm --filter @oss/server user:promote <email>` | Donne le rôle ADMIN                                                 |

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
  S --> DB[(PostgreSQL)]
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
│   │                    slack-ai, admin, health
│   ├── src/services/    sessions, GitHub OAuth, cartes, rejeu anti-triche, scores,
│   │                    succès, Slack IA (Claude)
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

### Rendu 3D et interface

```mermaid
flowchart LR
  W[Web Worker<br/>simulation] -- snapshot GameState --> AD[view/adapter<br/>GameState → GameView]
  AD --> V[GameView<br/>instantané en lecture seule]
  V --> AI[ai/ IA visuelle<br/>A* + behavior trees<br/>pas fixe 0,1 s, RNG seedé]
  AI -- 2 derniers pas --> R[render/ GameRenderer<br/>interpolation]
  V --> R
  V --> UI[ui/ HUD, Kanban, fiches]
  UI -- GameCommand --> AD2[view/adapter<br/>GameCommand → Command]
  AD2 --> W
  R -- clic, appui long --> UI
```

- **Frontière unique** : `view/types.ts` décrit ce que le rendu et l'interface lisent (`GameView`)
  et les commandes qu'ils envoient (`GameCommand`). `view/adapter.ts` traduit l'état de la
  simulation dans ce modèle (fonctions pures, testées) et `view/source.ts` le relie au moteur
  qui tourne dans le Web Worker. Les règles (prix, emprise, effets des objets) restent dans la
  simulation ; `view/catalog.ts` n'ajoute que l'habillage (modèle 3D, catégorie).
- **Étapes du sprint** : planification (Kanban, recrutement, levée de fonds), exécution, cartes
  d'événements avec effets affichés, démo de fin de sprint, mini-jeu de pitch, fin de partie.
- **Scène** : caméra orthographique isométrique (35,26°, rotation par quarts de tour), sol et
  murs par phase (Garage, Seed, Série A, Licorne), mobilier en `InstancedMesh`, cycle jour/nuit,
  ombres, contour de sélection et léger bloom (post-processing).
- **Personnages** : l'IA décide où chacun marche (A* 8 directions, évitement entre collègues)
  et quelle posture il prend selon son activité ; le rendu joue le clip GLB correspondant ou une
  animation procédurale, et affiche des bulles de pensée traduites.
- **Contrôles** : glisser pour déplacer, molette ou pincer pour zoomer, appui long pour
  sélectionner sur mobile, flèches, `+`/`-`, `Q`/`E` au clavier.
- **Qualité réglable** (bas, moyen, haut) : devicePixelRatio plafonné à 2, ombres coupées en
  bas (défaut sur mobile), petits objets masqués quand on dézoome (LOD).
- **Écran de jeu** : en haut ce qu'on lit (phase, équipe, mois de trésorerie restants, six
  jauges avec icône, tendance et couleur, horloge et avancement du sprint) ; en bas ce qu'on
  fait (dock d'actions et commande de l'étape : lancer le sprint, lever des fonds, vitesses).
  L'horloge défile minute par minute (environ 5 min réelles par sprint à x1) alors que la
  simulation avance par pas de 30 min : l'affichage interpole entre deux pas.
  Les cartes d'événement gardent les jauges visibles, montrent les effets en pastilles et se
  choisissent aussi avec les touches 1 à 3.
- **Télétravail automatique** : chaque matin de semaine, la simulation envoie en télétravail
  les devs sans bureau libre, épuisés, en conflit avec un collègue ou accros privés de café (le
  Dev Fantôme l'est toujours). Ils disparaissent de l'open space, se fatiguent moins mais
  perdent 15 % de vitesse et 5 % de qualité ; la fiche, l'équipe et Slack l'affichent.
- **Interface** : jauges avec infobulles, vitesses, Kanban en glisser-déposer (souris et
  tactile, ou flèches au clavier), fiches des devs, recrutement avec négociation, mode
  construction, dashboard, options d'accessibilité, tutoriel, crédits. Panneaux latéraux
  sur ordinateur, bottom sheets plein écran sur mobile.
- **Mode construction** : le HUD s'efface au profit d'un catalogue en bas de l'écran (vignettes
  3D rendues hors écran avec les modèles Kenney, colonne à droite sur téléphone couché). Choisir
  un objet replie le catalogue : l'aperçu apparaît sur une case libre près du centre, sur une
  grille, vert ou rouge selon la case. Souris : l'aperçu suit le pointeur, clic pour poser.
  Doigt : tap ou glisser de l'aperçu pour viser, bouton « Poser » pour confirmer (pas d'achat
  par erreur). Clavier : `B` ouvre et ferme, flèches pour viser, `R` pour tourner, Entrée pour
  poser, Échap pour reculer d'un cran.

### Méta-jeu et anti-triche

```mermaid
sequenceDiagram
  participant J as Navigateur
  participant S as Serveur
  participant DB as PostgreSQL
  J->>S: GET /api/events → {version, cards}
  Note over J: la partie tourne dans le Web Worker<br/>chaque commande est journalisée avec son tick
  J->>S: POST /api/scores {mode, graine, commandes, version des cartes}
  S->>DB: jeu de cartes de cette version
  S->>S: rejoue la partie (même code de simulation que le client)
  S->>DB: score calculé par le serveur, succès, statistiques des cartes
  S-->>J: {score, rang, nouveaux succès}
```

- **Anti-triche** : le serveur ne croit que la graine et la liste des commandes. Il importe la
  simulation du client (`@oss/client/simulation`, TypeScript pur) et rejoue la partie : issue,
  valorisation et succès viennent de ce rejeu. Un score « annoncé » différent est refusé
  (`SCORE_MISMATCH`), une partie inachevée aussi (`GAME_NOT_FINISHED`).
- **Versions des cartes** : l'ordre et le contenu des cartes changent le tirage. Chaque jeu de
  cartes servi par `GET /api/events` porte une empreinte (`version`) gardée en base : une partie
  se rejoue toujours avec les cartes qu'elle a connues, même après une modification dans le
  back-office. Hors ligne, le jeu utilise le cache ou les 100 cartes intégrées (`builtin`).
- **Replays** : `GET /api/scores/:id/replay` renvoie graine, commandes et cartes ; le moteur les
  rejoue en accéléré (les commandes du joueur sont bloquées).
- **Daily** : graine `daily-AAAA-MM-JJ`, la même pour tous ; un seul score par joueur et par jour.
- **Sauvegardes** : 5 emplacements (le 1er reçoit une sauvegarde automatique à chaque sprint),
  gardés dans IndexedDB puis synchronisés avec le serveur à la connexion.
- **Succès** : 61 succès, vérifiés par la simulation à partir de l'état (donc infalsifiables) ou
  débloqués par des cartes. Chacun a une difficulté (facile, intermédiaire, difficile,
  légendaire) ; 21 sont secrets : leur nom est visible et compté avec les autres, mais leur
  condition reste « ??? » tant qu'ils ne sont pas débloqués. Un écran « Succès » est accessible
  depuis le menu principal ; `pnpm balance` mesure le taux de déblocage de chacun par les bots
  pour vérifier la difficulté annoncée.
- **Slack IA** (facultatif) : le client envoie un résumé (phase, jauges, devs), jamais l'état
  complet ; le serveur appelle Claude avec une sortie structurée, applique un quota par joueur
  et par jour et met les réponses en cache. Sans clé, en cas d'erreur ou de quota atteint, le
  jeu retombe sur ses 256 templates. L'IA n'écrit que des messages.
- **PWA** : `vite-plugin-pwa` met en cache le code, les modèles Kenney et les icônes ; une
  partie en invité se lance sans réseau (testé par Playwright).

### Back-office

Réservé au rôle ADMIN (vérifié par le serveur sur chaque route `/api/admin/*`), ouvert depuis le
bouton 🛠 du menu principal.

- **Cartes** : chaque carte est une tuile avec son titre, son identifiant, sa description, son
  poids, son nombre de tirages, les phases où elle peut tomber, le profil requis, les jauges que
  ses choix modifient et ses particularités. Actions : modifier, dupliquer (ouvre l'éditeur avec
  un identifiant libre, carte désactivée par défaut) et désactiver ou réactiver en un clic.
- **Filtres combinables** : recherche plein texte (titre, description, choix et identifiant, en
  français et en anglais, sans tenir compte des accents), état, phase, profil requis, jauge
  modifiée, particularités (chaîne « On en reparle », hors tirage, jour ou heure imposés, seuil
  de jauge, recrute ou licencie, débloque un succès) et tri (titre, poids, tirages, dernière
  modification). Les filtres actifs s'affichent en pastilles retirables et restent en mémoire
  pendant la session. Sur ordinateur ils sont dans une colonne à gauche, sur mobile dans un
  panneau qui se replie. La logique est dans `ui/admin/cardFilters.ts` (fonctions pures, testées).
- **Éditeur** : JSON validé en direct par le schéma Zod partagé, avec l'aperçu de la carte telle
  que le joueur la verra.
- **Packs de personnages** : Noël, Halloween, Pâques, super-héros (héros inventés, sans
  licence), été, espace, pirates, Moyen Âge, années 80 et cyberpunk. Un pack déguise toute l'équipe : chaque profil a son costume construit en Three.js
  (Père Noël barbu, stagiaire citrouille, oreilles de lapin, cape et emblème…), avec un aperçu 3D
  des 8 profils. Le pack « Base » (les looks habituels, sans costume) est le seul actif au départ ;
  si plusieurs packs sont actifs, l'équipe se répartit entre eux (Base et Noël : la moitié en
  costume), et si aucun ne l'est, on revient aux looks de base. Le client lit `GET /api/character-packs` au lancement d'une partie et le garde en cache
  pour le hors-ligne ; l'administrateur les change avec `PUT /api/admin/character-packs/:id`.
  Costumes dans `render/characterPacks.ts`.
- **Décorations** : un thème par période de l'année (Nouvel An, Saint-Valentin, Pâques, espace,
  Moyen Âge, super-héros, années 80, été, pirates, Halloween, cyberpunk, Noël). Chacun a une
  guirlande murale, trois objets au sol et un petit objet par bureau, construits en Three.js, avec
  un aperçu 3D. Trois réglages par thème : désactivé, en saison (par défaut, seulement pendant sa
  période) ou toujours. `GET /api/decor-themes` (public, en cache hors ligne) et
  `PUT /api/admin/decor-themes/:id`.
- **Statistiques** : joueurs, parties, fins, faillites par phase, cartes les plus tirées et choix
  les plus fréquents, avec des barres proportionnelles.

| Liste et filtres (ordinateur)                                     | Filtres (mobile)                                             |
| ----------------------------------------------------------------- | ------------------------------------------------------------ |
| ![Back-office sur ordinateur](docs/screenshots/admin-desktop.png) | ![Back-office sur mobile](docs/screenshots/admin-mobile.png) |

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

`pnpm balance` joue 10 000 parties avec quatre stratégies automatiques (aléatoire, « ship it »,
équilibrée, prudente) et produit un rapport : taux de faillite (global et par phase),
valorisation moyenne et médiane, cartes les plus tirées et choix trop forts. Il suit aussi la
trajectoire de chaque jauge (sprints 5, 13, 26 et 39), la part des jours où une jauge reste
collée à 0 ou à 100, et rejoue 400 parties dans chaque autre mode (Facile, Hardcore, Stagiaires
Only, 3 sprints). Le dernier rapport est dans [`docs/balance.md`](docs/balance.md).

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

## Déploiement

Le client va sur **Vercel**, le serveur et la base sur **Render** (fichiers prêts :
[`render.yaml`](render.yaml) et [`packages/client/vercel.json`](packages/client/vercel.json)).

1. **Render** → _New_ → _Blueprint_ → ce dépôt. Render crée la base `oss-db` et le service
   `oss-server` (build, migrations, seed puis démarrage). Il demande :
   - `CLIENT_URL` : l'URL Vercel du client (par exemple `https://open-space-simulator.vercel.app`) ;
   - `SEED_ADMIN_EMAIL` et `SEED_ADMIN_PASSWORD` : le compte administrateur ;
   - facultatif : `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` (OAuth App GitHub, callback
     `${CLIENT_URL}/api/auth/github/callback`) et `ANTHROPIC_API_KEY` (Slack IA).
     `JWT_SECRET` est généré par Render.
2. Dans `packages/client/vercel.json`, remplacer `REMPLACER-PAR-L-URL-RENDER` par l'URL du
   service Render (par exemple `oss-server.onrender.com`).
3. **Vercel** → _Add New Project_ → ce dépôt, _Root Directory_ `packages/client`. Les
   commandes d'installation et de build sont dans `vercel.json`.

### Version invité sur GitHub Pages

Le workflow [`pages.yml`](.github/workflows/pages.yml) publie le client seul sur GitHub Pages à
chaque push sur `main` (variable `BASE_PATH=/Open_Space_Simulator/` pour le sous-chemin).
Sans serveur, le jeu se joue en invité avec les 100 cartes intégrées et les sauvegardes
locales ; le compte, les classements, le Daily en ligne et le Slack IA demandent le serveur
Render. Dans _Settings_ → _Pages_, la source doit être _GitHub Actions_.

Les secrets ne vont jamais dans le dépôt : ils se saisissent dans les tableaux de bord de
Render et Vercel. Toutes les variables sont décrites dans
[`packages/server/.env.example`](packages/server/.env.example).

## Ce que l'application fait et ne fait pas

Elle fait : un jeu de gestion solo complet (5 modes, 39 sprints, 100 cartes, 8 profils de
devs, 4 phases et 4 fins, plus 24 cartes de saison, des décorations par période et les
anniversaires des devs), jouable hors ligne en invité, avec classements en ligne (global,
Daily, par mode), replays vérifiés par le serveur, 61 succès (dont 21 secrets), un back-office et un Slack
optionnellement animé par l'IA.

Elle ne fait pas : de multijoueur en temps réel, d'achats intégrés ni de publicité, de chat
entre joueurs, d'application mobile native (PWA uniquement), ni d'assets payants. L'IA ne
génère que des messages Slack.

## Crédits

- Modèles 3D : [Kenney](https://kenney.nl) (licence CC0), packs Furniture Kit et Blocky
  Characters, inclus dans `packages/client/public/assets/kenney/` (voir le README de ce dossier).
  Le manifeste typé `render/assetManifest.ts` liste exactement les fichiers des packs.
- Assets absents des packs, remplacés par des formes Three.js ou du CSS : babyfoot, toboggan,
  sieste-pod, standing desk, casques antibruit et leur portant, baie de serveurs, cafetière à
  filtre, machine à expresso et moulin, frigo à boissons vitré, cactus, écran de métriques, pot
  de ramen, pack UI (interface en CSS), packs sons. Les autres objets du mode construction
  combinent plusieurs modèles Kenney (bureau avec écran, clavier et souris, table de cantine et
  ses bancs, bibliothèque garnie de livres…), pour que chacun ait un rendu qui lui est propre. Le
  lecteur audio (Howler.js, trois volumes réglables) est prêt : il suffit de déposer les packs
  sons Kenney et de remplir `packages/client/src/audio/manifest.ts`. Liste aussi visible dans
  la page Crédits du jeu.
- Personnages : 10 des 18 Blocky Characters sont hors thème (pirate, ninja, zombies, policier…)
  et ne sont jamais tirés. Chaque profil a sa liste de looks (`render/officeCharacters.ts`) :
  les personnages Kenney adaptés, complétés d'accessoires Three.js (barbe, casque, béret, badge,
  crabe Ferris), et 13 personnages construits en Three.js avec la même hiérarchie que les GLB, ce
  qui leur permet de jouer les clips d'animation Kenney.
- Rendu : [Three.js](https://threejs.org). Interface : React, Zustand, i18next. Audio :
  Howler.js. Slack IA : API Claude d'Anthropic.
