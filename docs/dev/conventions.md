# Conventions techniques et pièges connus

> Extrait de [`CONTEXTE.md`](../../CONTEXTE.md). Ajouter ici toute nouvelle convention (graine à part, champ d'état, test imposé…).

## Conventions techniques

Les plus importantes ; le détail est dans `docs/etat/` et le README.

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
- **Arbre R&D** (`shared/sim/research.ts`) : dans tous les modes (sauf missions courtes), tout contenu achetable (objet, ordinateur, écran, mur, sol, formule de salle) doit être dans `RESEARCH_FREE` ou dans un niveau de `RESEARCH_TREE`, sinon `research.test.ts` échoue. Vérifier aussi `researchUnlocked(state, clé)` dans la commande d'achat d'un nouveau type de contenu. Un test qui achète un objet sans tester l'arbre passe par `openCatalogue` (`tests/simulation/fixtures.ts`).
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
- **Règles d'un mode** (pause, cartes qui arrêtent le temps, construction, guide, compétences,
  récompenses Histoire, menu) : toujours via `modeRules(mode)` / `MODE_RULES` (`shared/game.ts`),
  jamais `mode === 'HARDCORE'`.
- **Graine annexe** : toujours `sideRng(state.seed, '<flux>', …)` avec un flux de `SIDE_STREAMS`
  (`simulation/rng.ts`), jamais une graine écrite à la main.
- **Nouveau mode de jeu** : l'ajouter à `GAME_MODES` et à `MODE_RULES`, à l'enum Prisma `GameMode` (migration
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
