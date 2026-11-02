# Arborescence du dépôt

Ce fichier dit **à quoi sert chaque fichier et où il est rangé**. Il est fait pour être lu dans
l'éditeur (VS Code, WebStorm…) : il est à la racine du dépôt, hors de `packages/client`, donc il
n'est ni servi par Vite, ni copié dans le build, ni visible en jeu.

- Le cahier des charges et la liste de tout ce qui est livré : [`CLAUDE.md`](CLAUDE.md).
- L'installation, l'architecture et le déploiement : [`README.md`](README.md).
- Le relais entre Thomas et Melvin : [`CONTEXTE.md`](CONTEXTE.md).

> **À tenir à jour** : quand une PR ajoute, déplace ou supprime un fichier, elle met à jour la
> ligne correspondante ici. Commande pratique pour repérer les fichiers suivis :
> `git ls-files | grep -v public/assets/kenney`.

## Sommaire

1. [Vue d'ensemble](#vue-densemble)
2. [Racine du dépôt](#racine-du-dépôt)
3. [`packages/shared` : le code commun](#packagesshared--le-code-commun)
4. [`packages/client` : le jeu](#packagesclient--le-jeu)
5. [`packages/server` : l'API](#packagesserver--lapi)
6. [Où chercher quoi](#où-chercher-quoi)

---

## Vue d'ensemble

```
Open_Space_Simulator/
├── .github/workflows/        # CI (lint, tests, build, e2e) et déploiement GitHub Pages
├── .husky/                   # Hook git : vérifie le format des messages de commit
├── docs/                     # Équilibrage, captures du README, passation, propositions
├── packages/
│   ├── shared/               # Types, schémas Zod, constantes d'équilibrage, cartes, succès
│   │   └── src/
│   │       ├── sim/          # Règles et catalogues de la simulation (meubles, sols, fibre…)
│   │       ├── story/        # Mode Histoire : campagne, récompenses
│   │       ├── meta/         # Contrats de l'API, succès, packs, décorations
│   │       └── data/         # Les cartes d'événements et les projets de filiales
│   ├── client/               # Le jeu (Vite + React + Three.js)
│   │   ├── public/           # Fichiers servis tels quels : icônes, modèles Kenney, musiques
│   │   ├── scripts/          # `pnpm balance` et outil de trace
│   │   ├── src/
│   │   │   ├── simulation/   # ECS déterministe en TypeScript pur (aucun Three.js, React, DOM)
│   │   │   ├── events/       # Moteur de cartes d'événements
│   │   │   ├── engine/       # Horloge, vitesses, pont avec le Web Worker
│   │   │   ├── view/         # Modèle de vue (GameView) lu par le rendu et l'interface
│   │   │   ├── ai/           # A*, behavior trees, bulles de pensée, IA des chats
│   │   │   ├── render/       # Scène Three.js : lit la GameView, ne modifie jamais l'état
│   │   │   ├── ui/           # React + Zustand : menus, HUD, panneaux, back-office
│   │   │   ├── audio/        # Musique, effets, bruits de bureau
│   │   │   ├── slack/        # Slack simulé (templates et mode IA)
│   │   │   ├── save/         # Sauvegardes et caches hors ligne (IndexedDB)
│   │   │   ├── api/          # Client HTTP typé
│   │   │   └── i18n/         # Traductions fr.json / en.json
│   │   └── tests/            # Vitest (simulation, unitaires) et Playwright (e2e)
│   └── server/               # L'API (Fastify + Prisma + PostgreSQL)
│       ├── prisma/           # Schéma de la base, migrations, seed
│       ├── scripts/          # Build de production
│       ├── src/              # Routes, plugins, services
│       └── tests/            # Tests d'intégration sur une vraie base
├── docker-compose.yml        # PostgreSQL en local
└── render.yaml               # Déploiement du serveur sur Render
```

Sens des dépendances : `shared` ne dépend de rien ; `client` et `server` importent `shared` ;
le serveur importe aussi la simulation du client pour rejouer les parties (anti-triche).

---

## Racine du dépôt

| Fichier                             | Rôle                                                                                        |
| ----------------------------------- | ------------------------------------------------------------------------------------------- |
| `ARBORESCENCE.md`                   | Ce fichier : rôle et emplacement de chaque fichier.                                         |
| `CLAUDE.md`                         | Cahier des charges complet et « État d'avancement » (liste de tout ce qui est livré).       |
| `CONTEXTE.md`                       | Relais entre Thomas et Melvin : travaux en cours, décisions en attente, journal.            |
| `README.md`                         | Documentation principale : installation, architecture, choix techniques, crédits.           |
| `package.json`                      | Scripts du monorepo (`dev`, `lint`, `test`, `build`, `balance`, `db:*`…) et outils communs. |
| `pnpm-workspace.yaml`               | Déclare les trois paquets du monorepo (`packages/*`).                                       |
| `pnpm-lock.yaml`                    | Versions exactes des dépendances. Généré par pnpm, ne jamais modifier à la main.            |
| `tsconfig.base.json`                | Réglages TypeScript stricts communs, étendus par chaque paquet.                             |
| `eslint.config.js`                  | Configuration ESLint commune à tout le monorepo.                                            |
| `.prettierrc.json`                  | Règles de mise en forme Prettier.                                                           |
| `.prettierignore`                   | Fichiers que Prettier ne touche pas (build, lockfile, migrations, `CLAUDE.md`).             |
| `.editorconfig`                     | Indentation et fins de ligne communes à tous les éditeurs.                                  |
| `.gitignore`                        | Fichiers jamais commités (`node_modules`, build, `.env`, rapports de tests).                |
| `.nvmrc`                            | Version de Node.js à utiliser (`nvm use`).                                                  |
| `commitlint.config.js`              | Commits conventionnels (`feat:`, `fix:`, `docs:`…), vérifiés par le hook git.               |
| `.husky/commit-msg`                 | Hook git qui lance commitlint sur chaque message de commit.                                 |
| `docker-compose.yml`                | Base PostgreSQL locale (`pnpm db:up`).                                                      |
| `render.yaml`                       | Description du service et de la base pour le déploiement sur Render.                        |
| `.github/workflows/ci.yml`          | CI à chaque push : lint, format, typecheck, tests, build, tests e2e.                        |
| `.github/workflows/pages.yml`       | Build invité et déploiement sur GitHub Pages à chaque fusion dans `main`.                   |
| `docs/balance.md`                   | Rapport d'équilibrage produit par `pnpm balance` (10 000 parties).                          |
| `docs/screenshots/*.png`            | Captures utilisées dans le README (menu, partie, back-office, desktop et mobile).           |
| `docs/PASSATION-THOMAS.md`          | Partage du travail entre Thomas et Melvin (2 novembre 2026), avec un prompt par tâche.      |
| `docs/proposition-mode-histoire.md` | Proposition du mode Histoire long, de l'arbre des devs et de l'arbre R&D.                   |

---

## `packages/shared` : le code commun

Types TypeScript, schémas Zod et constantes utilisés à la fois par le client et le serveur.

| Fichier               | Rôle                                                                |
| --------------------- | ------------------------------------------------------------------- |
| `package.json`        | Paquet `@oss/shared`.                                               |
| `tsconfig.json`       | TypeScript du paquet (vérification).                                |
| `tsconfig.build.json` | TypeScript du build (fichiers `.d.ts` et `.js` publiés aux autres). |
| `vitest.config.ts`    | Configuration des tests du paquet.                                  |

### `src/`

| Fichier          | Rôle                                                                        |
| ---------------- | --------------------------------------------------------------------------- |
| `index.ts`       | Point d'entrée : réexporte tout ce que le client et le serveur importent.   |
| `game.ts`        | Constantes de jeu : modes (`GAME_MODES`), phases, durées, tailles d'équipe. |
| `auth.ts`        | Schémas Zod d'inscription et de connexion (email, mot de passe, pseudo).    |
| `auth.test.ts`   | Tests des schémas d'authentification.                                       |
| `errors.ts`      | Codes d'erreur de l'API et format `{ error: { code, message } }`.           |
| `errors.test.ts` | Tests du format d'erreur.                                                   |
| `health.ts`      | Schéma de la réponse de la sonde `GET /health`.                             |
| `i18n.ts`        | Langues du jeu (FR par défaut, EN) et type des textes bilingues.            |

### `src/sim/` : règles et catalogues de la simulation

| Fichier         | Rôle                                                                                       |
| --------------- | ------------------------------------------------------------------------------------------ |
| `balance.ts`    | Toutes les constantes d'équilibrage (`BALANCE`) : temps, salaires, jauges, pauses, raises… |
| `state.ts`      | Schéma Zod de l'état de partie complet (`GameState`), étapes du sprint.                    |
| `components.ts` | Composants de l'ECS (identité, stats, moral, tâches…), métiers (`ROLE_TRADE`).             |
| `commands.ts`   | Commandes typées envoyées à la simulation : le seul moyen de modifier une partie.          |
| `cards.ts`      | Format des cartes d'événements (conditions, choix, effets).                                |
| `calendar.ts`   | Calendrier : date réelle de chaque jour simulé, 12 saisons à thème.                        |
| `furniture.ts`  | Catalogue du mode construction : prix, emprise, effets, phase de déblocage.                |
| `annexDecor.ts` | Décor offert avec chaque annexe (arcade, jardin, auditorium).                              |
| `computers.ts`  | Ordinateurs des postes (tour sobre, tours gaming, MacBook) et leurs effets.                |
| `monitors.ts`   | Écrans des postes : 5 modèles, 3 tailles, pied ou bras articulé.                           |
| `floors.ts`     | Sols : matières, teintes, prix et effets par pièce.                                        |
| `walls.ts`      | Peintures et papiers peints, zones de mur.                                                 |
| `projection.ts` | Vidéoprojecteurs et écrans déroulants : quel projecteur éclaire quel écran.                |
| `serverRoom.ts` | Salle des serveurs, équipements et offres fibre.                                           |
| `lobby.ts`      | Hall d'entrée : prix, secrétaires, formules de sécurité, décor offert.                     |
| `meetings.ts`   | Formules de salle de réunion, réunion du matin, réunion de crise.                          |
| `pets.ts`       | Chats du bureau : équipement requis, prix, effets.                                         |
| `teamRoles.ts`  | Équipe web : devs front, back, fullstack, tech lead, DevOps, QA, encadrement.              |
| `taskFlow.ts`   | Tâches dynamiques : backlog, urgences, tâches de la semaine, objectif de sprint.           |
| `raises.ts`     | Demandes d'augmentation : fréquence, montants, conséquences.                               |
| `pitch.ts`      | Mini-jeu de levée de fonds : questions, arguments, intérêt de l'investisseur.              |
| `funding.ts`    | Autres financements : business angels, prêt, financement participatif, subvention.         |
| `ventures.ts`   | Filiales : projets, parts, dividendes, revente.                                            |

### `src/meta/` : méta-jeu et contrats de l'API

| Fichier           | Rôle                                                                                     |
| ----------------- | ---------------------------------------------------------------------------------------- |
| `api.ts`          | Schémas Zod de l'API : sauvegardes, cartes, scores, classements, Daily, Slack IA, admin. |
| `achievements.ts` | Catalogue des 65 succès (difficultés, secrets).                                          |
| `packs.ts`        | Packs de personnages thématiques (Noël, Halloween…) réglés par l'admin.                  |
| `decor.ts`        | Décorations de saison réglées par l'admin (désactivé, en saison, toujours).              |

### `src/story/` : mode Histoire

| Fichier            | Rôle                                                                                     |
| ------------------ | ---------------------------------------------------------------------------------------- |
| `campaign.ts`      | La campagne : 10 missions en 4 chapitres, départ, objectifs, contraintes, durée.         |
| `campaign.test.ts` | Tests de la campagne (missions bien formées, ordre, récompenses).                        |
| `rewards.ts`       | Récompenses débloquées par les missions (papiers peints, sols, couleurs, objets, bonus). |
| `progress.ts`      | Contrats de l'API `/api/story` (missions réussies, rejouées par le serveur).             |

### `src/data/` : contenus

| Fichier             | Rôle                                                                   |
| ------------------- | ---------------------------------------------------------------------- |
| `cards/index.ts`    | Rassemble les cartes : 100 de base, 24 de saison, 6 « filiales ».      |
| `cards/helpers.ts`  | Raccourcis pour écrire une carte (texte bilingue, valeurs par défaut). |
| `cards/business.ts` | Cartes « business » : investisseurs, concurrents, marché.              |
| `cards/office.ts`   | Cartes « vie de bureau » : café, réunions, open space.                 |
| `cards/team.ts`     | Cartes « équipe » : profils, moral, relations, RH.                     |
| `cards/tech.ts`     | Cartes « technique » : prod, dette, architecture.                      |
| `cards/misc.ts`     | Cartes diverses : moments de la semaine, fin de partie, absurdités.    |
| `cards/seasons.ts`  | Cartes de saison, tirées seulement pendant la période de leur thème.   |
| `cards/ventures.ts` | Cartes « filiales », tirées seulement avec une filiale active.         |
| `ventures.ts`       | Projets de filiales proposés à la planification.                       |

---

## `packages/client` : le jeu

| Fichier                | Rôle                                                                           |
| ---------------------- | ------------------------------------------------------------------------------ |
| `package.json`         | Paquet `@oss/client` : scripts `dev`, `build`, `test`, `e2e`, `balance`.       |
| `index.html`           | Page HTML de départ chargée par Vite.                                          |
| `vite.config.ts`       | Vite : PWA, chemin de publication (Pages ou Vercel), version du build, Vitest. |
| `tsconfig.json`        | TypeScript strict du client.                                                   |
| `playwright.config.ts` | Tests e2e sur la vraie pile, aux largeurs 375, 768, 1024 et 1440 px.           |
| `vercel.json`          | Réglages du déploiement sur Vercel.                                            |
| `.env.example`         | Variables d'environnement du client, documentées.                              |

### `public/` : servi tel quel

| Chemin                                               | Rôle                                                                  |
| ---------------------------------------------------- | --------------------------------------------------------------------- |
| `favicon.svg`, `apple-touch-icon.png`                | Icônes de l'onglet et de l'écran d'accueil iOS.                       |
| `pwa-192.png`, `pwa-512.png`, `pwa-maskable-512.png` | Icônes de la PWA installée.                                           |
| `assets/kenney/README.md`                            | Où et comment déposer les packs Kenney (CC0).                         |
| `assets/kenney/kenney_furniture-kit/`                | Pack Furniture Kit : modèles GLB du mobilier et licence.              |
| `assets/kenney/kenney_blocky-characters_20/`         | Pack Blocky Characters : personnages GLB animés et licence.           |
| `assets/music/README.md`                             | Liste des morceaux et règles de nommage.                              |
| `assets/music/*.mp3`                                 | Les 7 musiques originales de l'équipe (menu, sprint, pitch, fin).     |
| `assets/sounds/README.md`                            | Où déposer les effets sonores.                                        |
| `assets/sounds/clavier-1-mrboubou13al.mp3`           | Enregistrement de clavier découpé en frappes (`audio/deskSounds.ts`). |

### `scripts/`

| Fichier                        | Rôle                                                                         |
| ------------------------------ | ---------------------------------------------------------------------------- |
| `balance/index.ts`             | `pnpm balance` : joue des milliers de parties avec des bots, rapport.        |
| `balance/worker.ts`            | Thread qui joue un lot de parties et renvoie leurs résumés.                  |
| `balance/worker-bootstrap.mjs` | Charge TypeScript (tsx) dans les threads Node avant le vrai worker.          |
| `trace.ts`                     | Trace sprint par sprint d'une partie jouée par un bot.                       |
| `story-check.ts`               | `pnpm balance:story` : calibrage des missions du mode Histoire par les bots. |

### `src/` : racine

| Fichier      | Rôle                                                                  |
| ------------ | --------------------------------------------------------------------- |
| `main.tsx`   | Point d'entrée : monte l'application React et charge les traductions. |
| `version.ts` | Version affichée en bas du menu (numéro, commit, date du build).      |
| `README.md`  | Rôle de chaque dossier de `src/` et règles de dépendance entre eux.   |

### `src/simulation/` : la simulation (ECS, TypeScript pur)

Aucun import de Three.js, React ou du DOM. Tout le hasard passe par le RNG seedable : même
graine + mêmes commandes = même partie.

| Fichier           | Rôle                                                                                    |
| ----------------- | --------------------------------------------------------------------------------------- |
| `README.md`       | Mode d'emploi de la simulation (état, systèmes, commandes, tests).                      |
| `index.ts`        | API publique : seul fichier importé par le moteur, `pnpm balance` et le serveur.        |
| `simulation.ts`   | Boucle d'un pas : liste ordonnée des systèmes (`SYSTEMS`) et application des commandes. |
| `state.ts`        | Création de l'état de départ d'une partie.                                              |
| `ecs.ts`          | Fonctions de base de l'ECS : créer une entité, lire et écrire ses composants.           |
| `helpers.ts`      | Contexte donné aux systèmes : hasard, cartes, notifications.                            |
| `rng.ts`          | Générateur pseudo-aléatoire seedable (sfc32), cœur du déterminisme.                     |
| `math.ts`         | Fonctions mathématiques déterministes (identiques sur tous les navigateurs).            |
| `time.ts`         | Heure, jour et semaine simulés, dérivés du tick.                                        |
| `commands.ts`     | Traitement de chaque commande du joueur (`applyCommand`).                               |
| `replay.ts`       | Rejoue une partie à partir de sa graine et de ses commandes.                            |
| `sprint.ts`       | Passage d'une étape du sprint à l'autre (planification, exécution, démo).               |
| `devs.ts`         | Génération des devs et des candidats (stats, trait, nom, bio).                          |
| `tasks.ts`        | Création et déplacement des tâches du Kanban.                                           |
| `taskFlow.ts`     | Tâches dynamiques : urgences, tâches de la semaine, objectif de sprint.                 |
| `taskTitles.ts`   | Choix d'un titre de tâche varié, sans tirage dans le RNG de la partie.                  |
| `performance.ts`  | Note S à D et productivité de chaque dev par sprint.                                    |
| `economy.ts`      | Revenus, masse salariale, coût d'hébergement, valorisation.                             |
| `fundraising.ts`  | Tour de table : palier, intérêt de l'investisseur, force des arguments.                 |
| `financing.ts`    | Business angels, prêt, financement participatif, subvention.                            |
| `ventures.ts`     | Filiales : création, dividendes, revente (graine à part).                               |
| `raises.ts`       | Demandes d'augmentation (graine à part).                                                |
| `leadership.ts`   | Effets de l'encadrement et de l'équipe qualité (tech lead, DevOps, QA, managers).       |
| `meetings.ts`     | Salle de réunion, réunion du matin et réunion de crise.                                 |
| `furniture.ts`    | Pose, revente, rangement des objets ; effets cumulés du bureau.                         |
| `kitchen.ts`      | Conversion des anciens objets de cuisine combinés (vieilles sauvegardes).               |
| `renamedItems.ts` | Traduction des anciens identifiants d'objets (casques devenus écouteurs).               |
| `floors.ts`       | Pose des sols et effets par pièce.                                                      |
| `walls.ts`        | Pose des peintures et papiers peints et effets par mur.                                 |
| `projection.ts`   | Interrupteur des projecteurs et effets des projections.                                 |
| `serverRoom.ts`   | Effets des salles de serveurs, abonnement et facturation de la fibre.                   |
| `lobby.ts`        | Aménagement du hall, secrétaires de l'accueil et leurs effets.                          |
| `pets.ts`         | Adoption des chats, départ, effets sur l'équipe.                                        |
| `achievements.ts` | Succès vérifiés à partir de l'état.                                                     |
| `endings.ts`      | Fins de partie et phrase partageable de l'écran de fin.                                 |
| `story.ts`        | Mode Histoire : départ de la mission, suivi des objectifs et contraintes, fin.          |
| `unlocks.ts`      | Récompenses du mode Histoire utilisables dans la partie (`state.unlocks`).              |
| `bots.ts`         | Stratégies automatiques de `pnpm balance` (random, shipper, balanced, investor…).       |
| `analysis.ts`     | Joue des parties avec les bots et agrège les résultats (rapport d'équilibrage).         |

#### `src/simulation/systems/` : les systèmes appelés à chaque pas

| Fichier        | Rôle                                                                              |
| -------------- | --------------------------------------------------------------------------------- |
| `activity.ts`  | Ce que fait chaque dev selon l'heure : travail, pauses, déjeuner, départ du soir. |
| `work.ts`      | Avancement des tâches : productivité, qualité, dette, profils spéciaux.           |
| `needs.ts`     | Café : consommation, réapprovisionnement du matin.                                |
| `daily.ts`     | Économie du jour : salaires, loyer, serveurs, revenus.                            |
| `incidents.ts` | Pannes de prod (stagiaire, vendredi 17h) et urgence « Réparer la prod ».          |
| `remote.ts`    | Télétravail automatique du matin et relations entre collègues.                    |
| `calendar.ts`  | Anniversaires des devs et périodes à thème.                                       |

#### `src/simulation/data/` : textes générés

| Fichier      | Rôle                                                                 |
| ------------ | -------------------------------------------------------------------- |
| `names.ts`   | Prénoms et initiales des devs.                                       |
| `bios.ts`    | Mini-bios drôles des devs (FR et EN).                                |
| `flavor.ts`  | Retours d'utilisateurs, faux posts LinkedIn de démission, acheteurs. |
| `tasks.ts`   | Titres des tâches du backlog par type, phase, saison et métier.      |
| `qaTasks.ts` | Tâches des testeurs QA (recette, tests automatisés).                 |

### `src/events/` : moteur de cartes d'événements

| Fichier           | Rôle                                                                      |
| ----------------- | ------------------------------------------------------------------------- |
| `library.ts`      | Cartes chargées au démarrage (API, cache hors ligne ou cartes intégrées). |
| `defaultCards.ts` | Les cartes intégrées au jeu, repli quand l'API est injoignable.           |
| `conditions.ts`   | Vérifie les conditions d'une carte (phase, rôle, jauges, jour, heure…).   |
| `draw.ts`         | Tirage pondéré, cooldown, cartes remises en file (« On en reparle »).     |
| `effects.ts`      | Application des effets d'un choix, version aggravée en cas de report.     |
| `resolve.ts`      | Le joueur choisit une réponse à la carte affichée.                        |

### `src/engine/` : horloge et Web Worker

| Fichier                | Rôle                                                                   |
| ---------------------- | ---------------------------------------------------------------------- |
| `index.ts`             | API publique du moteur côté thread principal.                          |
| `clock.ts`             | Horloge réelle : durée d'un tick selon la vitesse (pause, x1, x2, x4). |
| `host.ts`              | Pilote la partie : vitesses, pause pendant les cartes, replays.        |
| `bridge.ts`            | Pont avec le Web Worker (un vrai, ou un faux pour les tests).          |
| `protocol.ts`          | Messages typés échangés avec le Worker par `postMessage`.              |
| `simulation.worker.ts` | Point d'entrée du Web Worker : la simulation tourne ici.               |
| `interpolation.ts`     | Garde les deux derniers instantanés pour que le rendu interpole.       |

### `src/view/` : modèle de vue

Frontière entre la simulation et l'affichage : `render/` et `ui/` ne lisent que des `GameView`.

| Fichier        | Rôle                                                                                   |
| -------------- | -------------------------------------------------------------------------------------- |
| `types.ts`     | Le type `GameView` et les commandes de l'interface (`GameCommand`).                    |
| `adapter.ts`   | Convertit l'état de la simulation en `GameView`, et les commandes dans l'autre sens.   |
| `source.ts`    | Relie le moteur (Worker) au modèle de vue.                                             |
| `catalog.ts`   | Catalogue du mode construction vu par le rendu et l'interface (modèles, rayons).       |
| `placement.ts` | Règles de pose : dans la grille, hors cloisons, sans chevauchement ni enfermement.     |
| `layout.ts`    | Plan du bureau par phase : taille, salles, cloisons, annexes, sols tirés de la graine. |
| `windows.ts`   | Fenêtres posées dans les murs du fond.                                                 |
| `walls.ts`     | Zones de mur et allure de chaque peinture ou papier peint.                             |
| `floors.ts`    | Zones de sol et allure de chaque matière dans chaque teinte.                           |
| `colors.ts`    | Teintes des couleurs de mobilier (peinture).                                           |
| `decor.ts`     | Où poser les décorations de saison, la table d'anniversaire, la salle de réunion.      |
| `petCoats.ts`  | Couleurs des robes des chats.                                                          |
| `hiring.ts`    | Chance qu'un candidat accepte l'offre (même règle que la simulation).                  |
| `liveTime.ts`  | Horloge continue : l'heure défile minute par minute entre deux pas de 30 min.          |

### `src/ai/` : IA visuelle des personnages et des chats

Déterministe, avec son propre générateur : elle ne touche jamais l'état de la partie.

| Fichier           | Rôle                                                                  |
| ----------------- | --------------------------------------------------------------------- |
| `agents.ts`       | Déplacements et postures des devs dans l'open space.                  |
| `astar.ts`        | Pathfinding A\* sur la grille en 8 directions.                        |
| `grid.ts`         | Grille de navigation : cases praticables selon le plan et les objets. |
| `behaviorTree.ts` | Behavior trees génériques (succès, échec, en cours).                  |
| `thoughts.ts`     | Bulles de pensée contextuelles au-dessus des têtes.                   |
| `cats.ts`         | Où marchent les chats et ce qu'ils font (manger, jouer, dormir).      |
| `random.ts`       | Petit générateur seedable propre à l'IA visuelle.                     |

### `src/render/` : la scène Three.js

Lit des `GameView`, interpole, ne modifie jamais l'état. Les formes Three.js remplacent les
modèles absents des packs Kenney (liste dans la page Crédits).

| Fichier               | Rôle                                                                      |
| --------------------- | ------------------------------------------------------------------------- |
| `GameRenderer.ts`     | Chef d'orchestre du rendu : scène, caméra, boucle d'affichage, sélection. |
| `isoCamera.ts`        | Mathématiques de la caméra isométrique orthographique.                    |
| `gestures.ts`         | Gestes souris et tactiles : glisser, pincer, appui long.                  |
| `edgePan.ts`          | Défilement de la caméra quand la souris approche du bord.                 |
| `interpolation.ts`    | Interpolation entre deux ticks (positions, éclairage).                    |
| `quality.ts`          | Qualité graphique bas, moyen, haut (ombres, lampes, pixels).              |
| `lighting.ts`         | Cycle jour/nuit selon l'heure simulée.                                    |
| `officeLights.ts`     | Appliques, plafonniers, fenêtres couleur du ciel, taches de soleil.       |
| `effects.ts`          | Fumée quand la prod tombe, confettis lors d'une levée.                    |
| `assetManifest.ts`    | Manifeste typé des fichiers Kenney réellement présents.                   |
| `assets.ts`           | Chargement des GLB avec cache et formes de secours.                       |
| `primitives.ts`       | Formes Three.js des objets absents des packs Kenney.                      |
| `pieces.ts`           | Assemblage des meubles détaillés (pièces fusionnées par matériau).        |
| `pixels.ts`           | Textures procédurales sans `<canvas>` (écrans, halos).                    |
| `office.ts`           | Sol, murs, cloisons et mobilier dessinés en InstancedMesh.                |
| `partitions.ts`       | Murs fins du plan et du joueur, raccordés entre eux.                      |
| `floorFinishes.ts`    | Sols posés par le joueur.                                                 |
| `wallFinishes.ts`     | Peintures et papiers peints sur les murs.                                 |
| `workFurniture.ts`    | Bureaux, chaises, meuble télé, baie de serveurs, station d'écouteurs.     |
| `kitchenFurniture.ts` | Meubles de cuisine, électroménager, frigo, cantine.                       |
| `loungeFurniture.ts`  | Babyfoot, toboggan, capsule de sieste, tapis, poubelle.                   |
| `furnitureDetail.ts`  | Canapé et bibliothèque détaillés.                                         |
| `plants.ts`           | Les 8 plantes d'intérieur modélisées feuille par feuille.                 |
| `deskAccessories.ts`  | Accessoires posés sur les bureaux (lampe, mug, canard, écouteurs…).       |
| `keyboard.ts`         | Clavier QWERTY à vraies touches.                                          |
| `computers.ts`        | Ordinateurs des postes (tours, MacBook).                                  |
| `monitors.ts`         | Écrans des postes (modèles, tailles, pied ou bras).                       |
| `screens.ts`          | Contenu des écrans allumés selon le métier du dev.                        |
| `projection.ts`       | Toiles qui se déroulent, faisceau et diaporama des projecteurs.           |
| `projectionModels.ts` | Modèles fixes du projecteur et du caisson de l'écran.                     |
| `meetingRoom.ts`      | Salle de réunion aménagée selon la formule choisie.                       |
| `serverRoom.ts`       | Local serveur, salle vitrée et leurs équipements.                         |
| `lobby.ts`            | Portes à badge, secrétaires, agent de sécurité et caméra du hall.         |
| `lobbyFurniture.ts`   | Comptoir d'accueil.                                                       |
| `annexDecor.ts`       | Décor des annexes (arcade, jardin, auditorium).                           |
| `characters.ts`       | Personnages dans la scène, animés par les clips Kenney.                   |
| `officeCharacters.ts` | Look de chaque personnage selon le profil du dev.                         |
| `characterPacks.ts`   | Costumes des packs thématiques (Noël, Halloween…).                        |
| `packPreview.ts`      | Image d'aperçu d'un pack pour le back-office.                             |
| `pets.ts`             | Modèle 3D et animation des chats.                                         |
| `petFurniture.ts`     | Litières, gamelles et arbres à chat.                                      |
| `decorations.ts`      | Décorations de saison et table d'anniversaire dans la scène.              |
| `decorModels.ts`      | Formes Three.js des décorations de fête.                                  |
| `decorPreview.ts`     | Image d'aperçu d'un thème de décoration pour le back-office.              |
| `skyline.ts`          | La vue sur New York autour de la tour.                                    |
| `skylineShaders.ts`   | Shaders des façades, rues et reflets de la ville.                         |
| `cityLights.ts`       | Part des fenêtres de la ville allumées à chaque heure.                    |
| `storyRewards.ts`     | Objets gagnés en mode Histoire : statue de licorne, cloche de la Bourse.  |

### `src/ui/` : interface React + Zustand

| Fichier        | Rôle                                                                |
| -------------- | ------------------------------------------------------------------- |
| `App.tsx`      | Racine de l'application : menu, partie, pages, retour OAuth GitHub. |
| `appUpdate.ts` | Mise à jour automatique de la PWA après un déploiement.             |
| `useMusic.ts`  | Musique qui suit l'étape du jeu et le volume des options.           |
| `styles.css`   | Styles globaux : couleurs, typographie, boutons, accessibilité.     |
| `menu.css`     | Styles du menu principal.                                           |
| `game.css`     | Styles de l'interface en partie (HUD, panneaux, dock).              |
| `meta.css`     | Styles des pages classements, profil, succès et back-office.        |

| Dossier / fichier                 | Rôle                                                                    |
| --------------------------------- | ----------------------------------------------------------------------- |
| `store/game.ts`                   | Store de la partie : dernière `GameView`, `dispatch` des commandes.     |
| `store/session.ts`                | Compte connecté, serveur joignable ou non.                              |
| `store/settings.ts`               | Préférences du joueur (qualité, zoom, accessibilité, volumes).          |
| `store/guide.ts`                  | Progression du tutoriel du mode Facile.                                 |
| `store/lifecycle.ts`              | Effets d'une partie : sauvegarde auto, score, succès, fin.              |
| `store/story.ts`                  | Progression du mode Histoire (appareil puis compte).                    |
| `menu/HomeMenu.tsx`               | Écran d'accueil : Jouer, Continuer, modes, pages.                       |
| `menu/ModePicker.tsx`             | Choix du mode de jeu en cartes.                                         |
| `menu/SaveSlots.tsx`              | Les 5 emplacements de sauvegarde.                                       |
| `menu/AccountBar.tsx`             | Coin du compte : connexion, pseudo, déconnexion.                        |
| `menu/useLatestSave.ts`           | Sauvegarde proposée par le bouton « Continuer ».                        |
| `components/AuthPanel.tsx`        | Formulaires de connexion et d'inscription.                              |
| `components/LanguageSwitcher.tsx` | Choix de la langue (FR, EN).                                            |
| `game/GameScreen.tsx`             | Écran de partie : scène, HUD, panneaux, dock.                           |
| `game/Scene.tsx`                  | Hôte du canvas Three.js.                                                |
| `game/Hud.tsx`                    | HUD : jauges, trésorerie, horloge en haut ; actions en bas.             |
| `game/Sheet.tsx`                  | Panneau latéral sur ordinateur, bottom sheet sur mobile.                |
| `game/StageScreens.tsx`           | Carte d'événement, levée de fonds, démo, fin de partie.                 |
| `game/Tooltip.tsx`                | Infobulle accessible (survol, clavier, toucher).                        |
| `game/format.ts`                  | Formatage des nombres, montants et dates selon la langue.               |
| `game/shareImage.ts`              | Image partageable de fin de partie.                                     |
| `game/useGameFeeds.ts`            | Branche Slack et audio sur la partie.                                   |
| `game/useLiveTime.ts`             | Heure qui défile en continu à l'écran.                                  |
| `dashboard/Dashboard.tsx`         | Historique de chaque jauge en graphiques.                               |
| `kanban/Kanban.tsx`               | Tableau Kanban de la planification.                                     |
| `kanban/Objective.tsx`            | Objectif de sprint affiché en haut du Kanban.                           |
| `kanban/useDragAndDrop.ts`        | Glisser-déposer souris et tactile du Kanban.                            |
| `team/Team.tsx`                   | Liste de l'équipe et fiche détaillée d'un dev.                          |
| `team/TeamFilterBar.tsx`          | Tri et filtres de l'équipe.                                             |
| `team/filters.ts`                 | Logique des filtres et du tri (fonctions pures).                        |
| `team/Hiring.tsx`                 | Recrutement : candidats, offre, risque de refus.                        |
| `team/Leadership.tsx`             | Bloc « Encadrement » et spécialités de l'équipe web.                    |
| `team/Performance.tsx`            | Note S à D et productivité par sprint.                                  |
| `team/StatBars.tsx`               | Barres de stats d'un dev ou d'un candidat.                              |
| `build/BuildMode.tsx`             | Interface du mode construction.                                         |
| `build/Catalog.tsx`               | Catalogue en bas de l'écran, par rayons, avec l'inventaire.             |
| `build/SelectionBar.tsx`          | Actions sur l'objet sélectionné (tourner, peindre, ranger…).            |
| `build/ColorPicker.tsx`           | Nuancier de peinture.                                                   |
| `build/ComputerPicker.tsx`        | Choix de l'ordinateur d'un poste.                                       |
| `build/MonitorShop.tsx`           | Rayon « Écrans ».                                                       |
| `build/FloorShop.tsx`             | Rayon « Sols ».                                                         |
| `build/WallFinishes.tsx`          | Rayon « Murs » (peintures et papiers peints).                           |
| `build/thumbnails.ts`             | Vignettes 3D des objets du catalogue.                                   |
| `build/storyLock.ts`              | Pourquoi une récompense du mode Histoire n'est pas en vente.            |
| `story/StoryPage.tsx`             | Page des chapitres et des missions du mode Histoire.                    |
| `story/MissionPanel.tsx`          | Panneau « Mission » en jeu : briefing, objectifs en direct, récompense. |
| `story/MissionGoals.tsx`          | Liste des objectifs et contraintes avec leur avancement.                |
| `story/goals.ts`                  | Phrase de chaque objectif (« Livrer 3 features »).                      |
| `meetings/MeetingRoom.tsx`        | Panneau « Réunion » : choix de la formule.                              |
| `servers/ServerRoom.tsx`          | Panneau « Serveurs » : état des salles, offres fibre.                   |
| `lobby/Lobby.tsx`                 | Panneau « Hall d'entrée » : travaux, secrétaires, sécurité.             |
| `pets/Pets.tsx`                   | Panneau « Chats » : adoption et liste des chats.                        |
| `funding/Funding.tsx`             | Panneau « Lever des fonds » : pitch et autres financements.             |
| `group/Group.tsx`                 | Panneau « Investir » : filiales.                                        |
| `slack/SlackDock.tsx`             | Slack ancré dans un coin (ordinateur) ou en bottom sheet (mobile).      |
| `slack/SlackPanel.tsx`            | Les trois canaux et leurs messages.                                     |
| `slack/useSlackAiAvailable.ts`    | Le Slack IA est-il proposé (connecté et clé d'API côté serveur) ?       |
| `meta/MetaPage.tsx`               | Page plein écran du menu avec bouton retour.                            |
| `meta/Leaderboard.tsx`            | Classements global, Daily et par mode, accès aux replays.               |
| `meta/Profile.tsx`                | Profil joueur : statistiques et meilleures parties.                     |
| `meta/Achievements.tsx`           | Liste des succès.                                                       |
| `settings/SettingsPanel.tsx`      | Options : qualité, zoom, audio, Slack IA, accessibilité, langue.        |
| `settings/Credits.tsx`            | Page Crédits : Kenney (CC0), musiques, assets remplacés.                |
| `tutorial/Guide.tsx`              | Affichage du tutoriel interactif.                                       |
| `tutorial/lessons.ts`             | Leçons du tutoriel et moment où chacune se déclenche.                   |
| `admin/AdminPage.tsx`             | Back-office (rôle ADMIN) : onglets cartes, packs, décorations, stats.   |
| `admin/CardEditor.tsx`            | Création et modification d'une carte, avec aperçu.                      |
| `admin/cardFilters.ts`            | Filtres combinables et tri des cartes (fonctions pures).                |
| `admin/DecorTab.tsx`              | Onglet « Décorations ».                                                 |

### `src/audio/`, `src/slack/`, `src/save/`, `src/api/`, `src/i18n/`

| Fichier                | Rôle                                                                     |
| ---------------------- | ------------------------------------------------------------------------ |
| `audio/player.ts`      | Lecteur Howler.js, trois volumes : musique, effets, ambiance.            |
| `audio/manifest.ts`    | Liste des effets sonores attendus (fichiers à déposer).                  |
| `audio/music.ts`       | Playlists de musique selon le moment du jeu, fondus.                     |
| `audio/deskSounds.ts`  | Frappes de clavier et clics de souris des devs quand on zoome.           |
| `slack/store.ts`       | Store du Slack simulé : trois canaux, templates ou IA.                   |
| `slack/templates.ts`   | Bibliothèque de plus de 200 messages contextuels.                        |
| `slack/generator.ts`   | Choisit et remplit un message à partir d'une notification.               |
| `slack/pacing.ts`      | Débit limité du Slack (urgences toujours publiées).                      |
| `save/saves.ts`        | Sauvegardes : automatique (emplacement 1) et manuelles, synchro serveur. |
| `save/storage.ts`      | Stockage hors ligne (IndexedDB, mémoire en secours).                     |
| `save/cards.ts`        | Cartes d'événements du serveur mises en cache.                           |
| `save/achievements.ts` | Succès en attente d'envoi au serveur.                                    |
| `save/packs.ts`        | Packs de personnages actifs mis en cache.                                |
| `save/decor.ts`        | Réglages des décorations de saison mis en cache.                         |
| `save/story.ts`        | Missions réussies gardées sur l'appareil.                                |
| `api/client.ts`        | Client HTTP typé, erreurs avec code traduisible.                         |
| `api/auth.ts`          | Appels d'authentification (cookies httpOnly).                            |
| `api/meta.ts`          | Appels du méta-jeu : sauvegardes, scores, succès, Daily, admin.          |
| `i18n/index.ts`        | Configuration d'i18next.                                                 |
| `i18n/fr.json`         | Textes en français (langue de référence).                                |
| `i18n/en.json`         | Textes en anglais (mêmes clés que le français).                          |

### `tests/` : tests du client

| Dossier       | Contenu                                                                                                                                                                                                                                                                                                                    |
| ------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `simulation/` | Vitest de la simulation, un fichier par module (`pets.test.ts` teste `simulation/pets.ts`…). `fixtures.ts` : états et générateurs truqués. `core.test.ts` : ECS et RNG ; `engine.test.ts` : moteur ; `simulation.test.ts` : parties complètes.                                                                             |
| `unit/`       | Vitest hors simulation, rangés comme `src/` : `ai/`, `audio/`, `render/`, `view/`, `ui/`, `meta/` (menus, sauvegardes, Slack, musique, admin). `setup.ts` : préparation de jsdom ; `fixtures/game.ts` : parties de test ; `meta/helpers.ts` : faux serveur.                                                                |
| `e2e/`        | Playwright sur la vraie pile : `auth.spec.ts` (inscription, connexion), `game.spec.ts` (partie, Kanban, mode construction, caméra), `meta.spec.ts` (sauvegarde, classement, replay, succès), `easy.spec.ts` (tutoriel), `responsive.spec.ts` (375 à 1440 px), `pwa.spec.ts` (hors ligne), `story.spec.ts` (mode Histoire). |

---

## `packages/server` : l'API

| Fichier             | Rôle                                                                           |
| ------------------- | ------------------------------------------------------------------------------ |
| `package.json`      | Paquet `@oss/server` : scripts `dev`, `build`, `test`, `db:*`, `user:promote`. |
| `tsconfig.json`     | TypeScript strict du serveur.                                                  |
| `vitest.config.ts`  | Tests sur une base partagée, exécutés l'un après l'autre.                      |
| `prisma.config.ts`  | Configuration de la CLI Prisma (chemins, URL de la base).                      |
| `.env.example`      | Variables d'environnement du serveur, documentées.                             |
| `scripts/build.mjs` | Build de production en un seul fichier `dist/server.js`.                       |

### `prisma/`

| Fichier                                 | Rôle                                                                                                                                                |
| --------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------- |
| `schema.prisma`                         | Modèle de données : User, Save, EventCard, Score, Achievement…                                                                                      |
| `seed.ts`                               | Données initiales : cartes, succès, compte admin de développement.                                                                                  |
| `migrations/<date>_<nom>/migration.sql` | Une migration SQL par évolution du schéma (init, meta, easy_mode, character_packs, decor_themes, story_mode). Générées par Prisma, ne pas modifier. |
| `migrations/migration_lock.toml`        | Fournisseur de base verrouillé (PostgreSQL).                                                                                                        |

### `src/`

| Fichier                           | Rôle                                                                        |
| --------------------------------- | --------------------------------------------------------------------------- |
| `server.ts`                       | Démarrage du serveur et arrêt propre.                                       |
| `app.ts`                          | Construit l'application Fastify : plugins et routes.                        |
| `config/env.ts`                   | Lecture et validation Zod des variables d'environnement.                    |
| `lib/errors.ts`                   | Erreur métier transformée en `{ error: { code, message } }`.                |
| `lib/prisma.ts`                   | Création du client Prisma.                                                  |
| `lib/schemas.ts`                  | Réponses d'erreur communes pour la doc OpenAPI.                             |
| `plugins/auth.ts`                 | Vérification du JWT, rôles USER et ADMIN.                                   |
| `plugins/errors.ts`               | Gestionnaire d'erreurs global au format homogène.                           |
| `plugins/prisma.ts`               | Expose Prisma (`app.prisma`) et le ferme à l'arrêt.                         |
| `plugins/security.ts`             | Helmet, CORS, cookies, limitation de débit.                                 |
| `plugins/swagger.ts`              | Documentation OpenAPI et Swagger UI sur `/docs`.                            |
| `routes/health.ts`                | `GET /health` : sonde de santé.                                             |
| `routes/auth.ts`                  | Inscription, connexion, déconnexion, refresh, GitHub OAuth.                 |
| `routes/me.ts`                    | `/me` : compte connecté (lecture, modification) et profil joueur.           |
| `routes/saves.ts`                 | CRUD des sauvegardes (5 emplacements).                                      |
| `routes/events.ts`                | `GET /events` : cartes d'événements actives.                                |
| `routes/scores.ts`                | Envoi d'un score (rejoué côté serveur), classements, replays.               |
| `routes/daily.ts`                 | `GET /daily` : graine du jour.                                              |
| `routes/achievements.ts`          | Catalogue des succès et déblocage.                                          |
| `routes/packs.ts`                 | `GET /character-packs` : packs de personnages actifs.                       |
| `routes/decor.ts`                 | `GET /decor-themes` : réglages des décorations.                             |
| `routes/slack-ai.ts`              | Proxy vers l'API Claude pour le Slack IA, avec quota.                       |
| `routes/admin.ts`                 | Back-office : CRUD des cartes, statistiques, packs, décorations.            |
| `routes/story.ts`                 | `/story` : progression et mission réussie (rejouée côté serveur).           |
| `services/user.service.ts`        | Utilisateurs : création, pseudo libre, profil public.                       |
| `services/story.service.ts`       | Missions réussies d'un joueur, vérification et récompenses.                 |
| `services/password.service.ts`    | Hachage des mots de passe (argon2id).                                       |
| `services/session.service.ts`     | JWT d'accès et refresh tokens en cookies httpOnly.                          |
| `services/github.service.ts`      | Échanges avec GitHub pendant l'OAuth.                                       |
| `services/cards.service.ts`       | Lecture et écriture des cartes en base.                                     |
| `services/score.service.ts`       | Enregistrement des scores et classements.                                   |
| `services/replay.service.ts`      | Anti-triche : rejoue la partie avec la simulation du client.                |
| `services/achievement.service.ts` | Recopie le catalogue des succès en base au démarrage.                       |
| `services/packs.service.ts`       | État des packs de personnages.                                              |
| `services/decor.service.ts`       | État des thèmes de décoration.                                              |
| `services/slack-ai.service.ts`    | Appel au modèle Claude et lecture de sa réponse.                            |
| `scripts/promote-admin.ts`        | Donne le rôle ADMIN à un compte (`pnpm --filter @oss/server user:promote`). |

### `tests/`

| Fichier            | Rôle                                                            |
| ------------------ | --------------------------------------------------------------- |
| `global-setup.ts`  | Applique les migrations sur la base de test avant la suite.     |
| `test-database.ts` | Base dédiée aux tests, vidée avant chaque test.                 |
| `helpers.ts`       | Construit une application de test.                              |
| `game-fixtures.ts` | Joue une partie complète avec un bot, comme dans le navigateur. |
| `app.test.ts`      | Santé, format d'erreur, sécurité, OpenAPI.                      |
| `auth.test.ts`     | Inscription, connexion, refresh, déconnexion, rôles.            |
| `github.test.ts`   | Connexion GitHub OAuth (appels simulés).                        |
| `meta.test.ts`     | Sauvegardes, scores, anti-triche, Daily, succès, admin.         |
| `slack-ai.test.ts` | Slack IA : quota, cache, repli en cas d'erreur.                 |
| `story.test.ts`    | Mode Histoire : mission rejouée, progression, récompenses.      |

---

## Où chercher quoi

| Je veux…                              | Je regarde                                                                                              |
| ------------------------------------- | ------------------------------------------------------------------------------------------------------- |
| changer un chiffre d'équilibrage      | `packages/shared/src/sim/balance.ts`                                                                    |
| ajouter un objet au mode construction | `shared/src/sim/furniture.ts`, puis `client/src/view/catalog.ts` et son rendu dans `client/src/render/` |
| ajouter une commande du joueur        | `shared/src/sim/commands.ts`, puis `client/src/simulation/commands.ts`                                  |
| ajouter une carte d'événement         | `packages/shared/src/data/cards/` (le seed la met en base)                                              |
| ajouter un succès                     | `packages/shared/src/meta/achievements.ts`                                                              |
| ajouter un texte traduit              | `packages/client/src/i18n/fr.json` et `en.json`                                                         |
| ajouter une route d'API               | `packages/server/src/routes/`, schéma dans `shared/src/meta/api.ts`                                     |
| modifier la base de données           | `packages/server/prisma/schema.prisma`, puis `pnpm db:migrate`                                          |
| comprendre une partie déterministe    | `client/src/simulation/rng.ts`, `replay.ts`, `README.md`                                                |
| relier la simulation à l'affichage    | `packages/client/src/view/adapter.ts`                                                                   |
