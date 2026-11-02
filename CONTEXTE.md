# Contexte de passation

> **Dernière mise à jour : 2 novembre 2026**, par Claude (projet de Thomas), après la fusion des
> PR de Melvin dans `develop`. Dernier commit de `develop` : `a6121c2` (PR #135, mode illimité) ;
> dernier commit de `main` : `9f71139` (PR #122, mode Histoire).

Ce fichier sert de relais entre **Thomas** (`7h0mas92`) et **Melvin** (`melvinvallot`), et entre
leurs sessions Claude respectives. Il dit où en est le projet, ce qui est en cours, ce qui attend
une décision et comment on travaille. Le cahier des charges et la liste détaillée de tout ce qui
est livré restent dans [`CLAUDE.md`](CLAUDE.md) (section « ÉTAT D'AVANCEMENT ») ; la doc
technique complète est dans [`README.md`](README.md).

## Règle : mettre ce fichier à jour à la fin de chaque travail

À la fin de chaque fil de discussion ou de chaque PR (humain ou Claude, Thomas ou Melvin) :

1. Mettre à jour la date et le dernier commit en haut du fichier.
2. Mettre à jour [Travaux en cours](#travaux-en-cours) et
   [En attente d'une décision](#en-attente-dune-décision) (ajouter, déplacer, supprimer).
3. Ajouter une ligne en haut du [Journal des passations](#journal-des-passations) : date, qui,
   PR, ce qui a changé, ce que l'autre doit savoir.
4. Si une nouvelle convention est née (graine à part, champ d'état, test imposé…), l'ajouter dans
   [Conventions techniques](#conventions-techniques).
5. Le faire dans la même PR que la fonctionnalité, ou dans la PR `docs:` qui met à jour
   `CLAUDE.md` et `README.md` juste après.

Ne jamais écrire de secret ici (clé d'API, mot de passe de production, jeton). Les seuls
identifiants cités sont ceux de développement local, déjà publics dans le dépôt.

---

## Sommaire

1. [En une minute](#en-une-minute)
2. [Travaux en cours](#travaux-en-cours)
3. [En attente d'une décision](#en-attente-dune-décision)
4. [Qui fait quoi et comment](#qui-fait-quoi-et-comment)
5. [Où sont les choses](#où-sont-les-choses)
6. [Installer et lancer](#installer-et-lancer)
7. [Conventions techniques](#conventions-techniques)
8. [Pièges connus](#pièges-connus)
9. [Journal des passations](#journal-des-passations)
10. [Historique des PR](#historique-des-pr)
11. [Prompt de reprise pour Claude Code](#prompt-de-reprise-pour-claude-code)

---

## En une minute

- **Projet** : « Open Space Simulator 2026 », jeu de gestion de startup en 3D low-poly
  isométrique dans le navigateur (projet de 3e année de Bachelor développement web, soutenance
  prévue). Pitch : « Ta startup a levé 2 millions. Tu as 18 mois avant que tout explose. »
- **État** : les 12 étapes du plan sont livrées, plus une centaine d'ajouts validés (PR #1 à
  #119, toutes fusionnées, **aucune PR ouverte** au 13 octobre). La liste complète est dans
  `CLAUDE.md`, section « ÉTAT D'AVANCEMENT ».
- **Jeu en ligne** (invité seulement, redéployé à chaque fusion dans `main`) :
  https://7h0mas92.github.io/Open_Space_Simulator/
- **Langue** : tout est en français (code commenté, commits, PR, échanges) ; le jeu est en FR et
  EN.

## Travaux en cours

| Sujet                                               | Qui             | État                                              |
| --------------------------------------------------- | --------------- | ------------------------------------------------- |
| Mode **Histoire** (campagne en chapitres)           | Thomas + Claude | Fusionné le 2 novembre (PR #122)                  |
| Mode **Carrière** (reproduire de grandes réussites) | Thomas + Claude | Fil séparé, en cours                              |
| Mode **illimité** et classement des entreprises     | Melvin + Claude | Fusionné dans `develop` le 2 novembre (PR #135)   |
| Offres internet et température des salles (#129)    | Melvin + Claude | À rebrancher sur le modèle des abonnements (#126) |
| Hall d'entrée, accueil et sécurité (#134)           | Melvin + Claude | Brouillon, à mettre à jour avec `develop`         |

**Mode Histoire** (choix de Thomas, idée n°1) : 4 chapitres (Garage, Seed, Série A, Licorne),
10 missions courtes avec un point de départ, des objectifs, des contraintes et une durée en
sprints (`packages/shared/src/story/campaign.ts`). Chaque mission réussie ouvre la suivante et
débloque une récompense **nouvelle** (2 papiers peints, 2 sols, 2 couleurs, 2 objets, 2 bonus de
départ : `packages/shared/src/story/rewards.ts`) : aucun objet existant n'a été retiré des
autres modes. Équilibrage : `pnpm balance:story`.

**Mode Carrière** : essayer de reproduire les performances d'anciennes startups devenues de
grandes entreprises (Apple, Google…), **sans jamais citer leur nom directement** (noms parodiques
ou allusions seulement, comme pour les super-héros inventés).

**Proposition à valider pour les deux modes** : les objets débloqués sont utilisables en Normal,
Facile, Illimité et dans les modes défi, **jamais en Daily** (pour garder le Daily, les classements et le
rejeu anti-triche du serveur équitables). Déblocages gardés sur le compte, et en local pour les
invités. C'est ce que fait le mode Histoire (`UNLOCK_MODES` dans `packages/shared/src/game.ts`).

## En attente d'une décision

- **Succès « Décaféiné »** (5 jours sans café, `packages/shared/src/meta/achievements.ts`) :
  depuis le télétravail automatique, il ne se débloque plus que dans ~1 % des parties (contre
  ~20 % avant). Proposition : réduire un peu le café livré par la cuisine. Thomas n'a pas tranché
  (question du 8 octobre) ; ne rien changer sans son accord.
- **Comptes en ligne** (actions de Thomas, étapes dans le README, section Déploiement) : Render
  (Blueprint `render.yaml`), URL Render dans `packages/client/vercel.json`, projet Vercel (Root
  Directory `packages/client`), OAuth App GitHub. En attendant, la version GitHub Pages n'a ni
  comptes, ni classements, ni Daily en ligne, ni Slack IA, ni packs, ni back-office.
- **Effets sonores et ambiance** : le lecteur Howler est prêt mais `SOUND_FILES` est vide dans
  `packages/client/src/audio/manifest.ts`. Les musiques (7 MP3 dans
  `packages/client/public/assets/music/`) et les bruits de clavier et de souris sont faits.
  Thomas fournit ses propres sons (pas de Kenney) ; noms prévus : `musique`→`music`,
  `ambiance`→`keyboard`, `clic`→`click`, `succes`→`success`, `erreur`→`error`, `alarme`→`alarm`,
  `argent`→`cash`, `niveau`→`levelUp`. Les convertir en MP3 avant de les commiter.

---

## Qui fait quoi et comment

- **Thomas** (`7h0mas92`, propriétaire du dépôt) travaille avec Claude dans un projet Claude :
  une demande = un fil = une branche `claude/…` = une PR. Il valide chaque PR (« je valide »,
  « parfait », « vas-y ») avant que Claude la fusionne.
- **Melvin** (`melvinvallot`) travaille avec son propre Claude, hors du projet de Thomas. Il a
  fusionné les PR #37 à #119 (9 au 11 octobre). Son rythme : une PR `feat:` ou `fix:`, puis une
  petite PR `docs:` qui met à jour `CLAUDE.md` et `README.md`.
- **Branches** : tout le travail part de `develop` et y revient par une PR ; `main` ne reçoit
  que les PR `develop` → `main` validées par Thomas et Melvin (détail dans `CLAUDE.md`, section
  « BRANCHES », et dans le README, section « Branches et contributions »).
- **Avant de commencer** : `git pull` sur `develop`, lire le haut de ce fichier et le journal, puis
  vérifier les PR ouvertes de l'autre pour éviter de toucher aux mêmes fichiers.

Règles fixées par Thomas (à respecter par tout le monde) :

1. Livrer une version jouable, résumer, expliquer comment tester, **attendre la validation**
   avant de fusionner.
2. PR avec « Before: / After: / How », captures desktop (1440 px) et mobile (375 px), CI verte.
3. PR vers `develop`, squash merge ; intégrer `develop` d'abord si d'autres PR sont passées.
   Mise en production : PR `develop` → `main` en merge commit, après les tests de Thomas et
   Melvin. Un correctif urgent va sur `main`, puis `main` est fusionnée dans `develop`.
4. Après chaque fusion : mettre à jour `CLAUDE.md` (« ÉTAT D'AVANCEMENT »), `README.md` **et ce
   fichier**.
5. Commits conventionnels en français (`feat:`, `fix:`, `docs:`…), vérifiés par husky +
   commitlint ; lignes du corps ≤ 100 caractères.
6. Ne jamais inventer un nom de fichier d'asset (partir de `ls -R`) ; un modèle manquant devient
   une forme Three.js notée dans les « assets manquants » (page Crédits + README).
7. Ne jamais retirer une fonctionnalité sans l'accord de Thomas ; proposer une meilleure solution
   technique avant de l'appliquer.
8. Responsive obligatoire : 375, 768, 1024, 1440 px, portrait et paysage, cibles tactiles
   ≥ 44 px.
9. Aucun secret dans le dépôt ni dans les messages.
10. Pas de marque, de personnage ni de logo protégé (MacBook « sans logo », écouteurs génériques,
    super-héros inventés, et maintenant entreprises jamais nommées en mode Carrière).

## Où sont les choses

| Quoi                                             | Où                                                                                                              |
| ------------------------------------------------ | --------------------------------------------------------------------------------------------------------------- |
| Dépôt                                            | https://github.com/7h0mas92/Open_Space_Simulator (`develop` en test, `main` publiée)                            |
| Cahier des charges + état d'avancement           | `CLAUDE.md`                                                                                                     |
| Installation, architecture, déploiement, crédits | `README.md`                                                                                                     |
| Ce relais                                        | `CONTEXTE.md`                                                                                                   |
| Rôle et emplacement de chaque fichier            | `ARBORESCENCE.md`                                                                                               |
| Rapport d'équilibrage (10 000 parties)           | `docs/balance.md`                                                                                               |
| Captures du README                               | `docs/screenshots/`                                                                                             |
| Rôle de chaque dossier du client                 | `packages/client/src/README.md`                                                                                 |
| Interface de la simulation                       | `packages/client/src/simulation/README.md`                                                                      |
| Constantes partagées de chaque système           | `packages/shared/src/sim/*.ts` (balance, furniture, pets, floors, serverRoom…)                                  |
| Succès (65, dont 22 secrets)                     | `packages/shared/src/meta/achievements.ts`                                                                      |
| 100 cartes d'événements                          | `packages/shared/src/data/cards/`                                                                               |
| Modes de jeu                                     | `GAME_MODES` dans `packages/shared/src/game.ts` (EASY, NORMAL, HARDCORE, INTERNS_ONLY, SHIP_IN_3, DAILY, STORY) |
| Mode Histoire (chapitres, missions, récompenses) | `packages/shared/src/story/`, `packages/client/src/simulation/story.ts`, `packages/client/src/ui/story/`        |
| Bots de `pnpm balance`                           | `packages/client/src/simulation/bots.ts` (random, shipper, balanced, cautious, investor, organizer, financier)  |
| Assets Kenney (déjà commités)                    | `packages/client/public/assets/kenney/` (Furniture Kit, Blocky Characters)                                      |
| Musiques et sons                                 | `packages/client/public/assets/music/`, `packages/client/public/assets/sounds/`                                 |
| Variables d'environnement                        | `packages/server/.env.example`, `packages/client/.env.example`                                                  |
| Déploiement                                      | `render.yaml`, `packages/client/vercel.json`, `.github/workflows/pages.yml`                                     |
| CI                                               | `.github/workflows/ci.yml` (lint, format, typecheck, tests, build, e2e)                                         |

## Installer et lancer

Prérequis : Node 22.12 ou plus (`.nvmrc`), pnpm 10 via `corepack enable`, Docker (PostgreSQL 16
seulement, pas de Dockerfile).

```bash
git clone https://github.com/7h0mas92/Open_Space_Simulator.git
cd Open_Space_Simulator
corepack enable
pnpm install
cp packages/server/.env.example packages/server/.env
pnpm db:up && pnpm db:migrate && pnpm db:seed
pnpm dev   # jeu sur localhost:5173, API et Swagger sur localhost:3000/docs
```

- Base : `pnpm --filter @oss/server db:studio` (localhost:5555) ou
  `docker compose exec db psql -U oss -d oss` (dev : `oss` / `oss` / `oss`).
- Compte admin créé par le seed (dev uniquement) : `admin@oss.local` / `admin-dev-password`.
- Avant de pousser : `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`.
- `pnpm balance` (ou `pnpm balance --games 2000` pour aller vite) : rapport dans
  `packages/client/reports/balance.md`, à recopier dans `docs/balance.md`.

## Conventions techniques

Les plus importantes ; le détail est dans `CLAUDE.md` et le README.

- **Abonnements** (`shared/sim/subscriptions.ts`, `client/src/simulation/subscriptions.ts`) : tout
  service payé à intervalle régulier y passe. Ajouter un service = son id dans
  `SUBSCRIPTION_SERVICES`, sa fiche dans `SUBSCRIPTION_SERVICE_INFO`, ses offres dans
  `SUBSCRIPTION_OFFERS`, une installation éventuelle dans `REQUIREMENT_CHECKS`, ses textes dans
  `subscriptions.services.<id>`. Les autres systèmes lisent `activeOffer(state, service)`.
- **Difficulté d'un mode** : toujours via `difficultyOf(mode)` (`shared/sim/difficulty.ts`),
  jamais un `mode === 'EASY'` codé en dur ; le profil neutre (1 partout) garde le Normal et le
  Daily identiques au bit près.
- **Simulation déterministe** (`packages/client/src/simulation`, ECS en TypeScript pur) : RNG
  sfc32 dans l'état, 1 pas = 30 min, 672 pas par sprint, 39 sprints. ESLint y interdit three,
  React, le DOM, `Math.random`, `Date.now`, `Math.log/exp/pow/sin`.
- **Ne jamais consommer le RNG de la partie pour une fonctionnalité annexe** : tirer sur une
  graine à part (`seed#tasks#…`, `seed#meeting#tick`, `seed#pet#n`, `seed#web-roles#sprint`…).
  Sinon les replays, le Daily, les sauvegardes et les scores déjà enregistrés cassent. Les PR
  l'écrivent « aucun tirage » ou « graine à part ».
- **Abonnements payés à la semaine** (fibre, ménage) : tick `paidUntil`, facture dans un système, ligne coupée si la trésorerie manque, coût mensuel ajouté au calcul des mois de trésorerie (`runwayMonths`).
- **Nouveaux champs d'état** : optionnels ou `.default()` en Zod (anciennes sauvegardes) ; un
  identifiant d'objet renommé passe par une table de traduction (`LEGACY_FURNITURE_IDS`,
  `LEGACY_KITCHEN_ITEMS`).
- **Frontière rendu / UI** : `view/types.ts` (`GameView`, `GameCommand`), `view/adapter.ts`. Ne
  jamais lire `GameState` depuis `ui/` ou `render/` ; le rendu ne modifie jamais l'état.
- **Mode construction** : passer par les actions du store (`enterBuild`, `pickItem`, `placeAt`…),
  réutiliser `nearestValidCell` et `shopStatus` (`view/placement.ts`). Chaque objet du catalogue
  a un rendu distinct (test) ; chaque bureau a une place d'écran (`SCREEN_MOUNTS`, test) ; chaque
  forme Three.js a une entrée `credits.missingItems` en FR et EN.
- **Serveur** : toutes les routes sous `/api`, erreurs `{ error: { code, message } }`, le serveur
  rejoue graine + commandes pour vérifier un score (il embarque la simulation du client).
- **Mode Histoire** : une mission est une partie `STORY` (`GameConfig.mission`), terminée par
  `result.mission` (issue « zombie », sans classement ni succès de fin). Les récompenses de la
  partie sont fixées au départ dans `state.unlocks` (comme la graine) et envoyées avec le score
  (`unlocks`) : le serveur vérifie qu'elles sont gagnées et les rejoue. Un contenu réservé porte
  un champ `unlock` (meuble, papier peint, sol) ou est dans `COLOR_UNLOCKS`. `MENU_MODES` = les
  modes du menu et des classements (sans STORY).
- **Textes** : toujours en FR et EN (`packages/client/src/i18n/fr.json`, `en.json`).
- **Versions figées** : TypeScript 6.0, Prisma 7.10 (`@prisma/adapter-pg`), Zod 4, Fastify 5,
  Vite 8, Vitest 5, Playwright 1.56.1, Node 22, pnpm 10.28, PostgreSQL 16.

## Pièges connus

- `ERR_MODULE_NOT_FOUND …/src/generated/prisma/client.js` → `pnpm --filter @oss/server db:generate`.
- `ERR_MODULE_NOT_FOUND …/@oss/shared/dist/index.js` → `pnpm --filter @oss/shared build`.
- Les tests serveur ont besoin de PostgreSQL (`pnpm db:up`) ; ils utilisent `oss_test` et les e2e
  `oss_e2e`, jamais la base `oss`.
- Le test e2e responsive refuse une cible tactile de moins de 44 px à 375 px.
- Captures headless : Chromium logiciel tourne à ~2 fps ; le jeu passe en qualité basse quand
  WebGL n'a pas de carte graphique.
- GitHub Pages : source « GitHub Actions », `BASE_PATH=/Open_Space_Simulator/`.

---

## Journal des passations

Le plus récent en haut. Une ligne par travail terminé.

| Date     | Qui             | PR                | Ce qui a changé / à savoir                                                                                                                                                                                                                                                                                                                                                             |
| -------- | --------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 02/11    | Melvin + Claude | (docs develop)    | Daily et Kanbanana (#133) décrits dans `CLAUDE.md` et le README. Nouveau champ `morningSync` et stat `duplicateWork` (défauts pour les anciennes sauvegardes). Idées de suite proposées à Melvin pour le Daily : blocage signalé, pair programming, Daily qui dérape, retard, rétro de fin de sprint, succès.                                                                          |
| 02/11    | Thomas + Claude | #123 à #135       | CI de nouveau active. `develop` avancé jusqu'à `main` (mode Histoire), puis 11 PR de Melvin fusionnées dans `develop` après résolution des conflits : #123 à #128, #130 à #133, #135. Ménage à côté du modèle des abonnements, frais de l'illimité et du Hardcore cumulés, doublons du journal retirés. Restent #129 (à refaire sur les abonnements) et #134 (brouillon).              |
| 02/11    | Thomas + Claude | #122              | Mode Histoire validé par Thomas (récompenses nouvelles) et fusionné sans CI (GitHub Actions bloqué), vérifié en local.                                                                                                                                                                                                                                                                 |
| 18/10    | Melvin + Claude | (PR develop)      | Saleté du bureau (0 à 100 %, -20 % de travail à 50 %) et entreprise de nettoyage Nickel Chrome : appel, express, abonnement hebdo (`shared/sim/cleaning.ts`, `simulation/cleaning.ts`, `render/cleaning.ts`, bouton 🧹). Champ `cleaning` par défaut ; règle qui change toutes les parties (anciens replays de scores divergent). À brancher sur le futur modèle commun d'abonnements. |
| 18/10    | Melvin + Claude | develop           | Difficulté par mode (`difficultyOf`) : Facile moins généreux, Hardcore vraiment dur. Normal et Daily inchangés.                                                                                                                                                                                                                                                                        |
| 18/10    | Melvin + Claude | develop           | Mode illimité `ENDLESS` (pression après 18 mois) et classement des entreprises (menu et jeu, en ligne ou appareil). Un mode non comparable va dans `GLOBAL_EXCLUDED_MODES`.                                                                                                                                                                                                            |
| 17/10    | Melvin + Claude | #123              | Branche `develop` créée depuis `main` : les PR vont vers `develop`, puis `develop` → `main` après les tests de Thomas et Melvin.                                                                                                                                                                                                                                                       |
| 17/10    | Melvin + Claude | à venir           | Ajout de `ARBORESCENCE.md` : rôle de chaque fichier. Toute PR qui ajoute ou déplace un fichier met sa ligne à jour.                                                                                                                                                                                                                                                                    |
| 17/10    | Melvin + Claude | fix/objet_fantome | Plus de décorations de saison au sol (fantôme, chaudron, sapin…) : ni déplaçables ni rangeables. Restent guirlandes et objets sur les bureaux. À valider par Thomas (fonctionnalité retirée).                                                                                                                                                                                          |
| 17/10    | Melvin + Claude | fix/sol_couleur   | Sol d'origine identique dans toutes les pièces (`BASE_FLOOR_COLORS`), plus de décor de sol tiré de la graine ; seul le rayon Sols le change.                                                                                                                                                                                                                                           |
| 17/10    | Melvin + Claude | (develop)         | Rubrique Abonnements (🧾 en haut) : modèle commun `subscriptions` (un abonnement par service, facturation à l'échéance, coupure si impayé, `requires`). La fibre y est passée ; ménage, internet et sécurité s'y branchent.                                                                                                                                                            |
| 13/10    | Thomas + Claude | #122              | Mode Histoire : 4 chapitres, 10 missions, 10 récompenses pour les autres modes (jamais en Daily). Progression vérifiée par rejeu (`POST /api/story/complete`, table `StoryMission`), `Score.unlocks`. `pnpm balance:story`.                                                                                                                                                            |
| 13/10    | Thomas + Claude | #120              | Création de `CONTEXTE.md`. Modes Histoire et Carrière décidés, chacun dans son fil.                                                                                                                                                                                                                                                                                                    |
| 11/10    | Melvin          | #109 à #119       | Sols par pièce, décor des annexes déplaçable, le plan cède la place aux meubles, salle des serveurs et fibre, bruits de souris.                                                                                                                                                                                                                                                        |
| 10–11/10 | Melvin          | #93 à #108        | Cuisine séparée, ordinateurs et écrans des postes, murs fins, vidéoprojecteurs, bruits de clavier.                                                                                                                                                                                                                                                                                     |
| 9–10/10  | Melvin          | #37 à #92         | Filtres d'équipe, pause pendant les cartes, augmentations, levées de fonds, tâches dynamiques et par métier, réunions, fenêtres, chats, équipe web, musiques, meubles détaillés, papiers peints, mise à jour du jeu installé, New York réaliste.                                                                                                                                       |
| 8/10     | Thomas + Claude | #18 à #36         | Équilibrage, HUD, télétravail, back-office, personnages et packs, horloge continue, saisons, filiales, pauses.                                                                                                                                                                                                                                                                         |
| 6–7/10   | Thomas + Claude | #1 à #17          | Les 12 étapes du plan, construction, succès, menu.                                                                                                                                                                                                                                                                                                                                     |

## Historique des PR

Les PR #1 à #120 sont fusionnées dans `main` ; les suivantes passent par `develop`. Le détail de chaque fonctionnalité est dans `CLAUDE.md`.

| PR     | Contenu                                                                                                                                                                                                       |
| ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1–6    | Socle, simulation, scène 3D, modèles Kenney, méta-jeu et livraison, GitHub Pages                                                                                                                              |
| 7–17   | Mode Facile, zoom, caméra, démarrage local, construction, succès, menu, rendu des objets, comptes sans serveur                                                                                                |
| 18–36  | Équilibrage, interface de jeu, télétravail, back-office, options, personnages et packs, horloge continue, performance, écrans et éclairage, saisons, accessoires et couleurs, filiales, pauses                |
| 37–47  | Filtres d'équipe, pause pendant les cartes, augmentations, baies vitrées et New York, écouteurs et cactus, inventaire, tâches par métier, levées de fonds et annexes                                          |
| 48–65  | Tâches dynamiques, salles de réunion, « Continuer », fenêtres, variété des tâches, chats, équipe web, musiques                                                                                                |
| 66–92  | Réunions du matin et de crise, chats réalistes, souris, clavier QWERTY, canapé et bibliothèque, plantes, meubles détaillés, papiers peints, mise à jour du jeu, version au menu, écouteurs, New York réaliste |
| 93–119 | Cuisine séparée, ordinateurs, murs fins, vidéoprojecteurs, bruits de bureau, écrans des postes, décor des annexes, sols, salle des serveurs et fibre                                                          |

## Prompt de reprise pour Claude Code

Claude Code lit `CLAUDE.md` tout seul. Pour reprendre, commencer la session par :

```text
Lis CLAUDE.md et CONTEXTE.md en entier. Fais un git pull sur develop, regarde les PR ouvertes,
puis lance pnpm lint, pnpm typecheck et pnpm test pour vérifier que tout est vert. Respecte les
règles de CONTEXTE.md (français, une PR par demande, captures desktop et mobile, CI verte,
validation avant fusion, jamais le RNG de la partie, aucun secret). À la fin du travail, mets à
jour CONTEXTE.md (en-tête, travaux en cours, journal) en plus de CLAUDE.md et du README.
```
