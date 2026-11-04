# Contexte de passation

> **Dernière mise à jour : 4 novembre 2026**, par Claude (projet de Thomas) : **mise en production**
> de la doc découpée (#169, merge commit `b9eda92`). Avant : doc découpée en
> fichiers par thème (`docs/`, index dans `CLAUDE.md`). Avant : **mise en production** de
> `develop` dans `main` (#166, merge commit `47a1a72`, T6), arbre R&D des
> objets étendu à tous les modes (#165), Kanban adapté à la
> taille et au rythme de l'équipe (#164), curseur « Musique »
> réparé sur iPhone et iPad (#163, volume par Web Audio), voitures (7 modèles)
> et décorations de saison refaites (#162), arbre R&D des
> objets (T4, #160), levées de fonds lisibles (#161), histoire en 5 actes (#157, #159) ;
> plus tôt, modèle économique (#151), clients B2B (#153) et support client
> (#154) de Melvin, panneau « 💶 Business ».

Ce fichier sert de relais entre **Thomas** (`7h0mas92`) et **Melvin** (`melvinvallot`), et entre
leurs sessions Claude respectives. Il dit où en est le projet, ce qui est en cours, ce qui attend
une décision et comment on travaille. Le cahier des charges est dans
[`docs/cahier-des-charges/`](docs/cahier-des-charges/), la liste détaillée de tout ce qui est
livré dans [`docs/etat/`](docs/etat/) (un fichier par thème) ; l'index « quel fichier lire pour
quel fil » est dans [`CLAUDE.md`](CLAUDE.md), la doc technique dans [`README.md`](README.md).

## Règle : mettre ce fichier à jour à la fin de chaque travail

À la fin de chaque fil de discussion ou de chaque PR (humain ou Claude, Thomas ou Melvin) :

1. Mettre à jour la date et le dernier commit en haut du fichier.
2. Mettre à jour [Travaux en cours](#travaux-en-cours) et
   [En attente d'une décision](#en-attente-dune-décision) (ajouter, déplacer, supprimer).
3. Ajouter une ligne en haut du [Journal des passations](#journal-des-passations) : date, qui,
   PR, ce qui a changé, ce que l'autre doit savoir.
4. Si une nouvelle convention est née (graine à part, champ d'état, test imposé…), l'ajouter dans
   [`docs/dev/conventions.md`](docs/dev/conventions.md).
5. Ajouter la fonctionnalité livrée dans le bon fichier de [`docs/etat/`](docs/etat/).
   Garder le journal court : les lignes de plus d'une semaine vont dans
   [`docs/historique.md`](docs/historique.md).
6. Le faire dans la même PR que la fonctionnalité, ou dans la PR `docs:` qui met à jour
   `docs/etat/` et `README.md` juste après.

Ne jamais écrire de secret ici (clé d'API, mot de passe de production, jeton). Les seuls
identifiants cités sont ceux de développement local, déjà publics dans le dépôt.

---

## Sommaire

1. [En une minute](#en-une-minute)
2. [Travaux en cours](#travaux-en-cours)
3. [En attente d'une décision](#en-attente-dune-décision)
4. [Qui fait quoi et comment](#qui-fait-quoi-et-comment)
5. [Où sont les choses, installation, conventions](#où-sont-les-choses-installation-conventions)
6. [Journal des passations](#journal-des-passations)
7. [Prompt de reprise pour Claude Code](#prompt-de-reprise-pour-claude-code)

---

## En une minute

- **Projet** : « Open Space Simulator 2026 », jeu de gestion de startup en 3D low-poly
  isométrique dans le navigateur (projet de 3e année de Bachelor développement web, soutenance
  prévue). Pitch : « Ta startup a levé 2 millions. Tu as 18 mois avant que tout explose. »
- **État** : les 12 étapes du plan sont livrées, plus une centaine d'ajouts validés (PR #1 à
  #119, toutes fusionnées, **aucune PR ouverte** au 13 octobre). La liste complète est dans
  `docs/etat/` (un fichier par thème).
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
| Voitures (7 modèles) et décorations de saison       | Thomas + Claude | Fusionnée dans `develop` le 3 novembre (PR #162) |
| Histoire en 5 actes, rivaux (T2)                    | Thomas + Claude | #157 et #159 fusionnées le 3 novembre            |
| Levées de fonds cohérentes avec l'affichage         | Thomas + Claude | Fusionnée dans `develop` le 3 novembre (#161)    |
| Arbre R&D des objets (T4)                           | Thomas + Claude | Fusionnée dans `develop` le 3 novembre (PR #160) |
| Arbre R&D dans tous les modes                       | Thomas + Claude | Fusionnée dans `develop` le 3 novembre (#165)    |
| **Mise en production** `develop` → `main` (T6)      | Thomas + Claude | Fusionnée le 3 novembre (PR #166, merge commit)  |
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
Ampère Motors), chacune avec son départ et 4 jalons, étoiles à la fin. Détail dans `docs/etat/modes.md`.
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
  petite PR `docs:` qui met à jour `docs/etat/`, `CONTEXTE.md` et `README.md`.
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
4. Après chaque fusion : mettre à jour `docs/etat/<thème>.md` (état d'avancement), `README.md` **et ce
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

## Où sont les choses, installation, conventions

Déplacés dans des fichiers à part pour ne lire que ce qu'il faut :

- Où sont les choses, installer et lancer : [`docs/dev/installer.md`](docs/dev/installer.md)
- Conventions techniques et pièges connus : [`docs/dev/conventions.md`](docs/dev/conventions.md)
- Anciennes passations et historique des PR : [`docs/historique.md`](docs/historique.md)

---

## Journal des passations

Le plus récent en haut. Une ligne par travail terminé.

| Date  | Qui             | PR                  | Ce qui a changé / à savoir                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                                               |
| ----- | --------------- | ------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 04/11 | Thomas (Claude) | doublons onglets    | Un seul accès par élément : abonnements uniquement dans Locaux > Abonnements, hall/serveurs/chats uniquement via Locaux (plus de cartes dans le catalogue), ménage via le bouton jauge du haut.                                                                                                                                                                                                                                                                                                                                                                                          |
| 04/11 | Thomas + Claude | fix construction    | Pose : un double-clic (ou un clic pendant que la simulation répond) n'envoie plus une deuxième pose depuis l'ancien instantané (toast d'erreur « case occupée », stock ou trésorerie faux). Verrou `placing` dans `placeAt` (`ui/store/game.ts`).                                                                                                                                                                                                                                                                                                                                        |
| 04/11 | Thomas (Claude) | #171                | Revue /simplify puis améliorations validées : code mort retiré, `sideRng`, table `MODE_RULES`, cache du rendu par image, cartes serveur écrites une fois par version, prix hebdo de la fibre en ×12/52, besoin client affiché, alerte de sprint trop chargé, résultat net et dev du sprint à la démo, raccourcis 1/2/4, K, T listés dans les options, actions CI en v5.                                                                                                                                                                                                                  |
| 04/11 | Thomas + Claude | #169                | Mise en production : `develop` (docs #167, #168) fusionné dans `main` en merge commit `b9eda92`. Doc seulement : aucun code, aucune migration Supabase.                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 03/11 | Thomas + Claude | Doc par thème       | `CLAUDE.md` réduit à un index ; cahier des charges dans `docs/cahier-des-charges/`, état d'avancement dans `docs/etat/<thème>.md`, conventions et installation dans `docs/dev/`, architecture détaillée dans `docs/architecture/`, vieux journal dans `docs/historique.md`. **Melvin : ajouter ses fonctionnalités dans `docs/etat/`, plus dans `CLAUDE.md`.**                                                                                                                                                                                                                           |
| 03/11 | Thomas + Claude | #166 (T6)           | Mise en production : `develop` (PR #123 à #165) fusionné dans `main` en merge commit `47a1a72`, CI et Playwright verts. Une seule migration, `20261017150000_endless_mode` (`ENDLESS` dans `GameMode`), appliquée par `db:deploy` au démarrage de Render ; aucune nouvelle variable ni table. Base avant : 0 score, 0 sauvegarde, donc aucun replay cassé. Prochaine mise en prod : même PR « release » en merge commit.                                                                                                                                                                 |
| 03/11 | Thomas + Claude | R&D tous modes      | Arbre R&D dans tous les modes (« r&d dans tous les modes ») : `state.research` (null en mission courte et dans les vieilles sauvegardes), niveaux ouverts par la phase, points par feature, levée de fonds et objectif de sprint, bouton 🔬, étape du tutoriel. Vinyle et moquette au niveau 1 d'Ambiance. Règle de toutes les parties : les replays des anciens scores divergent. Tests d'objets : `openCatalogue`.                                                                                                                                                                     |
| 03/11 | Thomas + Claude | R&D tous modes      | Arbre R&D dans tous les modes (« r&d dans tous les modes ») : `state.research` (null en mission courte et dans les vieilles sauvegardes), niveaux ouverts par la phase, points par feature, levée de fonds et objectif de sprint, bouton 🔬, étape du tutoriel. Vinyle et moquette au niveau 1 d'Ambiance. Règle de toutes les parties : les replays des anciens scores divergent. Tests d'objets : `openCatalogue`.                                                                                                                                                                     |
| 03/11 | Thomas + Claude | Kanban et équipe    | Le « À faire » suit la taille et le rythme de l'équipe (`sprintLoad.ts`), 192 titres de tâches en plus. Tâches plus longues et `pointEffect` 0,13 pour garder l'équilibrage des bons bots ; le bot random fait faillite plus souvent. Anciens replays de scores divergent. `guide-modes` ENDLESS dépasse déjà son délai sur `develop`.                                                                                                                                                                                                                                                   |
| 03/11 | Thomas + Claude | #163                | Le curseur « Musique » ne changeait rien sur iPhone et iPad : Safari ignore le volume d'une balise `<audio>`. La musique passe par `audio/musicTrack.ts` (balise en flux branchée sur un gain Web Audio) ; Howler ne sert plus qu'aux effets. Mention sous « Effets » tant que `SOUND_FILES` est vide (côté Melvin). Bruits de clavier et de souris vérifiés : toujours là.                                                                                                                                                                                                              |
| 03/11 | Thomas + Claude | voitures et déco    | Rendu seulement, aucun tirage ni champ d'état. Voitures de la ville : `render/cars.ts` (7 modèles, `CAR_MIX`, `carLook`), 2 InstancedMesh par modèle dans `skyline.ts` (maillages `skyline-cars-<modèle>`). Décorations : `ThemeModels.wall` prend maintenant les murs (`DecorWall[]` de `decorWalls(layout, items)`) au lieu de `(largeur, profondeur)` ; ornements entre les appliques, hors fenêtres, cloisons et meubles de plus de 1,3 m. Nouveau thème de saison ou nouvel ornement : passer par `Kit` dans `decorModels.ts`. `tint` exporté de `pieces.ts`.                       |
| 03/11 | Thomas + Claude | levées de fonds     | Le calcul du pitch ne change pas (`pnpm balance` identique) ; ce qui change, c'est l'affichage : chances estimées et force des thèmes dans « Lever des fonds » (`estimatePitchChance`, `categoryStrengths` dans `simulation/fundraising.ts`), force et jauge de chaque argument pendant le pitch (`pitchRating`, `argumentBasis`, `isRandomArgument` dans `shared/sim/pitch.ts`), jauge renommée « Chance de signer ». Si on retouche `FUNDING_TIERS` ou les forces d'arguments, le test de calibrage de `funding.test.ts` dira si l'estimation reste juste.                             |
| 03/11 | Thomas + Claude | T2, PR 4 sur 4      | Équilibrage de l'histoire : dates limites 8 / 18 / 48 / 56 / 60, churn des rivaux divisé par deux, `STORY_SIDE_BONUS` (bonus par objectif secondaire, choix de Thomas), bot conteur et section « Histoire en actes » de `pnpm balance` (`--campaign-games`). Bons bots 40 à 65 % de réussite ; la guerre des prix reste l'acte qui bloque. Les anciennes histoires en cours gardent leur avancement mais suivent les nouvelles dates.                                                                                                                                                    |
| 03/11 | Thomas + Claude | T4                  | Arbre R&D des objets dans l'histoire en actes (`shared/sim/research.ts`, panneau 🔬 R&D) : catalogue réduit au départ, 5 branches x 4 niveaux payés en points d'innovation, Prestige par les objectifs. État `campaign.research` optionnel, commande `RESEARCH_NODE`, aucun tirage. **Pour Melvin** : un nouvel objet du catalogue doit être rattaché à un niveau de `RESEARCH_TREE` ou à `RESEARCH_FREE` (test `research.test.ts`) ; le hall et les offres internet ne sont pas verrouillés par l'arbre.                                                                                |
| 03/11 | Thomas + Claude | #157, T2 PR 3 sur 4 | Scènes dialoguées (`shared/story/scenes.ts`, `ui/story/StoryScene.tsx`), 10 cartes d'histoire hors base, poids 0, imposées sans tirage (`STORY_CARD_SCHEDULE`, `events/storyCards.ts`), effet de carte `rivals`, SMS de Mamie Josette et articles d'Inès dans le Slack, fins écrites, Saison libre après l'entrée en Bourse (`campaign.freeSeason`, `END_STORY`, `freeSeasonStart` passé aux fonctions de `endless.ts`). Nouveau type de notification `STORY_END`.                                                                                                                       |
| 03/11 | Thomas + Claude | #157, T2 PR 2 sur 4 | Rivaux de l'histoire : Synergix, Pivotly, Gigacorp simulés à chaque démo sur `seed#rival#sprint`, part de marché qui ajoute du churn, objectifs `rivalUsers` et `marketShare`, panneau Marché, enseignes sur les toits. État `campaign.rivals` et `campaign.usersHistory` vides par défaut ; les autres modes ne changent pas.                                                                                                                                                                                                                                                           |
| 03/11 | Thomas + Claude | #157, T2 PR 1 sur 4 | Histoire en 5 actes, socle : `mission: 'campaign'`, 60 sprints, actes et dates limites dans `shared/story/acts.ts`, les 10 missions deviennent les objectifs secondaires (mêmes récompenses), `POST /api/story/complete` avec `campaign: true`, point de sauvegarde par acte sur l'appareil, onglets Histoire et Missions. Champ `story.campaign` optionnel, `story.missionId` devenu optionnel, aucun tirage. Réponses aux questions de la proposition : partir de #122, arbre des devs dans tous les modes sauf Daily (fil T3), 60 sprints, noms tels quels, missions courtes gardées. |
| 03/11 | Melvin + Claude | #154                | Support client dans le panneau Business : tickets, agents, devs de garde, satisfaction (départs en plus sous 60, recommandations au-dessus de 80). État `support` par défaut, aucun tirage, mais règle de toutes les parties : les replays des anciens scores divergent.                                                                                                                                                                                                                                                                                                                 |
| 03/11 | Melvin + Claude | #153                | Clients B2B : 3 offres par planification sur `seed#clients#sprint`, contrats avec échéance, forfait, SLA et maintenance. Points livrés comptés à la démo par type de tâche. État `clients` par défaut ; sans contrat, partie identique.                                                                                                                                                                                                                                                                                                                                                  |
| 03/11 | Melvin + Claude | #151                | Modèle économique (panneau 💶 Business) : 4 modèles x 3 prix, freemium standard = partie d'avant. Au téléphone en portrait, les boutons système du haut ont leur propre ligne ; de 1024 à 1279 px, le nom de l'entreprise est masqué dans le HUD.                                                                                                                                                                                                                                                                                                                                        |
| 02/11 | Melvin + Claude | #134                | Hall d'entrée au rez-de-chaussée (rayon Accueil) : portes à badge, comptoir, 2 secrétaires. Sécurité branchée sur le modèle commun (service `security`, installation `lobby` dans `REQUIREMENT_CHECKS`). État `lobby` null par défaut, aucun tirage.                                                                                                                                                                                                                                                                                                                                     |
| 02/11 | Melvin + Claude | #147                | Ménage branché sur le modèle commun d'abonnements : service « cleaning » (🧹), 3 offres, `SUBSCRIBE` / `CANCEL_SUBSCRIPTION` à la place de `SUBSCRIBE_CLEANING` / `CANCEL_CLEANING`, `cleaning.plan` retiré. `PRICE_RULES` : prix d'une offre qui suit la partie (ménage selon la taille du bureau).                                                                                                                                                                                                                                                                                     |
| 02/11 | Thomas + Claude | T5 (3/3)            | Team building : 5 sorties réservées en planification, effets à 18h le dernier jour, hasard sur `seed#teambuilding#sprint`. État `teamBuilding` par défaut. T5 terminée : les 3 PR empilées sont fusionnées ensemble par #156 (#149 et #155 fermées, incluses).                                                                                                                                                                                                                                                                                                                           |
| 02/11 | Thomas + Claude | T5 (2/3)            | Rétrospective de sprint : 3 actions selon les problèmes du sprint, vote des devs sur `seed#retro#sprint`, effet pendant un sprint. Passer la rétro ne coûte rien (écart avec la proposition, pour garder la partie identique). État `retro` par défaut. Bot « retro » : valorisation médiane 297 M€ contre 266 M€ pour « balanced ».                                                                                                                                                                                                                                                     |
| 02/11 | Thomas + Claude | T5 (1/3)            | Congés payés, 11 jours fériés, ponts de mai, arrêts maladie, burn-out au lieu de la démission. État `teamLife` (null = ancienne sauvegarde ou défi 3 sprints : rien ne change), hasard sur `seed#leave#jour`. Les replays des anciens scores Normal et Daily ne rejouent plus à l'identique (comme pour les autres mécaniques automatiques).                                                                                                                                                                                                                                             |
| 02/11 | Thomas + Claude | #150                | Tâche T3 : arbre de compétences des devs (1 point par niveau, 3 branches de 5 nœuds, nœud de métier, formations, réinitialisation, Crunch), ouvert partout sauf en Daily. Commandes `LEARN_SKILL`, `RESET_SKILLS`, `TRAIN_DEV`, `USE_CRUNCH`, composant `skills`. Aucun tirage : 48 parties sans arbre identiques à `develop`. Bot « coach ». Fichiers communs : `state.ts`, `bots.ts`, `view/*`, i18n.                                                                                                                                                                                  |
| 02/11 | Melvin + Claude | #129                | Internet de la salle des serveurs branché sur les abonnements : 6 offres aux prix réels, capacité en salariés (`maxUsers`), mise en service (`setupFee`), saturation. Température des salles (chaleur et clim en kW, sonde de supervision). Champs `saturated` et `serverHeat` par défaut, aucun tirage. Un champ ajouté à l'état initial suit l'ordre du schéma Zod, sinon le test de sauvegarde échoue.                                                                                                                                                                                |
| 02/11 | Melvin + Claude | #127, #140          | Toile du projecteur toute blanche quand elle monte ou descend (plus de cadre noir, `FABRIC_WHITE`), état d'avancement et README à jour.                                                                                                                                                                                                                                                                                                                                                                                                                                                  |
| 02/11 | Thomas + Claude | #148                | Tâche T1 : `main` réintégré dans `develop` (merge commit). 13 conflits résolus en gardant les deux côtés : Carrière et Illimité, trésorerie de la légende multipliée par `difficultyOf`, ménage et abonnements à côté de `career`, succès de l'Illimité et de la Carrière (70). Carrière ajoutée à `GLOBAL_EXCLUDED_MODES`.                                                                                                                                                                                                                                                              |
| 02/11 | Melvin + Claude | #146                | Daily et Kanbanana (#133) décrits dans `CLAUDE.md` et le README. Nouveau champ `morningSync` et stat `duplicateWork` (défauts pour les anciennes sauvegardes). Idées de suite proposées à Melvin pour le Daily : blocage signalé, pair programming, Daily qui dérape, retard, rétro de fin de sprint, succès.                                                                                                                                                                                                                                                                            |
| 02/11 | Melvin + Claude | #132                | Placement à la demi-case : objets décalables d'une demi-case, demi-case libre le long des murs fins utilisable, centrage d'un objet de 3 cases dans 4.                                                                                                                                                                                                                                                                                                                                                                                                                                   |
| 02/11 | Melvin + Claude | #145                | Partage du travail : `docs/PASSATION-THOMAS.md` (tâches T1 à T6 pour Thomas avec un prompt chacune, M1 à M4 pour Melvin) et `docs/proposition-mode-histoire.md`. `main` a 5 PR absentes de `develop` : à réintégrer d'abord.                                                                                                                                                                                                                                                                                                                                                             |
| 02/11 | Thomas + Claude | #143                | Jeu en ligne avec comptes : client Vercel `open-space-simulator.vercel.app`, `CLIENT_URL` réglé sur Render, inscription testée par Thomas (compte créé dans Supabase). Reste l'OAuth GitHub.                                                                                                                                                                                                                                                                                                                                                                                             |
| 02/11 | Thomas + Claude | #142                | Serveur Render en ligne (`oss-server-e90i.onrender.com`), branché sur Supabase et rempli par le seed (130 cartes, 67 succès, admin). `vercel.json` pointe dessus. Reste : projet Vercel, `CLIENT_URL` sur Render, OAuth GitHub.                                                                                                                                                                                                                                                                                                                                                          |
| 02/11 | Thomas + Claude | #138                | Base de production sur Supabase : projet créé, migrations appliquées, RLS sur toutes les tables (nouvelle migration + test), correctif SSL de `pg`, `render.yaml` sans base Render. Reste le mot de passe et Render (Thomas).                                                                                                                                                                                                                                                                                                                                                            |
| 02/11 | Thomas + Claude | #137                | Bouton « Nouvelle partie » sous « Continuer ». Sauvegarde auto rétablie en `pnpm dev` (StrictMode). À valider.                                                                                                                                                                                                                                                                                                                                                                                                                                                                           |
| 02/11 | Thomas + Claude | #121                | Mode Carrière repris après la pause : `main` intégré (mode Histoire), modes `STORY` et `CAREER` côte à côte, migrations Prisma dans l'ordre, CI verte. Validé par Thomas et fusionné.                                                                                                                                                                                                                                                                                                                                                                                                    |
| 02/11 | Thomas + Claude | #123 à #135         | CI de nouveau active. `develop` avancé jusqu'à `main` (mode Histoire), puis 11 PR de Melvin fusionnées dans `develop` après résolution des conflits : #123 à #128, #130 à #133, #135. Ménage à côté du modèle des abonnements, frais de l'illimité et du Hardcore cumulés, doublons du journal retirés. Restent #129 (à refaire sur les abonnements) et #134 (brouillon).                                                                                                                                                                                                                |
| 02/11 | Thomas + Claude | #122                | Mode Histoire validé par Thomas (récompenses nouvelles) et fusionné sans CI (GitHub Actions bloqué), vérifié en local.                                                                                                                                                                                                                                                                                                                                                                                                                                                                   |

Lignes plus anciennes : [`docs/historique.md`](docs/historique.md).

## Prompt de reprise pour Claude Code

Claude Code lit `CLAUDE.md` tout seul. Pour reprendre, commencer la session par :

```text
Lis CLAUDE.md et CONTEXTE.md, puis seulement les fichiers de docs/ que l'index de CLAUDE.md
indique pour ce sujet. Fais un git pull sur develop, regarde les PR ouvertes,
puis lance pnpm lint, pnpm typecheck et pnpm test pour vérifier que tout est vert. Respecte les
règles de CONTEXTE.md (français, une PR par demande, captures desktop et mobile, CI verte,
validation avant fusion, jamais le RNG de la partie, aucun secret). À la fin du travail, mets à
jour CONTEXTE.md (en-tête, travaux en cours, journal), le fichier de docs/etat/ du thème et le
README.
```
