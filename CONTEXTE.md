# Contexte de passation

> **Dernière mise à jour : 3 novembre 2026**, par Claude (projet de Thomas) : curseur « Musique »
> réparé sur iPhone et iPad (#163, volume par Web Audio, `audio/musicTrack.ts`). Avant : arbre R&D
> des objets (T4, #160), levées de fonds lisibles (#161),
> histoire en 5 actes (T2) fusionnée dans `develop` (#157, puis équilibrage #159) ;
> plus tôt, modèle économique (#151), clients B2B (#153) et support client
> (#154) de Melvin, panneau « 💶 Business ».

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
- **Jeu en ligne avec comptes** (Vercel, redéployé à chaque fusion dans `main`) :
  https://open-space-simulator.vercel.app, serveur Render `https://oss-server-e90i.onrender.com`
  (endormi après 15 min sans visite, ~50 s au réveil), base Supabase `open-space-simulator`.
  Version invité seule : https://7h0mas92.github.io/Open_Space_Simulator/
- **Langue** : tout est en français (code commenté, commits, PR, échanges) ; le jeu est en FR et
  EN.

## Travaux en cours

| Sujet                                               | Qui             | État                                             |
| --------------------------------------------------- | --------------- | ------------------------------------------------ |
| Mode **Histoire** (campagne en chapitres)           | Thomas + Claude | Fusionné le 2 novembre (PR #122)                 |
| Mode **Carrière** (reproduire de grandes réussites) | Thomas + Claude | Fusionné (#121), réintégré dans `develop` (T1)   |
| Mode **illimité** et classement des entreprises     | Melvin + Claude | Fusionné dans `develop` le 2 novembre (PR #135)  |
| Offres internet et température des salles (#129)    | Melvin + Claude | Fusionné dans `develop` le 2 novembre (PR #129)  |
| Hall d'entrée, accueil et sécurité (#134)           | Melvin + Claude | Fusionné dans `develop` le 2 novembre            |
| Remettre `main` dans `develop` (T1)                 | Thomas + Claude | Fusionné dans `develop` le 2 novembre (PR #148)  |
| **Base de données sur Supabase** (production)       | Thomas + Claude | Fusionné le 2 novembre (PR #138)                 |
| **Arbre de compétences** des devs (T3)              | Thomas + Claude | PR #150 fusionnée dans `develop`                 |
| Histoire en 5 actes, rivaux (T2)                    | Thomas + Claude | #157 et #159 fusionnées le 3 novembre            |
| Levées de fonds cohérentes avec l'affichage         | Thomas + Claude | Fusionnée dans `develop` le 3 novembre (#161)    |
| Arbre R&D des objets (T4)                           | Thomas + Claude | Fusionnée dans `develop` le 3 novembre (PR #160) |
| Congés, rétrospective, team building (T5)           | Thomas + Claude | Fusionné le 2 novembre en une PR (#156)          |
| Économie : modèle, B2B, support (M3)                | Melvin + Claude | Fusionné dans `develop` le 3 novembre            |
| Économie : marketing (M3)                           | Melvin          | Idée, rien de codé                               |

**Partage du 2 novembre** : Melvin garde les abonnements, le bureau et l'économie ; Thomas prend la
progression et la vie de l'équipe. Détail, dépendances, fichiers à éviter et prompts prêts à coller
dans [`docs/PASSATION-THOMAS.md`](docs/PASSATION-THOMAS.md).

**Mode Histoire** (choix de Thomas, idée n°1) : 4 chapitres (Garage, Seed, Série A, Licorne),
10 missions courtes avec un point de départ, des objectifs, des contraintes et une durée en
sprints (`packages/shared/src/story/campaign.ts`). Chaque mission réussie ouvre la suivante et
débloque une récompense **nouvelle** (2 papiers peints, 2 sols, 2 couleurs, 2 objets, 2 bonus de
départ : `packages/shared/src/story/rewards.ts`) : aucun objet existant n'a été retiré des
autres modes. Équilibrage : `pnpm balance:story`.

**Mode Carrière** (PR #121, fusionné le 2 novembre) : 8 légendes jamais nommées
(Pépin Computer, Matelas & Céréales, Rembobine, MicroMou, Trombinoscope, Orénoque, Centillion,
Ampère Motors), chacune avec son départ et 4 jalons, étoiles à la fin. Détail dans `CLAUDE.md`.
Pas de récompense du mode Histoire en Carrière (hors `UNLOCK_MODES`), pour que chaque légende
se joue pareil pour tous. Migration Prisma `20261102090000_career_mode`, après celle du mode Histoire.

**Proposition à valider pour les deux modes** : les objets débloqués sont utilisables en Normal,
Facile, Illimité et dans les modes défi, **jamais en Daily** (pour garder le Daily, les classements et le
rejeu anti-triche du serveur équitables). Déblocages gardés sur le compte, et en local pour les
invités. C'est ce que fait le mode Histoire (`UNLOCK_MODES` dans `packages/shared/src/game.ts`).

## En attente d'une décision

- **GitHub Actions** : bloqué du 13 octobre au 2 novembre (jobs arrêtés en 3 secondes, sans
  runner). Le 2 novembre, les jobs démarrent de nouveau sur des runners ; vérifier quand même en
  local avant de fusionner. Les modes Histoire (`STORY`) et Carrière (`CAREER`) sont dans
  `GAME_MODES` ; un nouveau mode doit les garder (`STORY` hors `MENU_MODES` et `UNLOCK_MODES`,
  `CAREER` hors `UNLOCK_MODES` et dans `GLOBAL_EXCLUDED_MODES`).

- **Mode Carrière (PR #121, fusionné)** : les jalons ont été calibrés
  avec les bots de `pnpm balance` (Pépin et Matelas faciles, Centillion, Orénoque et Ampère
  durs) ; à ajuster si Thomas les trouve trop durs ou trop faciles en jouant.
- **Carrière hors du classement global** (choix fait en réintégrant `main`, à confirmer par
  Thomas) : chaque légende part d'une trésorerie différente, donc la Carrière a son onglet mais
  ne se mélange plus au Normal dans le classement global (`GLOBAL_EXCLUDED_MODES`).
- **Succès « Décaféiné »** (5 jours sans café, `packages/shared/src/meta/achievements.ts`) :
  depuis le télétravail automatique, il ne se débloque plus que dans ~1 % des parties (contre
  ~20 % avant). Proposition : réduire un peu le café livré par la cuisine. Thomas n'a pas tranché
  (question du 8 octobre) ; ne rien changer sans son accord.
- **Connexion GitHub** (action de Thomas, étapes dans le README, section Déploiement) : les
  comptes email + mot de passe marchent en ligne depuis le 2 novembre. Reste l'OAuth App GitHub
  (callback `https://open-space-simulator.vercel.app/api/auth/github/callback`), puis
  `GITHUB_CLIENT_ID` / `GITHUB_CLIENT_SECRET` sur Render ; facultatif : `ANTHROPIC_API_KEY` pour
  le Slack IA.
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

| Quoi                                             | Où                                                                                                                               |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Dépôt                                            | https://github.com/7h0mas92/Open_Space_Simulator (`develop` en test, `main` publiée)                                             |
| Cahier des charges + état d'avancement           | `CLAUDE.md`                                                                                                                      |
| Installation, architecture, déploiement, crédits | `README.md`                                                                                                                      |
| Ce relais                                        | `CONTEXTE.md`                                                                                                                    |
| Rôle et emplacement de chaque fichier            | `ARBORESCENCE.md`                                                                                                                |
| Rapport d'équilibrage (10 000 parties)           | `docs/balance.md`                                                                                                                |
| Captures du README                               | `docs/screenshots/`                                                                                                              |
| Rôle de chaque dossier du client                 | `packages/client/src/README.md`                                                                                                  |
| Interface de la simulation                       | `packages/client/src/simulation/README.md`                                                                                       |
| Constantes partagées de chaque système           | `packages/shared/src/sim/*.ts` (balance, furniture, pets, floors, serverRoom…)                                                   |
| Succès (70, dont 22 secrets)                     | `packages/shared/src/meta/achievements.ts`                                                                                       |
| 100 cartes d'événements                          | `packages/shared/src/data/cards/`                                                                                                |
| Modes de jeu                                     | `GAME_MODES` dans `packages/shared/src/game.ts` (EASY, NORMAL, HARDCORE, INTERNS_ONLY, SHIP_IN_3, ENDLESS, DAILY, STORY, CAREER) |
| Mode Histoire (chapitres, missions, récompenses) | `packages/shared/src/story/`, `packages/client/src/simulation/story.ts`, `packages/client/src/ui/story/`                         |
| Mode Carrière (légendes, jalons, étoiles)        | `packages/shared/src/sim/career.ts`, `packages/client/src/simulation/career.ts`, `packages/client/src/ui/career/`                |
| Bots de `pnpm balance`                           | `packages/client/src/simulation/bots.ts` (random, shipper, balanced, cautious, investor, organizer, financier)                   |
| Assets Kenney (déjà commités)                    | `packages/client/public/assets/kenney/` (Furniture Kit, Blocky Characters)                                                       |
| Musiques et sons                                 | `packages/client/public/assets/music/`, `packages/client/public/assets/sounds/`                                                  |
| Variables d'environnement                        | `packages/server/.env.example`, `packages/client/.env.example`                                                                   |
| Déploiement                                      | `render.yaml`, `packages/client/vercel.json`, `.github/workflows/pages.yml`                                                      |
| CI                                               | `.github/workflows/ci.yml` (lint, format, typecheck, tests, build, e2e)                                                          |

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
- **Arbre R&D** (`shared/sim/research.ts`) : en histoire en actes, tout contenu achetable (objet, ordinateur, écran, mur, sol, formule de salle) doit être dans `RESEARCH_FREE` ou dans un niveau de `RESEARCH_TREE`, sinon `research.test.ts` échoue. Vérifier aussi `researchUnlocked(state, clé)` dans la commande d'achat d'un nouveau type de contenu.
- **Bonus sans tirage** (arbre de compétences, encadrement) : sans le bonus, le multiplicateur
  vaut exactement 1 (multiplier par 1 ne change aucun bit). Un bonus qui change une probabilité
  garde le même appel `rng.chance(p)` avec un autre `p`, jamais un tirage de plus ou de moins.
- **Nouveaux champs d'état** : optionnels ou `.default()` en Zod (anciennes sauvegardes) ; un
  identifiant d'objet renommé passe par une table de traduction (`LEGACY_FURNITURE_IDS`,
  `LEGACY_KITCHEN_ITEMS`).
- **Frontière rendu / UI** : `view/types.ts` (`GameView`, `GameCommand`), `view/adapter.ts`. Ne
  jamais lire `GameState` depuis `ui/` ou `render/` ; le rendu ne modifie jamais l'état.
- **Mode construction** : passer par les actions du store (`enterBuild`, `pickItem`, `placeAt`…),
  réutiliser `nearestValidCell` et `shopStatus` (`view/placement.ts`). Chaque objet du catalogue
  a un rendu distinct (test) ; chaque bureau a une place d'écran (`SCREEN_MOUNTS`, test) ; chaque
  forme Three.js a une entrée `credits.missingItems` en FR et EN.
- **Positions à la demi-case** : `x` / `y` des objets sont des multiples de 0,5
  (`GridPositionSchema`). Murs fins et fenêtres restent entiers (`snapsToHalf`, `canPlace`). Pour
  une emprise, utiliser `itemBounds` (bords) ou `itemCells` (cases chevauchées) de `ai/grid.ts`,
  jamais `x + dx` sur des entiers ; un mur fin ne compte que par son trait (`segmentCrosses`).
- **Nouveau mode de jeu** : l'ajouter à `GAME_MODES`, à l'enum Prisma `GameMode` (migration
  `ALTER TYPE`), à `MODE_ICONS`, à `ALL_BUT` de `lessons.ts` (avec ses étapes `rules`) et au
  test des onglets du classement. Un réglage propre à une partie peut s'écrire dans la graine
  (comme `career:<légende>:<graine>`) : le rejeu serveur le retrouve sans changer l'API.
- **Serveur** : toutes les routes sous `/api`, erreurs `{ error: { code, message } }`, le serveur
  rejoue graine + commandes pour vérifier un score (il embarque la simulation du client).
- **Mode Histoire** : une mission est une partie `STORY` (`GameConfig.mission`), terminée par
  `result.mission` (issue « zombie », sans classement ni succès de fin). Les récompenses de la
  partie sont fixées au départ dans `state.unlocks` (comme la graine) et envoyées avec le score
  (`unlocks`) : le serveur vérifie qu'elles sont gagnées et les rejoue. Un contenu réservé porte
  un champ `unlock` (meuble, papier peint, sol) ou est dans `COLOR_UNLOCKS`. `MENU_MODES` = les
  modes du menu et des classements (sans STORY).
- **Base de production sur Supabase** : seulement un PostgreSQL hébergé, le serveur passe par
  Prisma (pas d'auth ni de SDK Supabase). Toute nouvelle table active la RLS dans sa migration
  (`ALTER TABLE "X" ENABLE ROW LEVEL SECURITY;`), sinon l'API REST publique de Supabase la
  lirait ; `tests/rls.test.ts` échoue sinon. Ne jamais modifier une migration déjà appliquée
  (somme de contrôle dans `_prisma_migrations`).
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
- Un abonnement global branché dans un `useEffect` doit renvoyer un nettoyage qui permet de le
  rebrancher : en `pnpm dev`, StrictMode monte l'application deux fois (c'est ce qui coupait la
  sauvegarde automatique, voir `installGameLifecycle`).
- Supabase : « self-signed certificate in certificate chain » = le driver `pg` lit
  `sslmode=require` comme `verify-full` ; `createPrismaClient` ajoute `uselibpqcompat=true`.
  Prendre l'URL du _Session pooler_ (5432), pas la _Direct connection_ (IPv6 seulement) ni le
  _Transaction pooler_ (6543). Projet gratuit en pause après 7 jours sans requête.
- Son sur iPhone et iPad : Safari ignore `volume` d'une balise `<audio>` (Howler en `html5: true`
  compris). Régler le volume par un gain Web Audio (`audio/musicTrack.ts`).

---

## Journal des passations

Le plus récent en haut. Une ligne par travail terminé.

| Date     | Qui             | PR                  | Ce qui a changé / à savoir                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| -------- | --------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 03/11    | Thomas + Claude | #163                | Le curseur « Musique » ne changeait rien sur iPhone et iPad : Safari ignore le volume d'une balise `<audio>`. La musique passe par `audio/musicTrack.ts` (balise en flux branchée sur un gain Web Audio) ; Howler ne sert plus qu'aux effets. Mention sous « Effets » tant que `SOUND_FILES` est vide (côté Melvin). Bruits de clavier et de souris vérifiés : toujours là.                                                                                                                                                                                                              |
| 03/11    | Thomas + Claude | levées de fonds     | Le calcul du pitch ne change pas (`pnpm balance` identique) ; ce qui change, c'est l'affichage : chances estimées et force des thèmes dans « Lever des fonds » (`estimatePitchChance`, `categoryStrengths` dans `simulation/fundraising.ts`), force et jauge de chaque argument pendant le pitch (`pitchRating`, `argumentBasis`, `isRandomArgument` dans `shared/sim/pitch.ts`), jauge renommée « Chance de signer ». Si on retouche `FUNDING_TIERS` ou les forces d'arguments, le test de calibrage de `funding.test.ts` dira si l'estimation reste juste.                             |
| 03/11    | Thomas + Claude | T2, PR 4 sur 4      | Équilibrage de l'histoire : dates limites 8 / 18 / 48 / 56 / 60, churn des rivaux divisé par deux, `STORY_SIDE_BONUS` (bonus par objectif secondaire, choix de Thomas), bot conteur et section « Histoire en actes » de `pnpm balance` (`--campaign-games`). Bons bots 40 à 65 % de réussite ; la guerre des prix reste l'acte qui bloque. Les anciennes histoires en cours gardent leur avancement mais suivent les nouvelles dates.                                                                                                                                                    |
| 03/11    | Thomas + Claude | T4                  | Arbre R&D des objets dans l'histoire en actes (`shared/sim/research.ts`, panneau 🔬 R&D) : catalogue réduit au départ, 5 branches x 4 niveaux payés en points d'innovation, Prestige par les objectifs. État `campaign.research` optionnel, commande `RESEARCH_NODE`, aucun tirage. **Pour Melvin** : un nouvel objet du catalogue doit être rattaché à un niveau de `RESEARCH_TREE` ou à `RESEARCH_FREE` (test `research.test.ts`) ; le hall et les offres internet ne sont pas verrouillés par l'arbre.                                                                                |
| 03/11    | Thomas + Claude | #157, T2 PR 3 sur 4 | Scènes dialoguées (`shared/story/scenes.ts`, `ui/story/StoryScene.tsx`), 10 cartes d'histoire hors base, poids 0, imposées sans tirage (`STORY_CARD_SCHEDULE`, `events/storyCards.ts`), effet de carte `rivals`, SMS de Mamie Josette et articles d'Inès dans le Slack, fins écrites, Saison libre après l'entrée en Bourse (`campaign.freeSeason`, `END_STORY`, `freeSeasonStart` passé aux fonctions de `endless.ts`). Nouveau type de notification `STORY_END`.                                                                                                                       |
| 03/11    | Thomas + Claude | #157, T2 PR 2 sur 4 | Rivaux de l'histoire : Synergix, Pivotly, Gigacorp simulés à chaque démo sur `seed#rival#sprint`, part de marché qui ajoute du churn, objectifs `rivalUsers` et `marketShare`, panneau Marché, enseignes sur les toits. État `campaign.rivals` et `campaign.usersHistory` vides par défaut ; les autres modes ne changent pas.                                                                                                                                                                                                                                                           |
| 03/11    | Thomas + Claude | #157, T2 PR 1 sur 4 | Histoire en 5 actes, socle : `mission: 'campaign'`, 60 sprints, actes et dates limites dans `shared/story/acts.ts`, les 10 missions deviennent les objectifs secondaires (mêmes récompenses), `POST /api/story/complete` avec `campaign: true`, point de sauvegarde par acte sur l'appareil, onglets Histoire et Missions. Champ `story.campaign` optionnel, `story.missionId` devenu optionnel, aucun tirage. Réponses aux questions de la proposition : partir de #122, arbre des devs dans tous les modes sauf Daily (fil T3), 60 sprints, noms tels quels, missions courtes gardées. |
| 03/11    | Melvin + Claude | #154                | Support client dans le panneau Business : tickets, agents, devs de garde, satisfaction (départs en plus sous 60, recommandations au-dessus de 80). État `support` par défaut, aucun tirage, mais règle de toutes les parties : les replays des anciens scores divergent.                                                                                                                                                                                                                                                                                                                 |
| 03/11    | Melvin + Claude | #153                | Clients B2B : 3 offres par planification sur `seed#clients#sprint`, contrats avec échéance, forfait, SLA et maintenance. Points livrés comptés à la démo par type de tâche. État `clients` par défaut ; sans contrat, partie identique.                                                                                                                                                                                                                                                                                                                                                  |
| 03/11    | Melvin + Claude | #151                | Modèle économique (panneau 💶 Business) : 4 modèles x 3 prix, freemium standard = partie d'avant. Au téléphone en portrait, les boutons système du haut ont leur propre ligne ; de 1024 à 1279 px, le nom de l'entreprise est masqué dans le HUD.                                                                                                                                                                                                                                                                                                                                        |
| 02/11    | Melvin + Claude | #134                | Hall d'entrée au rez-de-chaussée (rayon Accueil) : portes à badge, comptoir, 2 secrétaires. Sécurité branchée sur le modèle commun (service `security`, installation `lobby` dans `REQUIREMENT_CHECKS`). État `lobby` null par défaut, aucun tirage.                                                                                                                                                                                                                                                                                                                                     |
| 02/11    | Melvin + Claude | #147                | Ménage branché sur le modèle commun d'abonnements : service « cleaning » (🧹), 3 offres, `SUBSCRIBE` / `CANCEL_SUBSCRIPTION` à la place de `SUBSCRIBE_CLEANING` / `CANCEL_CLEANING`, `cleaning.plan` retiré. `PRICE_RULES` : prix d'une offre qui suit la partie (ménage selon la taille du bureau).                                                                                                                                                                                                                                                                                     |
| 02/11    | Thomas + Claude | T5 (3/3)            | Team building : 5 sorties réservées en planification, effets à 18h le dernier jour, hasard sur `seed#teambuilding#sprint`. État `teamBuilding` par défaut. T5 terminée : les 3 PR empilées sont fusionnées ensemble par #156 (#149 et #155 fermées, incluses).                                                                                                                                                                                                                                                                                                                           |
| 02/11    | Thomas + Claude | T5 (2/3)            | Rétrospective de sprint : 3 actions selon les problèmes du sprint, vote des devs sur `seed#retro#sprint`, effet pendant un sprint. Passer la rétro ne coûte rien (écart avec la proposition, pour garder la partie identique). État `retro` par défaut. Bot « retro » : valorisation médiane 297 M€ contre 266 M€ pour « balanced ».                                                                                                                                                                                                                                                     |
| 02/11    | Thomas + Claude | T5 (1/3)            | Congés payés, 11 jours fériés, ponts de mai, arrêts maladie, burn-out au lieu de la démission. État `teamLife` (null = ancienne sauvegarde ou défi 3 sprints : rien ne change), hasard sur `seed#leave#jour`. Les replays des anciens scores Normal et Daily ne rejouent plus à l'identique (comme pour les autres mécaniques automatiques).                                                                                                                                                                                                                                             |
| 02/11    | Thomas + Claude | #150                | Tâche T3 : arbre de compétences des devs (1 point par niveau, 3 branches de 5 nœuds, nœud de métier, formations, réinitialisation, Crunch), ouvert partout sauf en Daily. Commandes `LEARN_SKILL`, `RESET_SKILLS`, `TRAIN_DEV`, `USE_CRUNCH`, composant `skills`. Aucun tirage : 48 parties sans arbre identiques à `develop`. Bot « coach ». Fichiers communs : `state.ts`, `bots.ts`, `view/*`, i18n.                                                                                                                                                                                  |
| 02/11    | Melvin + Claude | #129                | Internet de la salle des serveurs branché sur les abonnements : 6 offres aux prix réels, capacité en salariés (`maxUsers`), mise en service (`setupFee`), saturation. Température des salles (chaleur et clim en kW, sonde de supervision). Champs `saturated` et `serverHeat` par défaut, aucun tirage. Un champ ajouté à l'état initial suit l'ordre du schéma Zod, sinon le test de sauvegarde échoue.                                                                                                                                                                                |
| 02/11    | Melvin + Claude | #127, #140          | Toile du projecteur toute blanche quand elle monte ou descend (plus de cadre noir, `FABRIC_WHITE`), état d'avancement et README à jour.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 02/11    | Thomas + Claude | #148                | Tâche T1 : `main` réintégré dans `develop` (merge commit). 13 conflits résolus en gardant les deux côtés : Carrière et Illimité, trésorerie de la légende multipliée par `difficultyOf`, ménage et abonnements à côté de `career`, succès de l'Illimité et de la Carrière (70). Carrière ajoutée à `GLOBAL_EXCLUDED_MODES`.                                                                                                                                                                                                                                                              |
| 02/11    | Melvin + Claude | #146                | Daily et Kanbanana (#133) décrits dans `CLAUDE.md` et le README. Nouveau champ `morningSync` et stat `duplicateWork` (défauts pour les anciennes sauvegardes). Idées de suite proposées à Melvin pour le Daily : blocage signalé, pair programming, Daily qui dérape, retard, rétro de fin de sprint, succès.                                                                                                                                                                                                                                                                            |
| 02/11    | Melvin + Claude | #132                | Placement à la demi-case : objets décalables d'une demi-case, demi-case libre le long des murs fins utilisable, centrage d'un objet de 3 cases dans 4.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 02/11    | Melvin + Claude | #145                | Partage du travail : `docs/PASSATION-THOMAS.md` (tâches T1 à T6 pour Thomas avec un prompt chacune, M1 à M4 pour Melvin) et `docs/proposition-mode-histoire.md`. `main` a 5 PR absentes de `develop` : à réintégrer d'abord.                                                                                                                                                                                                                                                                                                                                                             |
| 02/11    | Thomas + Claude | #143                | Jeu en ligne avec comptes : client Vercel `open-space-simulator.vercel.app`, `CLIENT_URL` réglé sur Render, inscription testée par Thomas (compte créé dans Supabase). Reste l'OAuth GitHub.                                                                                                                                                                                                                                                                                                                                                                                             |
| 02/11    | Thomas + Claude | #142                | Serveur Render en ligne (`oss-server-e90i.onrender.com`), branché sur Supabase et rempli par le seed (130 cartes, 67 succès, admin). `vercel.json` pointe dessus. Reste : projet Vercel, `CLIENT_URL` sur Render, OAuth GitHub.                                                                                                                                                                                                                                                                                                                                                          |
| 02/11    | Thomas + Claude | #138                | Base de production sur Supabase : projet créé, migrations appliquées, RLS sur toutes les tables (nouvelle migration + test), correctif SSL de `pg`, `render.yaml` sans base Render. Reste le mot de passe et Render (Thomas).                                                                                                                                                                                                                                                                                                                                                            |
| 02/11    | Thomas + Claude | #137                | Bouton « Nouvelle partie » sous « Continuer ». Sauvegarde auto rétablie en `pnpm dev` (StrictMode). À valider.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 02/11    | Thomas + Claude | #121                | Mode Carrière repris après la pause : `main` intégré (mode Histoire), modes `STORY` et `CAREER` côte à côte, migrations Prisma dans l'ordre, CI verte. Validé par Thomas et fusionné.                                                                                                                                                                                                                                                                                                                                                                                                    |
| 02/11    | Thomas + Claude | #123 à #135         | CI de nouveau active. `develop` avancé jusqu'à `main` (mode Histoire), puis 11 PR de Melvin fusionnées dans `develop` après résolution des conflits : #123 à #128, #130 à #133, #135. Ménage à côté du modèle des abonnements, frais de l'illimité et du Hardcore cumulés, doublons du journal retirés. Restent #129 (à refaire sur les abonnements) et #134 (brouillon).                                                                                                                                                                                                                |
| 02/11    | Thomas + Claude | #122                | Mode Histoire validé par Thomas (récompenses nouvelles) et fusionné sans CI (GitHub Actions bloqué), vérifié en local.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 18/10    | Melvin + Claude | (PR develop)        | Saleté du bureau (0 à 100 %, -20 % de travail à 50 %) et entreprise de nettoyage Nickel Chrome : appel, express, abonnement hebdo (`shared/sim/cleaning.ts`, `simulation/cleaning.ts`, `render/cleaning.ts`, bouton 🧹). Champ `cleaning` par défaut ; règle qui change toutes les parties (anciens replays de scores divergent). À brancher sur le futur modèle commun d'abonnements.                                                                                                                                                                                                   |
| 18/10    | Melvin + Claude | develop             | Difficulté par mode (`difficultyOf`) : Facile moins généreux, Hardcore vraiment dur. Normal et Daily inchangés.                                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 18/10    | Melvin + Claude | develop             | Mode illimité `ENDLESS` (pression après 18 mois) et classement des entreprises (menu et jeu, en ligne ou appareil). Un mode non comparable va dans `GLOBAL_EXCLUDED_MODES`.                                                                                                                                                                                                                                                                                                                                                                                                              |
| 17/10    | Melvin + Claude | #123                | Branche `develop` créée depuis `main` : les PR vont vers `develop`, puis `develop` → `main` après les tests de Thomas et Melvin.                                                                                                                                                                                                                                                                                                                                                                                                                                                         |
| 17/10    | Melvin + Claude | #124                | Ajout de `ARBORESCENCE.md` : rôle de chaque fichier. Toute PR qui ajoute ou déplace un fichier met sa ligne à jour.                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 17/10    | Melvin + Claude | fix/objet_fantome   | Plus de décorations de saison au sol (fantôme, chaudron, sapin…) : ni déplaçables ni rangeables. Restent guirlandes et objets sur les bureaux. À valider par Thomas (fonctionnalité retirée).                                                                                                                                                                                                                                                                                                                                                                                            |
| 17/10    | Melvin + Claude | fix/sol_couleur     | Sol d'origine identique dans toutes les pièces (`BASE_FLOOR_COLORS`), plus de décor de sol tiré de la graine ; seul le rayon Sols le change.                                                                                                                                                                                                                                                                                                                                                                                                                                             |
| 17/10    | Melvin + Claude | (develop)           | Rubrique Abonnements (🧾 en haut) : modèle commun `subscriptions` (un abonnement par service, facturation à l'échéance, coupure si impayé, `requires`). La fibre y est passée ; ménage, internet et sécurité s'y branchent.                                                                                                                                                                                                                                                                                                                                                              |
| 13/10    | Thomas + Claude | #122                | Mode Histoire : 4 chapitres, 10 missions, 10 récompenses pour les autres modes (jamais en Daily). Progression vérifiée par rejeu (`POST /api/story/complete`, table `StoryMission`), `Score.unlocks`. `pnpm balance:story`.                                                                                                                                                                                                                                                                                                                                                              |
| 13/10    | Thomas + Claude | #121                | Mode Carrière : 8 légendes parodiques, jalons et étoiles, légende dans la graine, mode `CAREER` + migration Prisma, 2 succès (67 au total). PR à valider par Thomas.                                                                                                                                                                                                                                                                                                                                                                                                                     |
| 13/10    | Thomas + Claude | #120                | Création de `CONTEXTE.md`. Modes Histoire et Carrière décidés, chacun dans son fil.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                      |
| 11/10    | Melvin          | #109 à #119         | Sols par pièce, décor des annexes déplaçable, le plan cède la place aux meubles, salle des serveurs et fibre, bruits de souris.                                                                                                                                                                                                                                                                                                                                                                                                                                                          |
| 10–11/10 | Melvin          | #93 à #108          | Cuisine séparée, ordinateurs et écrans des postes, murs fins, vidéoprojecteurs, bruits de clavier.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |
| 9–10/10  | Melvin          | #37 à #92           | Filtres d'équipe, pause pendant les cartes, augmentations, levées de fonds, tâches dynamiques et par métier, réunions, fenêtres, chats, équipe web, musiques, meubles détaillés, papiers peints, mise à jour du jeu installé, New York réaliste.                                                                                                                                                                                                                                                                                                                                         |
| 8/10     | Thomas + Claude | #18 à #36           | Équilibrage, HUD, télétravail, back-office, personnages et packs, horloge continue, saisons, filiales, pauses.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 6–7/10   | Thomas + Claude | #1 à #17            | Les 12 étapes du plan, construction, succès, menu.                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                       |

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
