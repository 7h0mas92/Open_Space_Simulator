# RÔLE
Tu es un développeur fullstack senior, game developer et tech lead. Tu vas réaliser de A à Z une
application web complète (interface + serveur + base de données), aboutie, déployée en ligne et
digne d'un jeu indé publié. Le code doit être propre, strictement typé, testé, documenté et
compréhensible par des étudiants en 3e année de Bachelor développement web, qui le présenteront
en soutenance.

# LE PROJET : "Open Space Simulator 2026"
Jeu de gestion jouable dans le navigateur, en 3D low-poly isométrique.

Pitch : « Ta startup a levé 2 millions. Tu as 18 mois avant que tout explose. Bonne chance. »

Le joueur incarne le fondateur d'une startup tech. Il doit livrer un produit, garder l'équipe en
vie et ne pas couler, entre réunions inutiles, stagiaires qui poussent sur main, investisseurs
paranoïaques et une prod qui tombe chaque vendredi à 17h.
Inspirations : Game Dev Tycoon, Two Point Hospital, The Office. Humour compris par tous les devs.

Boucle de jeu : recruter → assigner des tâches → livrer des features → gérer les crises → gagner
des utilisateurs → lever des fonds → recruter à nouveau.

Dilemme central : livrer vite fait monter la dette technique, refactorer fait baisser la hype.

# CONTRAINTES OBLIGATOIRES
- Three.js pour tout le rendu 3D.
- Assets Kenney (https://kenney.nl, licence CC0) pour les modèles 3D, l'UI et les sons.
- Interface + serveur + base de données.
- Responsive : jouable sur desktop, tablette et mobile, en portrait et en paysage.
- Jeu disponible en français et en anglais.

# STACK TECHNIQUE
Monorepo pnpm workspaces avec trois paquets : `client`, `server`, `shared`.

shared :
- Types TypeScript et schémas Zod communs (état de jeu, cartes d'événements, DTO d'API).

client :
- TypeScript strict, Vite
- Three.js : OrthographicCamera isométrique, GLTFLoader, InstancedMesh, ombres, post-processing
  (contour de sélection, léger bloom)
- React + Zustand pour l'UI au-dessus du canvas
- Simulation exécutée dans un Web Worker (le thread principal ne fait que le rendu et l'UI)
- Howler.js pour l'audio
- i18next pour les traductions FR / EN
- vite-plugin-pwa : installable, jouable hors ligne en mode invité
- Vitest (unitaires), Playwright (end-to-end)

server :
- Node.js + TypeScript + Fastify
- Prisma + PostgreSQL (docker-compose en local)
- Zod sur toutes les entrées
- Authentification : email + mot de passe (argon2), connexion GitHub OAuth, session JWT en cookie
  httpOnly avec refresh token
- Rôles : USER, ADMIN
- Rate limiting, CORS, Helmet, logs structurés (pino)
- Proxy vers l'API Claude d'Anthropic pour le Slack piloté par l'IA (clé uniquement côté serveur)

DevOps :
- GitHub Actions : lint, typecheck, tests, build à chaque push
- Client sur Vercel, serveur et base sur Render ou Railway
- `.env.example` documenté

# ARCHITECTURE (point fort de la soutenance)
La simulation est totalement découplée du rendu.
- `simulation/` : TypeScript pur, sans dépendance à Three.js, React ou au DOM. Architecture ECS
  (entités, composants, systèmes). Pas de temps fixe, RNG seedable donc 100 % déterministe.
  État sérialisable en JSON.
- `engine/` : horloge, vitesses (pause, x1, x2, x4), communication avec le Web Worker.
- `render/` : lit des snapshots d'état, interpole entre deux ticks, ne modifie jamais l'état.
- `ui/` : lit l'état via Zustand et envoie des commandes typées à la simulation.
Conséquences à démontrer :
- x4 fluide.
- Sauvegarde instantanée.
- Mode Daily identique pour tous grâce à la graine.
- Replays rejouables à partir de la graine et de la liste des commandes.
- Équilibrage testé automatiquement par des milliers de parties simulées sans navigateur.

Arborescence attendue :

```
open-space-simulator/
├── packages/
│   ├── shared/src/               # types, schémas Zod, constantes d'équilibrage
│   ├── client/
│   │   ├── public/assets/kenney/ # packs Kenney déposés manuellement
│   │   ├── src/
│   │   │   ├── engine/           # boucle, horloge, worker bridge
│   │   │   ├── simulation/       # ECS : devs, tâches, jauges, économie, sprints, phases
│   │   │   ├── events/           # moteur de cartes, tirage, conditions, effets, requeue
│   │   │   ├── ai/               # A* sur grille, behavior trees des persos
│   │   │   ├── render/           # scène Three.js, caméra iso, GLB, animations, bulles, FX
│   │   │   ├── ui/               # React : HUD, Kanban, fiches devs, recrutement, boutique,
│   │   │   │                     #   Slack, menus, succès, classement, admin
│   │   │   ├── audio/            # Howler, musique, SFX
│   │   │   ├── i18n/             # fr.json, en.json
│   │   │   ├── save/             # sync serveur + cache IndexedDB hors ligne
│   │   │   └── api/              # client HTTP typé
│   │   └── tests/                # Vitest + Playwright
│   └── server/
│       ├── prisma/               # schema + seed (100 cartes, succès, objets)
│       └── src/
│           ├── routes/           # auth, saves, events, scores, achievements, daily,
│           │                     #   slack-ai, admin
│           ├── plugins/
│           └── services/
├── .github/workflows/
├── docker-compose.yml
└── README.md
```

# FONCTIONNALITÉS

## 1. Temps et sprints
- Sprints de 2 semaines simulées, environ 3 min réelles à x1. Vitesses pause, x1, x2, x4.
- 18 mois, soit 39 sprints.
- Chaque sprint se déroule en 4 temps :
  1. Planification : backlog façon Kanban avec glisser-déposer (souris et tactile). Les features
     ont une taille, un type (feature, refacto, bugfix, infra) et un impact sur les jauges.
  2. Exécution : les devs travaillent en temps réel dans l'open space.
  3. Crises : des cartes d'événements tombent pendant l'exécution.
  4. Démo : écran de fin de sprint avec utilisateurs gagnés ou perdus, argent, réputation et
     retours d'utilisateurs drôles.
- Cycle jour/nuit visible par l'éclairage de la scène. Le vendredi 17h est signalé à l'écran.

## 2. Jauges
| Jauge | Rôle | À 0 |
| --- | --- | --- |
| Trésorerie | Payer les salaires | Game over, faillite |
| Café | Carburant | Productivité divisée par 3 |
| Moral (par dev) | Motivation | Démission annoncée par un faux post LinkedIn |
| Dette technique | Monte à chaque raccourci | Bugs, prod instable |
| Stabilité prod | Fiabilité | Fuite des utilisateurs |
| Hype | Attractivité pour les investisseurs | Plus de levée de fonds |

Un dashboard affiche l'historique de chaque jauge sous forme de graphiques.

## 3. Employés
Chaque dev a :
- des stats : Vitesse, Qualité, Endurance, Ego ;
- un trait, un nom généré et une mini-bio drôle (« Kevin, 24 ans, a mis "ninja" dans son titre
  LinkedIn ») ;
- un salaire, un niveau d'expérience qui progresse, et des relations avec ses collègues
  (affinités et conflits qui influencent le moral).

Les 8 profils :
- Senior Barbu : +50 % de qualité, refuse les frameworks de moins de 5 ans.
- 10x Developer : très rapide, mais son code augmente la dette, car personne ne le comprend.
- Stagiaire : 5 % de chance par jour de casser la prod.
- Rustacé : veut tout réécrire en Rust et convertit progressivement ses collègues.
- Designeuse : bloque les releases tant que le padding est faux, +qualité perçue aux démos.
- Product Owner : 4 réunions par jour, -10 % de productivité pour tous, +hype.
- IA Agent : ultra rapide, 30 % de chance d'halluciner une feature.
- Dev Fantôme : en télétravail, invisible dans le bureau, mais ses tickets se ferment.

Recrutement : 3 candidats générés par sprint, avec négociation de salaire et un risque que le
candidat refuse l'offre.
Fiche détaillée de chaque dev : stats, historique, humeur, relations.
Licenciement possible, avec un impact sur le moral de l'équipe.

## 4. IA des personnages
- Pathfinding A* sur la grille, avec évitement entre personnages.
- Behavior trees : travailler, aller au café, aller en réunion, discuter, se disputer, dormir sur
  le clavier, crier sur l'écran, jouer au babyfoot, partir le soir.
- Bulles de pensée contextuelles au-dessus des têtes (« pourquoi ça marche ?? »,
  « je vais démissionner »).

## 5. Événements
- 100 cartes à choix multiples, stockées en base et chargées au démarrage. Elles sont mises en
  cache pour le mode hors ligne.
- Chaque carte a un poids, des conditions (phase, rôle présent, seuils de jauges, jour et heure,
  carte déjà vue) et des choix avec des effets.
- Les chaînes d'événements sont possibles : le choix « On en reparle » remet en file une version
  pire de la même carte.
- Format :
  { id, title: {fr, en}, description: {fr, en},
    conditions: { minPhase?, maxPhase?, hasRole?, gauges?: {[name]: {min?, max?}},
                  dayOfWeek?, afterHour?, requiresSeen? },
    weight, cooldownSprints,
    choices: [{ label: {fr, en}, effects: { treasury?, coffee?, hype?, debt?, stability?,
                users?, moral?, "moral.<role>"?, sprintsLost?, requeue?, spawnDev?,
                fireDev?, unlockAchievement? } }] }
- Cartes à inclure parmi les 100 :
  - « Le CTO a lu un article sur Medium » (migration en microservices).
  - « Vendredi 17h04, la prod est down ».
  - « Le stagiaire a git push --force sur main ».
  - « Un dev propose un hackathon le week-end ».
  - « Un investisseur veut ajouter de la blockchain ».
  - « La machine à café est en panne ».
  - « Un canard en plastique a été trouvé sur un bureau ».
  - « Ton concurrent vient de lever 50 M€ ».
  - « Réunion de 2h pour choisir la couleur d'un bouton ».
  Écris les 91 autres dans le même esprit.

## 6. Progression
| Phase | Décor | Équipe max | Déblocage |
| --- | --- | --- | --- |
| Garage | 1 bureau IKEA, ramen | 2 | Départ |
| Seed | Petit open space | 6 | 1re levée |
| Série A | Babyfoot, plantes, standing desks | 15 | 2e levée |
| Licorne | Toboggan, sieste-pods, cantine | 30 | Valorisation de 1 Md€ |
| Fin | IPO ou rachat par une big tech | | |

- À chaque phase, le bureau s'agrandit : nouvelles salles, salle de réunion, cuisine.
- Levées de fonds : mini-jeu de pitch où le joueur choisit ses arguments face à un investisseur.
  Le succès dépend de la hype, des utilisateurs et de la dette. La dilution est calculée.
- Fins : faillite, IPO, rachat, ou « zombie » (survie sans croissance au bout de 18 mois).
  L'écran de fin est partageable sous forme d'image générée, par exemple : « Ma startup a été
  rachetée 400 M€ et 7 devs ont fait un burn-out ».

## 7. Aménagement
Mode construction : acheter, placer, tourner et revendre des objets sur la grille. Chaque objet a
un effet réel.
- Machine à café premium : +Café.
- Babyfoot : +Moral, -Productivité.
- Plantes : léger +Moral.
- Casques antibruit : annulent le malus des réunions.
- Chaise ergonomique : +Endurance.
- Ajoute au moins 10 autres objets, en fonction des modèles Kenney disponibles.

## 8. Slack simulé
- Panneau Slack dans un coin de l'écran, avec des canaux #general, #random et #incidents.
- Par défaut, les messages viennent d'une bibliothèque de templates contextuels (plus de 200).
- En mode IA, optionnel et activable dans les options :
  - le serveur appelle l'API Claude avec l'état résumé de la partie et les personnalités des devs ;
  - les persos réagissent aux événements en direct ;
  - le modèle est configurable par variable d'environnement ;
  - quota par utilisateur, cache des réponses, et retour automatique aux templates en cas
    d'erreur.

## 9. Méta-jeu
- Au moins 25 succès, par exemple :
  - « Vendredi Noir » : casser la prod 10 vendredis de suite ;
  - « Zéro Réunion » ;
  - « Licorne sans dette ».
- Modes de jeu :
  - Normal ;
  - Hardcore : pas de pause ;
  - Stagiaires Only ;
  - Défi « Cette app doit sortir en 3 sprints » ;
  - Daily : même graine pour tout le monde chaque jour, à la manière de Wordle, avec un classement
    du jour.
- Classements en ligne : global, Daily et par mode.
- Profil joueur : statistiques cumulées, succès débloqués, meilleures parties.
- Replays : revoir une partie du classement à partir de sa graine et de ses commandes.

## 10. Back-office admin
Interface réservée au rôle ADMIN :
- créer, modifier, dupliquer, désactiver et réactiver les cartes d'événements, avec
  prévisualisation ;
- retrouver une carte grâce à des filtres combinables : recherche plein texte (FR et EN), état,
  phase, profil requis, jauge modifiée, particularités (chaîne, hors tirage, jour ou heure,
  seuil de jauge, recrutement ou licenciement, succès) et tri (titre, poids, tirages, date) ;
- consulter des statistiques : cartes les plus tirées, choix les plus fréquents, taux de faillite
  par phase.

## 11. Direction artistique et audio
- Low-poly isométrique avec les modèles Kenney, une palette cohérente et des ombres douces.
- Animations des personnages : clips du GLB s'ils existent, sinon animations procédurales (bob,
  rotation, petits sauts).
- Effets visuels : particules de fumée quand la prod tombe, confettis lors d'une levée, écran
  rouge clignotant pendant un incident.
- Musique lo-fi, sons de clavier mécanique et sons d'interface Kenney.
- Volumes réglables séparément pour la musique, les effets et l'ambiance.

## 12. Tutoriel et accessibilité
- Tutoriel interactif pendant le premier sprint.
- Infobulles sur toutes les jauges.
- Navigation complète au clavier dans l'UI, contrastes AA, option pour réduire les animations,
  taille de texte réglable.

# CE QUE L'APPLICATION NE FAIT PAS
- Pas de multijoueur en temps réel (le seul aspect compétitif est le classement).
- Pas d'achats intégrés ni de publicité.
- Pas de chat entre joueurs.
- Pas d'application mobile native : c'est une PWA uniquement.
- Pas d'assets payants ni dessinés à la main : uniquement Kenney et des formes Three.js.
- L'IA ne génère que des messages Slack. Elle ne crée jamais d'événements ni ne modifie
  l'équilibrage.

# MODÈLE DE DONNÉES (Prisma, à compléter si nécessaire)
- User : id, email, passwordHash?, githubId?, pseudo, role, locale, createdAt
- Save : userId, slot (1 à 5), state Json, seed, mode, updatedAt
- EventCard : id, content Json (fr/en), conditions Json, choices Json, weight, cooldown, active
- Score : userId, mode, valuation, outcome, sprintsPlayed, seed, commandsLog Json,
  dailyDate?, createdAt
- Achievement : id, title Json, description Json, icon
- UserAchievement : userId, achievementId, unlockedAt
- EventStat : cardId, choiceIndex, count
- AiQuota : userId, date, count

# API REST
- Auth : register, login, logout, refresh, GitHub OAuth, GET /me
- Sauvegardes : CRUD /saves
- Événements : GET /events
- Scores :
  - POST /scores, avec rejeu côté serveur de la graine et des commandes pour vérifier le score et
    empêcher la triche ;
  - GET /scores/top?mode=&daily= ;
  - GET /scores/:id/replay.
- Daily : GET /daily (graine du jour)
- Succès : GET /achievements, POST /achievements/unlock
- Slack IA : POST /slack-ai/message
- Admin : CRUD /admin/events, GET /admin/stats
- Documentation OpenAPI générée automatiquement (Swagger UI).
- Format d'erreur homogène : { error: { code, message } }.

# ASSETS KENNEY
Je dépose moi-même les packs dans `packages/client/public/assets/kenney/<pack>/`. Par exemple :
un kit de mobilier 3D, des personnages 3D, un pack d'UI et des packs de sons.
- N'invente jamais un nom de fichier. Demande-moi d'abord la sortie de `ls -R`, puis génère un
  `assetManifest.ts` typé à partir de cette liste.
- Si un modèle manque, utilise une forme Three.js en remplacement et note-le dans une liste
  « assets manquants ».
- Ajoute une page Crédits dans le jeu et une section dans le README (Kenney, CC0).

# RESPONSIVE (OBLIGATOIRE)
- Le canvas Three.js prend tout l'écran et se redimensionne. Le devicePixelRatio est plafonné à 2.
- Desktop : HUD latéral, Slack ancré dans un coin.
- Mobile :
  - jauges compactes en haut, barre d'actions en bas ;
  - Kanban, boutique, Slack et cartes en bottom sheets plein écran ;
  - pinch pour zoomer, glisser pour déplacer la caméra, appui long pour sélectionner ;
  - glisser-déposer tactile dans le Kanban et en mode construction.
- Cibles tactiles d'au moins 44 px.
- Valider à 375, 768, 1024 et 1440 px de large, en portrait et en paysage, avec des tests
  Playwright sur ces viewports.
- Performances :
  - 60 fps visés sur desktop, 30 fps minimum sur mobile milieu de gamme ;
  - InstancedMesh pour le mobilier, LOD et désactivation des ombres sur mobile ;
  - qualité graphique réglable : bas, moyen, haut.

# QUALITÉ
- TypeScript strict. Aucun `any` non justifié.
- Couverture des tests de simulation supérieure à 80 %.
- Script `pnpm balance` qui simule 10 000 parties avec des stratégies automatiques et produit un
  rapport d'équilibrage : taux de faillite, valorisation moyenne, cartes trop fortes.
- Tests end-to-end Playwright sur les parcours principaux : inscription, partie, sauvegarde,
  classement.
- ESLint, Prettier, commits conventionnels.
- README complet : installation, architecture avec schémas, choix techniques, ce que l'app fait
  et ne fait pas, captures d'écran et GIFs, crédits.

# MÉTHODE DE TRAVAIL
Travaille par étapes. À la fin de chaque étape, livre une version jouable, résume ce qui a été
fait, explique comment le tester, puis ATTENDS ma validation avant de continuer.

0. Plan : propose un découpage détaillé, les risques techniques et tes questions. Ne code rien.
1. Socle : monorepo, CI, docker-compose, Fastify, Prisma, auth complète, i18n.
2. Scène 3D : grille iso, caméra, contrôles souris et tactiles, chargement des assets Kenney,
   responsive, réglages de qualité graphique.
3. Simulation : ECS, Web Worker, RNG seedable, jauges, économie, sprints, tests.
4. Personnages : modèles, A*, behavior trees, animations, bulles.
5. Interface : HUD, dashboard, Kanban, fiches devs, recrutement.
6. Événements : moteur, 100 cartes, chaînes, statistiques.
7. Progression : 5 phases, levées de fonds, aménagement, fins, écran de fin partageable.
8. Méta-jeu : succès, modes, Daily, classements, replays, anti-triche.
9. Slack : templates, puis mode IA via le proxy serveur.
10. Back-office admin.
11. Polish : audio, effets visuels, tutoriel, accessibilité, PWA hors ligne.
12. Livraison : équilibrage avec `pnpm balance`, optimisation, déploiement, README final.

Si tu vois une meilleure solution technique que celle demandée, propose-la avant de l'appliquer.
Ne supprime jamais une fonctionnalité du périmètre sans mon accord.

# PASSATION ENTRE THOMAS ET MELVIN
Lis `CONTEXTE.md` à la racine avant de commencer : travaux en cours, décisions en attente,
journal des passations. À la fin de chaque travail (fil de discussion ou PR), mets-le à jour
(date, dernier commit, travaux en cours, une ligne dans le journal), en plus de cette section
et du README.

# BRANCHES : DEVELOP PUIS MAIN (depuis le 17 octobre 2026)
- `main` est la version publiée : GitHub Pages (et Render) ne déploient que `main`. On n'y pousse
  jamais directement et on n'y ouvre pas de PR de fonctionnalité.
- `develop` reçoit tout le travail en test. Chaque demande = une branche partie de `develop`
  (`feat/…`, `fix/…`, `docs/…` ou `claude/…`) = une PR **vers `develop`**, CI verte, fusionnée en
  squash après la validation de Melvin (ou de Thomas). Une idée abandonnée se retire de `develop`
  (revert) sans toucher à `main`.
- Mise en production : quand Thomas **et** Melvin ont testé `develop`, une PR `develop` → `main`
  intitulée « release: … », fusionnée en **merge commit** (pas de squash, sinon les deux branches
  divergent et la PR suivante rejoue tout l'historique).
- Correctif urgent en production : branche depuis `main`, PR vers `main`, puis fusionner `main`
  dans `develop` aussitôt.
- La CI tourne sur toutes les branches et toutes les PR ; l'ÉTAT D'AVANCEMENT ci-dessous décrit
  `develop`, la date de la dernière mise en production est dans `CONTEXTE.md`.

# ÉTAT D'AVANCEMENT (mis à jour le 2 novembre 2026)
Les 12 étapes sont livrées et fusionnées dans `main`. Ajouts validés depuis, à conserver :
- Mode Facile et tutoriel adapté à chaque mode ; zoom trackpad progressif ; défilement de la
  caméra au bord de l'écran.
- Mode construction refondu : catalogue en bas, aperçu sur la grille, bouton « Poser » au
  tactile, rendu 3D distinct pour chacun des 22 objets.
- 70 succès avec difficultés, dont 22 secrets (nom visible, condition « ??? »).
- Menu principal refondu ; sans serveur, la fenêtre Connexion explique que les comptes sont
  indisponibles et le jeu reste jouable en invité.
- Interface de jeu refondue : en haut ce qu'on lit (jauges, trésorerie en mois, horloge), en
  bas ce qu'on fait (dock d'actions et commande de l'étape).
- Télétravail automatique chaque matin de semaine (bureau manquant, épuisement, conflit, café
  vide pour les accros, Dev Fantôme toujours) : -15 % de vitesse, -5 % de qualité, moins de
  fatigue.
- Équilibrage des jauges sur toute la partie (`packages/shared/src/sim/balance.ts`), rapport
  dans `docs/balance.md`.
- Back-office refondu : tuiles de cartes, filtres combinables, duplication, réactivation,
  nombre de tirages par carte (`GET /api/admin/events` renvoie `draws`).
- Options compactes : Guide du jeu en 3 parties repliables. L'option Slack IA n'apparaît que
  pour un joueur connecté sur un serveur qui a une clé d'API. Débit du Slack limité
  (`packages/client/src/slack/pacing.ts` : 2 messages d'affilée puis 1 toutes les 20 s,
  urgences toujours publiées, IA appelée au plus toutes les 45 s).
- Personnages selon le profil (`render/officeCharacters.ts`) : les 10 Blocky Characters hors
  thème (pirate, ninja, zombies…) ne sont plus tirés ; looks Kenney avec accessoires Three.js et
  13 personnages construits en Three.js, animés par les clips Kenney.
- Packs de personnages (`render/characterPacks.ts`) activables dans l'onglet « Packs de
  personnages » du back-office : Base (looks habituels, actif par défaut), Noël, Halloween,
  Pâques, Super-héros (inventés), Été, Espace, Pirates, Moyen Âge, Années 80, Cyberpunk. Les
  packs actifs se mélangent dans l'équipe ; table `CharacterPack`, `GET /api/character-packs`.
- Horloge continue : la simulation garde son pas de 30 min (replays, Daily, sauvegardes
  inchangés) mais l'heure, la barre de sprint et l'éclairage défilent minute par minute
  (`packages/client/src/view/liveTime.ts`). Un sprint dure environ 5 min à x1
  (`GAME.sprintRealSecondsAtX1` = 300).
- Calendrier et saisons (`packages/shared/src/sim/calendar.ts`) : la partie commence le lundi de
  la semaine réelle (date dans la graine), 12 périodes d'environ une semaine (Nouvel An,
  Saint-Valentin, Pâques, Espace, Moyen Âge, Super-héros, Années 80, Été, Pirates, Halloween,
  Cyberpunk, Noël) avec 24 cartes de saison prioritaires. Décorations par thème en Three.js
  (`render/decorations.ts`, `view/decor.ts`) aux murs et sur les bureaux, plus aucune au sol
  (objets fantômes ni déplaçables ni rangeables, retirés le 17 octobre 2026), réglées dans
  l'onglet « Décorations » du back-office : désactivé, en saison (défaut) ou toujours ; table
  `DecorTheme`.
- Anniversaires des devs (date tirée de la graine, sans toucher au RNG) : table de fête
  décorative (gâteau, cadeaux, ballons), +moral, confettis, Slack ; le week-end, fête le lundi.
- Performance des devs (`client/src/simulation/performance.ts`, composant ECS `performance`) :
  note globale S à D mesurée sur les 2 derniers sprints, productivité par sprint côte à côte
  dans la fiche (100 % = un dev standard), ancienneté, XP, tâche en cours, allié et bête noire ;
  au recrutement, performance estimée, salaire du marché et chances d'acceptation de l'offre.
- Filtres de l'équipe (`client/src/ui/team/filters.ts`, `TeamFilterBar.tsx`) : filtres cumulables
  (note S à D, en conflit, fatigué, moral bas, télétravail, au bureau, métier) et tri
  (performance, moral, énergie, conflits, salaire, ancienneté, nom), gardés dans le store
  (`teamFilters`) ; chaque ligne affiche ⚔️ et le nombre de conflits. Lecture seule de la GameView.
- Ambiance du bureau : l'écran d'un dev s'allume quand il y travaille, avec un contenu lié à son
  métier (code, vim, Rust, maquettes, Kanban, terminal d'IA, forum ; erreur rouge quand il crie,
  économiseur quand il dort) : `render/screens.ts`. Éclairage de la salle : appliques Kenney et
  halos, plafonniers, fenêtres couleur du ciel, taches de soleil le jour (`render/officeLights.ts`) ;
  vraies lampes selon la qualité (0 bas, 3 moyen, 6 haut).
- Construction : pose en série (l'objet reste en main jusqu'à « Terminer », arrêt automatique au
  maximum ou si la trésorerie manque) ; 12 accessoires posés sur les meubles (`surfaceSlots`,
  commandes `BUY_ACCESSORY` / `MOVE_ACCESSORY`, revendus et déplacés avec leur meuble) ; 12 couleurs
  au choix à l'achat ou via « Peindre » (`PAINT_FURNITURE`, `client/src/view/colors.ts`).
- Accessoires de bureau et inventaire : écouteurs sans fil (`desk-earbuds`, protègent 1 dev des
  réunions) et mini-cactus (`mini-cactus`) posés sur les bureaux, 3 emplacements par bureau ; la
  station au sol et le cactus au sol restent (« Station de recharge d'écouteurs », « Cactus en pot »).
  « 📦 Ranger » met un objet et ses accessoires dans l'inventaire (onglet du catalogue) ; on l'en
  ressort gratuitement ou on le revend. Commandes `STORE_FURNITURE`, `PLACE_STORED`,
  `PLACE_STORED_ACCESSORY`, `SELL_STORED` ; état `inventory` (vide par défaut) ; un objet rangé n'a
  plus d'effet mais compte dans le maximum de la boutique.
- Vraies pauses (`BALANCE.breaks`, `scheduledBreak` dans `simulation/systems/activity.ts`) :
  10h30, déjeuner 12h (1 h), 15h, un dev sur deux décalé de 30 min ; café, babyfoot ou balade en
  cuisine selon le caractère (activités `BREAK` et `LUNCH`). Rendu (`ai/agents.ts`) : marche à
  8 cases/s, arrivée directe au bureau le matin, activité affichée menée à son terme
  (`MIN_STAY_STEPS`), personnages bloqués qui se faufilent.
- Filiales (panneau « Investir », dès la Série A) : 3 projets par planification (prudent,
  audacieux, moonshot), au plus 3 filiales, 6 mois de salaires toujours gardés en caisse. Chaque
  filiale donne une aile au bureau (incubateur) et +2 places dans l'équipe ; 80 % de ses parts
  comptent dans la valorisation, dividendes, revente à 90 %, vente d'urgence avant la faillite.
  Hasard sur une graine à part : une partie sans filiale reste identique (replays, Daily).
  6 cartes « filiales », 4 succès, bot « investor » dans `pnpm balance`
  (`packages/shared/src/sim/ventures.ts`, `client/src/simulation/ventures.ts`).
- Demandes d'augmentation (`BALANCE.raises`, `client/src/simulation/raises.ts`) : tous les 5 à 10
  sprints, avec au moins 3 devs, 60 % de chance qu'un dev (plutôt un gros ego) demande +10 à 20 %
  pendant la planification ; fenêtre de décision qui bloque le lancement du sprint. Accepté :
  salaire relevé, +20 moral, 2 compétences +1. Refusé : 50 % de démission (départ 2 planifications
  plus tard, badge dans l'équipe), sinon -15 moral et 2 compétences -1. Commande `ANSWER_RAISE`,
  hasard sur une graine à part, état `raises` par défaut pour les anciennes sauvegardes.
- Congés, jours fériés et arrêts maladie (`shared/sim/teamLife.ts`, `client/src/simulation/teamLife.ts`,
  bloc « Congés » de la fiche d'un dev, `ui/team/Leave.tsx`) : 11 jours fériés français (Pâques
  calculé), personne au bureau ce jour-là. 1 jour de congé par sprint dès le 2e (10 au plus), posé
  en planification sur la 1re ou la 2e semaine (1 à 5 jours, 1 dev absent pour 4 en même temps) :
  +4 moral par jour au retour (20 au plus). Réserve pleine : -1 moral par jour, et après 2 sprints
  le dev pose 5 jours tout seul. Ponts de mai (vendredi après un jeudi férié, lundi avant un mardi
  férié) : faits par défaut, refusés en un clic (-5 moral pour tous). Arrêt maladie de 1 à 3 jours
  (0,5 % par jour, double l'hiver, moins avec l'endurance). Moral à 0 : arrêt de 10 jours ouvrés
  pour burn-out au lieu de la démission, retour à 40 de moral ; rechute dans les 10 sprints :
  démission. Un absent n'a ni tâche ni bureau, filtre 🏖️ de l'équipe. Commandes `BOOK_LEAVE`,
  `CANCEL_LEAVE`, `REFUSE_BRIDGES`, état `teamLife` (null pour les anciennes sauvegardes et le défi
  3 sprints = comportement d'avant), hasard sur `seed#leave#jour`. 2 succès, bot « rested ».
- Rétrospective de sprint (`shared/sim/retro.ts`, `client/src/simulation/retro.ts`, fenêtre
  « Rétrospective » en planification dès le 2e sprint) : 3 actions proposées selon les problèmes du
  sprint écoulé (dette, pannes, urgences ratées, café, fatigue, conflits, réunions…) parmi 10 (plus
  de tests, revue de code, café en libre-service, médiation, astreinte, horaires souples, petits
  tickets, mercredi sans réunion, kudos, continuer comme ça). Chaque dev vote selon son profil et
  son caractère (`seed#retro#sprint`). Suivre le vote : +3 moral pour tous ; imposer autre chose :
  -3 pour ceux qui ont voté autrement ; passer la rétro ne coûte rien. L'action dure un sprint
  (🔁 dans le HUD). Commande `HOLD_RETRO`, état `retro` (vide par défaut), bot « retro ».
- Team building (`shared/sim/teamBuilding.ts`, `client/src/simulation/teamBuilding.ts`, bloc
  « 🎉 Team building » du panneau Équipe, `ui/team/TeamBuilding.tsx`) : une sortie par sprint,
  réservée et payée en planification (prix par participant, sans Dev Fantôme ni IA Agent), en fin
  de 2e semaine. Afterwork (40 €, jeudi 18h, aucune heure perdue, -15 énergie), escape game (90 €,
  vendredi 14h, +25 d'affinité pour les paires en conflit, 15 % de chance que ça empire), laser
  game (70 €, Seed, gros egos perdants qui boudent), séminaire au vert (600 €, Série A, journée,
  +énergie, +hype), off-site à Lisbonne (2 500 €, Licorne, 2 jours, +hype, -dette). Effets à 18h le
  dernier jour (moral selon le caractère, affinités) ; même sortie deux sprints de suite : moitié
  moins de moral ; annulation remboursée à 50 %. Hasard sur `seed#teambuilding#sprint`. Commandes
  `BOOK_TEAM_BUILDING` / `CANCEL_TEAM_BUILDING`, état `teamBuilding` (vide par défaut), 2 succès,
  bot « teambuilder ».
- Levées de fonds (`shared/sim/pitch.ts`, `shared/sim/funding.ts`, panneau « Lever des fonds ») :
  6 tours de plus en plus durs (Seed à pré-IPO : 3 à 5 questions, 3 à 4 réponses, barre plus
  haute, bluffs démasqués plus souvent, gros fonds, départ de l'investisseur dès la Série B) ;
  question par manche, réponse hors sujet pénalisée, jauge d'intérêt et réactions. Business
  angels, prêt bancaire, financement participatif, subvention (`TAKE_FINANCING`, état
  `financing`, sans hasard). Questions et bluffs sur une graine à part. Bot « financier ».
- Annexes du bureau : dès la Série B, chaque tour réussi ouvre une annexe pleine largeur (arcade,
  jardin, auditorium) avec décor fixe (`render/annexDecor.ts`) et +2 places. Sol d'origine
  identique dans toutes les pièces (damier beige, `BASE_FLOOR_COLORS` dans `render/office.ts`) :
  ajouter ou agrandir une pièce ne change pas sa couleur, seul le rayon « Sols » la change.
- Vue sur New York (`render/skyline.ts`) : le bureau est au dernier étage d'une tour, dans une ville low-poly façon
  Manhattan en formes Three.js (tours à gradins, réservoirs d'eau, parc, fleuve, taxis), sans
  bâtiment réel. Graine fixe, sans le RNG du jeu ; aucun toit proche ne cache la salle
  (`maxTop`) ; brume, fenêtres, lampadaires et balises qui suivent le jour et la nuit.
  Qualité basse par défaut quand WebGL tourne sans carte graphique (SwiftShader, llvmpipe).
- Vue sur New York réaliste (`render/skylineShaders.ts`, `render/cityLights.ts`) : 5 styles de
  façades dessinés par shader (verre, brique, pierre, bandeaux, brownstone ; vitrines au
  rez-de-chaussée, reflets du ciel, éclat du soleil), éclairage ciel + soleil + fond de rue plus
  sombre, brume à 75 %. Fenêtres allumées une à une selon l'heure du jeu (`litShare` : bureaux qui
  se vident de 18h à 22h, logements le soir), seuil par fenêtre, lampes qui changent toutes les 6
  à 20 s, télés qui scintillent. Toits à muret, climatiseurs, édicules, panneaux solaires,
  couronnes illuminées la nuit ; rues marquées, passages piétons, flaques des lampadaires ;
  arbres d'alignement, voitures à phares et feux arrière (90 à 220 selon la qualité), fleuve
  animé, 2 avions au loin. Graine fixe par pâté, hauteurs sur des étages entiers ; `update`
  reçoit la minute affichée, `setQuality` allège la qualité basse. Rendu seulement.
- Pause pendant les cartes d'événement : le temps s'arrête (❚❚ allumé, personnages immobiles)
  tant que la carte est ouverte, puis la vitesse d'avant reprend (`engine/host.ts`,
  `holdForEvent`) ; pas en Hardcore ni en replay. Le focus va sur la carte, pas sur un choix.
- Tâches dynamiques (`shared/sim/taskFlow.ts`, `client/src/simulation/taskFlow.ts`) : backlog
  jusqu'à 2,5 idées par dev ; urgences avec délai en heures ouvrées, message et bandeau rouge
  (« Réparer la prod » à chaque panne, 5 autres au hasard à 10h, plus fréquentes avec l'équipe),
  servies en premier, bonus à temps, pénalité ratée ; 1 à 3 tâches de la semaine le lundi 9h, dues
  vendredi 18h ; objectif de sprint (4 sprints sur 10 dès le 2e, facile, moyen ou difficile,
  récompense à la démo) affiché en haut du Kanban. Seule la récompense propre compte pour ces
  tâches. Hasard sur une graine à part (`seed#tasks#…`), champs `kind`, `objective` par défaut.
- Tâches par métier (`ROLE_TRADE`, `TASK_TRADES` dans `shared/sim/components.ts`) : Code (6 profils),
  Design (designeuse), Produit (PO). Le backlog suit les effectifs de chaque métier (tirage seulement
  si l'équipe a plusieurs métiers) ; 21 tâches design et produit (8 features) ; l'assignation
  automatique ne donne une tâche qu'au bon métier, urgences d'abord (urgences et tâches de la
  semaine = code) ; confiée à la main hors métier, elle avance à 60 %
  (`BALANCE.work.offTradeMultiplier`). Bouton « Tout en À faire » (`MOVE_ALL_TO_TODO`). Champ
  `trade` optionnel (code par défaut). Effet sur `pnpm balance` : plus de licornes pour les bons bots
  (le PO ne prend plus les urgences), faillite inchangée.
- Salles de réunion (`shared/sim/meetings.ts`, `client/src/simulation/meetings.ts`, panneau
  « 🗓️ Réunion ») : dès la Seed, 6 formules avec bonus et malus (stand-up, brainstorming,
  aquarium ; zen et war room en Série A ; salle du conseil en Licorne), rendu 3D distinct
  (`render/meetingRoom.ts`), chaises attribuées aux devs. Réunion d'équipe chaque matin de semaine
  à 9h, dès l'arrivée, pendant 20 min (`MEETINGS.dailyMinutes`, le reste de la demi-heure on code),
  utile ou inutile, sur une graine à part (`seed#meeting#tick`) ; changer ou vider la
  salle rend 50 %. Réunion de crise à chaque panne (`holdCrisisMeeting`, sans hasard) : le
  coupable, 3 devs du code au plus (DevOps et Tech Lead d'abord) et le PO ou un manager passent
  une demi-heure en salle, puis le meneur prend « Réparer la prod », déjà avancée de 15 à 50 %
  selon la formule (`crisisHeadStart`, war room 50 %) ; coupable -3 moral, stat `crisisMeetings`. Commandes `FIT_MEETING_ROOM` / `CLEAR_MEETING_ROOM`, état `meetingRoom` (null
  par défaut). Bot « organizer » : environ +33 % de valorisation médiane face à « balanced ».
  À 375 px, les 8 boutons du dock tiennent sans défilement (libellé court « Réunion »).
- « Continuer » ne propose plus une partie terminée : à la fin, sa sauvegarde automatique est
  effacée (appareil et serveur) et sa date de fin notée ; ses sauvegardes manuelles restent dans
  « Charger une partie » (`saves.markFinished`, `saves.latestResumable` dans
  `client/src/save/saves.ts`). Un Daily rejoué reste proposé.
- Nouvelle partie depuis le menu : avec une partie en cours, l'accueil affiche « Continuer » et,
  dessous, « Nouvelle partie » (mode suggéré : Facile au premier lancement, puis Normal), en plus
  des cartes des modes (`ui/menu/HomeMenu.tsx`). La sauvegarde automatique marche aussi en
  `pnpm dev` : `installGameLifecycle` se rebranche après le double montage de StrictMode.
- Variété des tâches du Kanban (`client/src/simulation/taskTitles.ts`, catalogues dans
  `client/src/simulation/data/tasks.ts`) : 114 titres de code de base, 28 débloqués par phase
  (`GROWTH_TASK_TITLES` : Seed, Série A, Licorne), 48 de saison (`SEASON_TASK_TITLES`, une tâche de
  code sur trois pendant la période), 23 pour la designeuse et 22 pour le PO ; 11 urgences et 12
  tâches de la semaine. Jamais deux fois le même titre sur le tableau, les 60 derniers ne reviennent
  pas tant qu'il en reste de neufs (état `recentTaskTitles`, vide par défaut). Le titre est
  décoratif et ne consomme aucun tirage de plus dans le générateur de la partie.

- Fenêtres à acheter (`view/windows.ts`, rayon « Fenêtres » du mode construction) : les locaux
  démarrent sans fenêtre, murs du fond pleins. Petite fenêtre (1 case, 800 €), fenêtre (2 cases),
  grande fenêtre (3 cases) et baie vitrée du sol au plafond (2 cases, 5 000 €), +moral. Objets
  `wall` fixés dans le mur du fond (rotation 0, y = 0) ou de gauche (rotation 1, x = 0) ; le mur
  est percé et la ville se voit à travers, soleil devant, applique couverte décrochée
  (`wallSpans` dans `render/office.ts`). Pas de nouvelle commande ni de champ d'état.
- Chats de bureau (`shared/sim/pets.ts`, `client/src/simulation/pets.ts`, rayon « Animaux » du
  mode construction, panneau « 🐈 Chats ») : 5 chats au plus, 5 000 € l'adoption, possible
  seulement avec une litière, une gamelle et un arbre à chat posés (un objet rangé ne compte pas).
  3 litières (ouverte 60 €, fermée 220 €, robot 1 200 €), 3 arbres à chat de 1, 2 et 3 cases aux
  coloris différents, 2 gamelles nourriture et eau (simple, distributeur). Chat heureux : +moral,
  +hype, léger -0,4 % de productivité ; sans équipement complet, il boude (-moral). Confier un chat
  à une famille : pas de remboursement, -5 moral. 6 robes au choix, nom tiré de
  `seed#pet#n` sans toucher au RNG. Commandes `ADOPT_PET` / `REHOME_PET`, état `pets` (vide par
  défaut), stat `petsAdopted`. Chats en Three.js (`render/pets.ts`) qui se baladent en A*, mangent,
  se cachent dans la litière fermée, grimpent aux perchoirs et dorment surtout la nuit
  (`ai/cats.ts`, graine à part, rendu seulement). Besoins par chat (faim, soif, litière, fatigue,
  envie de jouer) : croquettes puis souvent eau juste après (places `feeding` devant chaque bol),
  litière, jeu sous le pompon de l'arbre à chat (`toys`, postures « jouer » et « boire ») en
  sautant d'un plateau à l'autre, puis sieste. Places réservées : deux chats ne se posent jamais
  au même endroit, et ils contournent ceux couchés par terre.
- Équipe web (`shared/sim/teamRoles.ts`, `client/src/simulation/leadership.ts`) : 10 métiers en
  plus des 8 profils (`WEB_ROLES`). Devs Front, Back et Fullstack : côté de la tâche déduit du
  titre anglais (mots-clés puis hachage, sans tirage), `BALANCE.stacks` (1,15 de son côté, 0,6 de
  l'autre, fullstack 0,85, spécialité x1,2 sur son type de tâche), `identity.specialty` optionnelle.
  Tech Lead (-15 % de dette des features), DevOps (+stabilité par jour), testeurs QA (métier `QA`,
  12 tâches de recette, -10 % de dette par testeur, 30 % au plus). Encadrement sans tâches
  (`ROLE_TRADE` à null) : scrum master, managers (1 pour 6), sous-directeur, directeur technique,
  effets dans `BALANCE.leadership`. Postes ouverts selon l'équipe et la phase (`roleLimit`), bloc
  « Encadrement » du panneau Équipe. 3 candidats habituels inchangés + 2 de l'équipe web sur
  `seed#web-roles#sprint` (replays, Daily, sauvegardes inchangés). `pnpm balance` : faillite
  inchangée, licornes réparties autrement, car les bots ne savent pas composer une équipe web.
- Musiques du propriétaire (`client/public/assets/music/`, 7 MP3 non réencodés, noms d'origine sans
  espace ni accent) : tycoon au menu, tycoon 1 en planification et démo, les 4 Détente en playlist
  pendant le sprint, aria math en levée de fonds et à l'écran de fin (`audio/music.ts`,
  `musicMoodOf`, `ui/useMusic.ts`). Fondu de 1,5 s, reprise du morceau là où il était, lecture en
  flux HTML5, démarrage au premier clic, volume « Musique » des options. Hors précache de la PWA
  (25 Mo) : hors ligne, pas de musique. Crédits : « compositions originales de l'équipe du projet ».
- Canapé et bibliothèque détaillés (`render/furnitureDetail.ts`, formes `sofa` et `bookcase` des
  assets manquants) : canapé en tissu gris-bleu (pieds en bois, accoudoirs roulés, coussins
  séparés, coussins déco, plaid), bibliothèque à deux colonnes (placard, paniers, livres un par un,
  livres penchés et empilés, plante, cadre, trophée). Pièces fusionnées par matériau, tirages sur
  une graine fixe propre au fichier ; tissu repeignable (`fabric`, `fabricDark`), dessus de la
  bibliothèque à 1,58 et assise à 0,44 inchangés. Les modèles Kenney restent dans les salles de
  réunion.
- Poste de travail : clavier QWERTY à vraies touches sur le bureau de dev et le bureau debout
  (`render/keyboard.ts`, forme `qwertyKeyboard` des assets manquants) : 61 touches en relief,
  police maison 3 x 5 dessinée pixel par pixel, touches fusionnées en un seul appel de dessin.
  Souris Kenney à l'échelle du clavier (x0,7, `MOUSE_SCALE`) sur un tapis de souris sombre (forme
  `mousePad`), aux bureaux de dev et debout et à côté du portable du garage. Rendu seulement.
- Plantes d'intérieur (rayon « Déco », `render/plants.ts`) : 8 plantes en plus, modélisées en
  Three.js feuille par feuille (le Furniture Kit n'a que 4 petites plantes). Petites : sansevieria,
  pothos sur sellette, bonsaï. Grandes : figuier lyre, palmier kentia (Seed), olivier centenaire
  (Série A). Grosses : jardinière de séparation 3 x 1 (Seed), monstera géante 2 x 2 (Série A).
  Effet réel (moral, et qualité, hype, récupération ou productivité selon la plante), seul le pot
  se repeint, pièces fusionnées par couleur (`Pieces`), graine fixe propre à chaque plante. Pas de
  commande ni de champ d'état ; les petites sont masquées au dézoom comme le cactus.
- Meubles détaillés comme le canapé (assemblage commun `render/pieces.ts` : couleurs repeignables
  en matériaux nommés, le reste peint par sommet dans un matériau `trim`, voyants dans `lights`,
  2 à 4 maillages par meuble). Bureaux et sièges (`render/workFurniture.ts`) : bureau de dev,
  bureau du garage sur tréteaux, standing desk, chaise à roulettes, chaise ergonomique, meuble
  télé, baie de serveurs, station d'écouteurs. Cuisine (`render/kitchenFurniture.ts`) : 6 meubles
  de cuisine, 5 appareils, frigo à boissons, tablée de cantine. Détente
  (`render/loungeFurniture.ts`) : babyfoot, toboggan, capsule de sieste (dans le bon sens),
  enceinte, tapis rond repeignable, poubelle à pédale. 12 accessoires de bureau
  (`render/deskAccessories.ts`, lampe d'architecte au lieu de la lampe carrée). Équipement des
  chats (`render/petFurniture.ts`) : litières, gamelles et arbres à chat, places de l'IA des chats
  inchangées. Hauteurs et emplacements d'accessoires inchangés ; couleurs `birch`, `chairFabric`,
  `cabinet`, `cushion`, `rug`, `teddy` ajoutées à la palette. Les plantes passent par
  `new Pieces('all')` (un matériau par couleur). Rendu seulement.
- Peintures et papiers peints (`shared/sim/walls.ts`, `client/src/simulation/walls.ts`, rayon
  « 🎨 Murs » du mode construction, `ui/build/WallFinishes.tsx`) : 8 peintures à 400 € le mur et
  9 papiers peints de 900 à 8 000 € (rayures, pois, chevrons, briques +hype ; jungle, lambris,
  tableau noir +qualité en Seed ; art déco en Série A ; pluie de code en Licorne), +moral par mur.
  Pose par zone de mur (`WALL_ZONES` : fond et gauche de l'open space, fond de la cuisine et des
  ailes, gauche des annexes), sans remboursement de l'ancien revêtement. Motifs dessinés sur
  canvas (`view/walls.ts`), peau sur la face intérieure des murs (`render/wallFinishes.ts`),
  percée par les fenêtres. Commande `COVER_WALL`, état `walls` (vide par défaut), aucun tirage.
  Les onglets du catalogue défilent quand ils ne tiennent pas sur la largeur.
- Mise à jour du jeu installé (`ui/appUpdate.ts`, PWA en `registerType: 'prompt'`) : après un
  déploiement, la nouvelle version s'applique toute seule au menu, ou au retour au menu si une
  partie est en cours (rien n'est perdu). Recherche d'une mise à jour toutes les 30 min et au
  retour sur l'onglet. Dépendance `workbox-window` ajoutée au client.
- Version du jeu en bas du menu principal (`src/version.ts`, `__APP_BUILD__` écrit par
  `vite.config.ts`) : « Version 0.1.0 · commit · date du build », pour savoir quelle version tourne.
- Écouteurs à la place des casques antibruit : « Écouteurs sans fil à réduction de bruit »
  (`desk-earbuds`, étui blanc ouvert repeignable, deux écouteurs rangés et un posé à côté) et
  « Station de recharge d'écouteurs » (`earbuds-dock`, 3 étuis) ; même effet, prix et maximums. Les
  personnages qui portaient un casque ont des écouteurs blancs (accessoire `earbuds`) ; le casque
  rétro des Années 80 reste. Nom générique, sans marque. Les anciens identifiants (`desk-headset`,
  `noise-headsets`) sont traduits au chargement et à chaque commande (`LEGACY_FURNITURE_IDS`,
  `client/src/simulation/renamedItems.ts`) : sauvegardes, replays et scores restent valides.
- Cuisine séparée (`shared/sim/furniture.ts`, rayons « Cuisine » et « Électroménager ») : les
  combinés meuble + appareil disparaissent. 6 meubles de cuisine (tiroirs 160 €, portes 140 €, évier
  2 x 1, colonne et vaisselier en Seed, îlot 2 x 1 en Série A, léger +moral) et 5 appareils posés
  dessus comme des accessoires (`appliance`, places `applianceSlots`) : cafetière à filtre (+25 café),
  machine à expresso (+50 café, +moral, succès Barista), micro-ondes, bouilloire, cuiseur à riz
  (Seed). Grille-pain et blender rejoignent l'électroménager. Au garage, la cafetière est posée sur
  le second bureau IKEA (mêmes entités, Daily et replays inchangés). Vieilles sauvegardes : chaque
  combiné devient au chargement un meuble offert + son appareil au même prix, même effet
  (`LEGACY_KITCHEN_ITEMS`, `client/src/simulation/kitchen.ts`). Bot : `findFreeSlot`.

- Ordinateurs des postes (`shared/sim/computers.ts`, `render/computers.ts`, bouton « Ordinateur »
  de l'objet sélectionné, `ui/build/ComputerPicker.tsx`) : chaque bureau de dev et bureau debout a
  une tour sobre d'origine (incluse, au sol sous le plateau), ou au choix 3 tours gaming (« Néon »
  900 €, watercooling 2 200 € en Seed, XXL « Titan » 4 500 € en Série A ; +1 à +3 % de productivité
  au poste, +moral) ou un MacBook Pro (2 800 €, sans logo) posé à la place du clavier, qui disparaît
  (+1 % au poste, +qualité, +hype). L'ancien est revendu à moitié prix, la valeur suit le bureau
  (revente, inventaire). Le clavier QWERTY est posé avec l'ordinateur (`workstation` dans
  `view/catalog.ts`, gabarit `@pc:<bureau>:<ordinateur>` dans `render/office.ts`). Commande
  `SET_COMPUTER`, champ `computer` optionnel (absent = tour sobre), aucun tirage.

- Murs fins (`render/partitions.ts`, rayon « 🧱 Cloisons » du mode construction) : les cloisons du
  plan ne sont plus des blocs d'une case séparés par une fente, mais des murs fins continus
  raccordés à leurs voisins (angles, T, croix) et enfoncés dans les murs extérieurs. Deux objets
  d'une case, posés en série, tournés (0 le long de x, 1 le long de z), repeints : « Mur fin »
  (`thin-wall`, 150 €, mi-hauteur, +0,05 % de productivité) et « Mur fin vitré »
  (`glass-partition`, 450 €, verre du sol au plafond, léger +moral), 80 au plus chacun. Champ
  `partition: 'solid' | 'glass'` du catalogue ; dessinés avec les cloisons, boîte invisible pour
  la sélection. Ils bloquent le passage ; un mur qui enfermerait une zone est refusé (erreur
  `blocksPath` dans `view/placement.ts`). Vitres des salles de réunion raccordées pareil. Aucun
  tirage, ni commande, ni champ d'état.

- Vidéoprojecteur et écrans déroulants (`shared/sim/projection.ts`, `client/src/simulation/projection.ts`,
  rayon « 📽️ Périphériques » du mode construction) : vidéoprojecteur (`projector`, 700 €, accessoire
  posé sur un meuble, bouton « ⏻ Allumer / Éteindre ») et 3 écrans de projection posés au sol
  (petit 2 cases 450 €, moyen 3 cases 1 100 € en Seed, grand 4 cases 2 400 € en Série A). Allumé et
  tourné vers un écran (cône de 50°, 1,5 à 10 cases, devant la toile), il déroule la toile, puis
  l'image s'allume (faisceau, diaporama) ; éteint, l'image s'éteint et la toile s'enroule ; la toile
  reste toute blanche, sans cadre noir (`FABRIC_WHITE`). Un écran par projecteur, le plus proche,
  projecteurs servis dans l'ordre d'achat (`projectionPairs`, même calcul pour la simulation et le
  rendu). Effets seulement pendant la projection : écran +qualité,
  +hype (+moral moyen et grand), projecteur +moral et -0,4 % de productivité. Commande
  `SWITCH_PROJECTOR`, champ `on` optionnel (absent = éteint), `GameView.projections`, rendu animé
  dans `render/projection.ts` (sans animation si « réduire les animations »). Aucun tirage.
  Projecteur de plafond (`ceiling-projector`, 1 300 €, 3 au plus) : accroché au-dessus d'une case,
  même d'un bureau, il vise depuis sa case avec les mêmes effets. Drapeau `ceiling` du catalogue :
  les objets du plafond ne se chevauchent qu'entre eux, jamais au-dessus d'un mur vitré, et ne
  bloquent pas le pathfinding (`ai/grid.ts`). Modèle `ceilingProjector` (`lensOf` pour le faisceau).

- Bruits de bureau (`client/src/audio/deskSounds.ts`, option `onDeskActivity` de `GameRenderer`,
  branché dans `ui/game/Scene.tsx`) : un dev en pose « travail » à un bureau à écran (même règle
  que l'écran allumé, `screenMountOf` : écran choisi ou portable du garage) s'entend en zoomant
  (plus petit côté de la vue de 8,5 à 5,5 unités, `closeness`) : clavier et souris à la même
  distance, même poids dans `deskMix`, plus forts au centre, baisse linéaire jusqu'à 1,6 fois le
  plus petit côté de la vue, placés à gauche ou à droite (6 devs au plus) ; silence en vue
  d'ensemble.
  Frappes tirées de l'enregistrement fourni par Melvin (`public/assets/sounds/clavier-1-mrboubou13al.mp3`,
  précaché), découpé au chargement en 54 frappes (`sliceKeystrokes`) et joué bien plus bas que
  l'original ; frappes synthétisées en secours. Clic de souris synthétisé en Web Audio. Rythme
  `TypingRhythm` (rafales, relectures), `Math.random` seulement : le RNG du jeu n'est pas touché.
  Muet en pause, pendant une carte d'événement, la nuit ; volume « Ambiance » des options.

- Écrans des postes (`shared/sim/monitors.ts`, `render/monitors.ts`, rayon « 🖥️ Écrans » du mode
  construction, `ui/build/MonitorShop.tsx`, bouton « 🖥️ Écran » de l'objet sélectionné) : l'écran
  ne fait plus partie du bureau. 5 modèles (bureautique livré avec le bureau, pivoté vertical,
  gaming 165 Hz, pro ultra-fin et incurvé ultra-large en Seed), 3 tailles chacun (24, 27, 32 pouces ;
  34, 38, 45 pour l'incurvé, de 120 à 1 300 €), sur son pied ou sur un bras articulé (+150 €, -5 % de
  fatigue au poste). Effets au poste : productivité (0 à +5 %), et selon le modèle -dette, +moral ou
  +qualité ; ils s'ajoutent à ceux de l'ordinateur. Installation sur le bureau sélectionné ou sur
  tous les postes d'un coup ; l'ancien écran est repris à moitié prix, l'écran suit le bureau
  (inventaire, revente). Écran allumé du dev posé sur la dalle choisie (`screenMountOf`, dalle
  courbe pour l'incurvé). Gabarit `@monitor:<bureau>:<modèle>:<taille>:<fixation>` dans
  `render/office.ts`, vignettes 3D sans redessin au changement de taille. Commande `SET_MONITOR`,
  champ `monitor` optionnel (absent = écran bureautique 27 pouces sur pied), aucun tirage.

- Décor des annexes déplaçable (`shared/sim/annexDecor.ts`) : bornes d'arcade, flipper, enseigne
  néon, arbres, banc, fontaine, plante, enceintes, scène, pupitre et écran des annexes sont des
  objets posés (`annex:<clé>` dans `GameView.items`, champ `annexDecor`) : clic, « Tourner » et
  « Déplacer » comme le mobilier ; offerts, ils n'ont pas d'effet et ne se vendent, ne se rangent
  ni ne se repeignent. Pas d'entité ni de tirage : seuls les déplacements sont gardés (commande
  `MOVE_ANNEX_DECOR`, état `annexDecor` vide par défaut). 9 objets en boutique avec effet : borne
  d'arcade, flipper, petite scène, pupitre, écran géant d'auditorium (Détente), enseigne néon,
  arbre d'intérieur, fontaine zen (Déco), banc (Confort) ; le décor offert ne compte pas dans le
  maximum.

- Sols (`shared/sim/floors.ts`, `client/src/simulation/floors.ts`, rayon « 🟫 Sols » du mode
  construction, `ui/build/FloorShop.tsx`) : 8 matières sobres (vinyle 300 €, moquette en dalles,
  béton ciré, carrelage grand format en Seed, parquet en lames, parquet en chevrons en Seed,
  terrazzo en Série A, marbre poli 7 000 € en Licorne) et 12 teintes (neutres, essences de bois),
  posées pièce par pièce (`FLOOR_ZONES` : open space, cuisine, réunion, détente, cantine, ailes,
  annexes) ou « Toutes les pièces », sans remboursement de l'ancien sol ; +moral par pièce, et
  +qualité ou +hype selon la matière. Motifs dessinés sur canvas (`view/floors.ts`), une dalle
  texturée par pièce qui rejoint la voisine sous la cloison (`render/floorFinishes.ts`). Commande
  `COVER_FLOOR`, état `floors` (vide par défaut = sol d'origine, le même partout), aucun tirage.

- Le plan cède la place aux meubles posés : quand le bureau grandit (nouvelle phase, aile de
  filiale), une cloison du plan qui tomberait sur un meuble s'efface (`yieldToItems` dans
  `view/layout.ts`, appliqué par `layoutOf`), et le décor offert des annexes que le joueur n'a
  pas déplacé évite le mobilier : il se décale vers la case libre la plus proche contre la
  cloison du fond, ou disparaît s'il n'y en a aucune (`settleFixtures`, appelé par
  `annexDecorViews` dans `view/adapter.ts`). Plus de banc dans un mur vitré. Aucun tirage, ni
  commande, ni champ d'état.

- Salle des serveurs et fibre (`shared/sim/serverRoom.ts`, `client/src/simulation/serverRoom.ts`,
  rayon « 🗄️ Serveurs » du mode construction, panneau « 🗄️ Serveurs », `ui/servers/ServerRoom.tsx`) :
  local serveur 2 x 2 (4 000 €, Seed, 4 emplacements) et salle des serveurs vitrée 4 x 3
  (12 000 €, Série A, 8 emplacements), 1 de chaque au plus. 10 équipements au choix posés dedans
  comme des accessoires (`serverGear`, erreur `noServerRoom` ailleurs ; une salle n'accueille que
  ça) : serveurs rack, lames (Série A) et GPU (Série A), switch, box fibre, climatisation de
  précision, onduleur, NAS de sauvegarde, pare-feu, extinction au gaz (Série A). Une salle tourne
  seulement avec un serveur, du réseau et du froid (sinon elle surchauffe, sans effet) : -6 à -12 %
  d'hébergement par serveur (`hostingSaving`, 40 % au plus, `hostingCost` dans `economy.ts`),
  +stabilité, et selon le matériel +productivité, +hype ou -dette. Abonnement fibre payé chaque
  semaine (`FIBRE_PLANS` : Essentielle 400 €, Pro 900 €, Dédiée 2 500 € en Série A ; +1 à +3 % de
  productivité, +stabilité par jour), première semaine payée à la souscription, box fibre posée
  dans une salle obligatoire ; trésorerie insuffisante à l'échéance : ligne coupée (`FIBRE_CUT`).
  Changement d'offre et résiliation sans remboursement, coût compté dans la trésorerie en mois.
  Commandes `SUBSCRIBE_FIBRE` / `CANCEL_FIBRE`, état `fibre` (null par défaut), `fibreSystem` en
  dernier système, rendu `render/serverRoom.ts` (12 formes des assets manquants). Aucun tirage.

- Difficulté des modes (`shared/sim/difficulty.ts`, `difficultyOf(mode)`) : un profil de
  multiplicateurs par mode remplace `BALANCE.easy`. Facile : 2,2 M€ au départ, effets négatifs des
  cartes -15 %, autant de cartes qu'en Normal. Hardcore : 1,5 M€, dépenses +15 %, revenus -15 %,
  4 cartes au plus par sprint (tirage x1,5), effets négatifs +30 %, pannes +50 %, barre des
  investisseurs +0,3 (`pitchBar` dans `simulation/fundraising.ts`). Normal, Daily, Stagiaires Only
  et 3 sprints au profil neutre : mêmes parties qu'avant. Rapport `pnpm balance` : section
  « Difficulté par mode et par stratégie », 700 parties par autre mode. Faillite Hardcore 32 %
  (bons bots 7 à 20 %, licorne 2 à 4 %) ; Facile proche du Normal, un peu plus indulgent. Les
  replays des anciens scores Facile et Hardcore ne rejouent plus à l'identique.

- Mode illimité (`ENDLESS`, `shared/sim/endless.ts`) : pas de fin au 39e sprint, la partie dure tant
  que la trésorerie tient (IPO et rachat toujours possibles). Après 18 mois, la concurrence monte à
  chaque sprint : frais fixes x(1 + 4 % p + 0,4 % p²) (`fixedCosts` dans `economy.ts`), churn
  +0,004 % par jour et par sprint, levées divisées par (1 + 5 % p) (`maxRaise`), message
  `COMPETITION_RISES` tous les 13 sprints. 18 premiers mois identiques au Normal (même graine), aucun
  tirage en plus. `totalSprints` = 9999 (`ENDLESS.sprintCap`), HUD « Sprint n » sans total, phrase de
  fin avec les sprints tenus, 3 succès (2, 3, 5 ans), 2 étapes du tutoriel. Bots : ils ne vendent pas
  en illimité et tiennent de 76 à 300 sprints. Serveur : valeur `ENDLESS` de l'enum (migration
  `20261017150000_endless_mode`), classement par sprints tenus puis valorisation.
- Classement des meilleures entreprises (`ui/meta/Leaderboard.tsx`) au menu et en jeu (🏆 dans les
  boutons système, panneau `leaderboard`, sans replay en jeu) : « En ligne » ou « Sur cet appareil »
  (`save/localScores.ts`, 50 parties gardées par mode, invité et sans serveur ; ouvert par défaut
  quand le serveur ne répond pas). Nom d'entreprise tiré de la graine (`companyName` dans
  `shared/meta/company.ts`, hachage, sans tirage), champ `company` du `ScoreDto`, aussi sur l'écran
  de fin et l'image partagée. Ordre commun `compareGames` (`shared/meta/leaderboard.ts`) ; le global
  exclut Facile et Illimité (`GLOBAL_EXCLUDED_MODES`).
- Mode Histoire (`shared/story/`, `client/src/simulation/story.ts`, `ui/story/`, carte « Histoire »
  du menu) : 4 chapitres (Garage, Seed, Série A, Licorne) et 10 missions débloquées l'une après
  l'autre, chacune avec point de départ (phase, caisse, jauges, équipe), objectifs, contraintes et
  durée (3 à 12 sprints) ; panneau « 🎯 Mission » en jeu, objectifs en direct, écran de fin
  (suivante, réessayer, partager), titre de fondateur par chapitre. Mission terminée en « zombie »
  avec `result.mission` (réussie, ou ratée : contrainte, temps, faillite, vente) ; ni classement
  ni succès de fin. Chaque mission débloque une récompense nouvelle pour Facile, Normal et les
  défis, jamais le Daily (`UNLOCK_MODES`) : papiers peints « Plans du garage » et « Mur de
  post-it », sols « Dalles techniques » et « Damier rétro », couleurs Or et Néon, statue de licorne
  et cloche de la Bourse (formes Three.js, `render/storyRewards.ts`), bonus expresso dès le garage
  et carnet d'adresses (+10 hype). Récompenses fixées au départ (`state.unlocks`, vide par défaut),
  champ `unlock` du catalogue, erreur `LOCKED`. Progression sur l'appareil (`save/story.ts`) puis
  sur le compte : `GET /api/story`, `POST /api/story/complete` rejoue la mission (table
  `StoryMission`) ; `POST /api/scores` vérifie et rejoue les récompenses (`Score.unlocks`,
  `UNLOCK_NOT_EARNED`). Champs `story` (null) et `unlocks` ([]) par défaut, aucun tirage de plus.
  Calibrage par les bots : `pnpm balance:story` (chapitre 1 facile, chapitres 3 et 4 difficiles).
- Histoire en 5 actes, socle (T2, PR 1 sur 4 ; `shared/story/acts.ts`, `client/src/simulation/story.ts`,
  `ui/story/CampaignPanel.tsx`) : « Ctrl+Alt+Fonder », une seule longue partie de 60 sprints
  (`STORY_TOTAL_SPRINTS`), lancée par `mission: 'campaign'` (`StoryStart`). 5 actes : Le garage
  (Seed avant le sprint 12), La course (Série A avant le 26), La guerre des prix (Licorne avant le
  44), Le géant (1,5 Md€ avant le 52), La cloche (Bourse ou rachat). Objectif principal rempli :
  acte suivant aussitôt (notification `STORY_ACT`, panneau ouvert) ; date limite dépassée à la
  démo, histoire arrêtée (`result.campaign`, échec `TIME`, `BANKRUPTCY` ou `SOLD` si vendue avant
  « Le géant »). Les 10 missions sont les objectifs secondaires des actes, avec leurs contraintes et
  leurs récompenses ; statistiques comptées depuis le début de l'acte (`statsAtAct`), notification
  `STORY_GOAL`. Chaque objectif rempli part à `POST /api/story/complete` avec `campaign: true` : le
  serveur rejoue l'histoire jusqu'à la dernière commande (`verifyCampaignGoal`). Point de
  sauvegarde par acte sur l'appareil (`storyCheckpoints`, `resumeAct`), repris depuis l'écran
  Histoire ou l'écran de fin. Écran Histoire en 2 onglets : « Histoire » (synopsis, frise et cartes
  des actes) et « Missions » (les 10 missions courtes, gardées jouables : choix de Thomas). Champ
  `story.campaign` optionnel (`missionId` devient optionnel), aucun tirage : les autres modes ne
  changent pas. Calibrage : `pnpm balance:campaign`. À venir : équilibrage (PR 4).
- Rivaux de l'histoire en actes (T2, PR 2 sur 4 ; `shared/sim/rivals.ts`,
  `client/src/simulation/rivals.ts`, panneau « 📈 Marché » `ui/story/MarketPanel.tsx`) : 3 startups
  inventées simulées à chaque démo de la longue partie, sur la graine à part `seed#rival#sprint`.
  Synergix (Bastien Lemaître) dès le prologue, accélère quand le joueur le dépasse (copie, débauche,
  procès) ; Pivotly à la guerre des prix (pivote tous les 2 sprints, casse les prix) ; Gigacorp au
  « Géant », rachète Synergix (clone, pubs, débauche). Croissance logistique, faillite d'un rival
  qui chute sous 50 000 utilisateurs et 30 % de son record. Part de marché : la part des rivaux
  ajoute des départs quotidiens d'utilisateurs (`rivalExtraChurn`). Objectifs `rivalUsers` (La
  course : dépasser Synergix) et `marketShare` (Le géant : 30 % du marché). Panneau Marché : courbes
  des utilisateurs, parts, dernière action ; notifications `RIVAL_ACTION`. Enseignes lumineuses des
  rivaux sur des toits de la ville (`render/rivalTowers.ts`, `rivalTowerSpots` dans `skyline.ts`),
  plus larges avec la part de marché, éclairées la nuit, éteintes à la faillite. État
  `campaign.rivals` et `campaign.usersHistory` (vides par défaut). Hors de l'histoire en actes,
  rien ne change.
- Histoire écrite, fins et Saison libre (T2, PR 3 sur 4 ; `shared/story/scenes.ts`,
  `shared/story/cards.ts`, `ui/story/StoryScene.tsx`, `events/storyCards.ts`) : scènes dialoguées
  (Bastien Lemaître, Mamie Josette, Inès Kader de TechMatin, Hugo l'ami dev, Gigacorp) au lancement,
  au début de chaque acte et à l'entrée en Bourse ; temps arrêté pendant la scène, « Suivant »,
  « Passer », guide masqué, puis objectifs de l'acte. 10 cartes d'histoire hors base et hors tirage
  (poids 0), deux par acte, imposées le mardi 10h d'un sprint fixé de l'acte
  (`STORY_CARD_SCHEDULE`, sans tirage) ; `CardLibrary` les retrouve toujours par identifiant. Effet
  de carte `rivals` (utilisateurs des rivaux en %, optionnel). Slack : SMS de Mamie Josette et
  articles d'Inès Kader sur `STORY_ACT`, `STORY_GOAL`, `STORY_END` et `RIVAL_ACTION`. Deux fins
  écrites : rachat par Gigacorp (fin de partie) ou entrée en Bourse à partir du « Géant », qui
  ouvre la Saison libre (`campaign.freeSeason`, notification `STORY_END`) : plus de date limite,
  pression du mode illimité à partir du sprint de l'entrée en Bourse (`freeSeasonStart`, 3e
  argument des fonctions de `endless.ts`), une nouvelle startup tous les 10 sprints (Quantik,
  Hyperlane, Blitzly), commande `END_STORY` pour finir sur l'entrée en Bourse
  (`result.campaign.freeSeasonSprints`). Écran de fin : scène de la fin, bilan face aux rivaux.
  Aucun tirage sur le RNG de la partie ; hors de l'histoire en actes, rien ne change.
- Mode Carrière (`shared/sim/career.ts`, `client/src/simulation/career.ts`, page « Carrière » du
  menu `ui/career/CareerPage.tsx`, panneau `ui/career/CareerPanel.tsx`) : refaire le parcours de
  8 startups devenues géantes, jamais nommées (Pépin Computer, Matelas & Céréales, Rembobine,
  MicroMou, Trombinoscope, Orénoque, Centillion, Ampère Motors), 3 niveaux de difficulté. Chaque
  légende fixe le départ (trésorerie, hype, dette, profil du premier dev, cofondateur) et 4 jalons
  (phase, utilisateurs, valorisation, levées, features, équipe, stabilité, hype, part du capital
  avant un sprint ou à la fin, dette maximale, issue). Jalons vérifiés à chaque démo, puis jugés à
  la fin : ★ un jalon, ★★ la moitié, ★★★ tous, ajouté à la phrase partageable
  (`GameResult.career`). Légende écrite dans la graine (`career:<légende>:<graine>`), aucun tirage :
  replays, sauvegardes et anti-triche inchangés. Mode `CAREER` (migration Prisma), état `career`
  (null par défaut), notifications `CAREER_MILESTONE` / `CAREER_MISSED`, bouton 🧭 du HUD, chapitre
  du tutoriel, meilleur résultat par légende sur l'appareil (`oss.career.best`), 2 succès
  (`career-first-star`, `career-legend`), section « Mode Carrière » de `pnpm balance`.

- Base de production sur Supabase (projet `open-space-simulator`, offre gratuite,
  `eu-central-1`) : simple PostgreSQL hébergé derrière Prisma, sans auth ni SDK Supabase. Toutes
  les migrations y sont appliquées et notées dans `_prisma_migrations`. Migration
  `row_level_security` : RLS sur toutes les tables, sans politique, pour que l'API REST publique
  de Supabase ne lise rien (le serveur, propriétaire des tables, n'est pas concerné) ; toute
  nouvelle table l'active aussi (`tests/rls.test.ts`). `DATABASE_URL` = URL du _Session pooler_
  (5432, IPv4) + `?sslmode=require` ; `createPrismaClient` ajoute `uselibpqcompat=true` pour que
  `pg` accepte le certificat de Supabase (`withLibpqSslMode`, `src/lib/prisma.ts`). `render.yaml`
  ne crée plus de base Render. En local, docker compose ne change pas.

- Daily et appli de tickets « Kanbanana » (`shared/sim/meetings.ts` : `DAILY_SYNC`,
  `MorningSyncSchema` ; `client/src/simulation/meetings.ts`, `view/ticketBoard.ts`,
  `render/dailyBoard.ts`, `ui/meetings/TicketApp.tsx`, `ui/meetings/DailyMoment.tsx`) : le Daily
  de 9h fait le point sur les tickets, chaque participant note l'avancement du sien (hier,
  aujourd'hui). Daily utile : +5 % de productivité aux participants jusqu'au soir. Sans Daily ce
  matin-là, ou pour les absents, dès la Seed : travail en double à 10h, une partie d'un ticket
  est à refaire (graine à part `seed#duplicate#tick`, stat `duplicateWork`, notification
  `DUPLICATE_WORK`). Dans la salle, écran déroulant et projecteur de plafond affichent Kanbanana
  (nom et logo inventés) : colonnes, clés OSS-42, type, points, avatars, point de chacun ; panneau
  « 📽️ » en grand, lecture seule. Le temps s'arrête 6 s au début du Daily (option « Pause pendant
  le Daily », active par défaut, jamais en Hardcore ni en replay). État `morningSync` (null par
  défaut). `pnpm balance` : aménager la salle rapporte plus (bot organizer 352 → 434 M€ médians).
- Placement à la demi-case (`GridPositionSchema` dans `shared/sim/components.ts`, `view/partitions.ts`) :
  tous les objets se posent et se déplacent d'une demi-case (souris, doigt, flèches du clavier) ;
  la demi-case libre de part et d'autre d'un mur fin (cloison du plan ou mur posé) se meuble tant
  que l'objet ne traverse pas le trait du mur, et un objet de 3 cases se centre dans une pièce de 4.
  Murs fins et fenêtres restent sur des cases entières. La grille de navigation bloque chaque case
  chevauchée ; chaise et dev assis au point exact devant un bureau décalé (`accessPoint`). Positions
  entières toujours valides : anciennes sauvegardes, replays, Daily et scores inchangés, aucun tirage.

- Internet et clim de la salle des serveurs (`shared/sim/serverRoom.ts`, `shared/sim/subscriptions.ts`,
  `client/src/simulation/serverRoom.ts`), remplace les 3 offres fibre ci-dessus : 6 offres du
  service `internet` des abonnements (`FIBRE_PLANS` : box 4G 39 €/mois 3 salariés, box 5G 59 € 6,
  Fibre Pro 49 € 10, Fibre Pro+ 119 € 25 en Seed, fibre dédiée 1 Gb/s 890 € 60 en Série A, 10 Gb/s
  2 600 € 200 en Licorne), prix mensuels HT prélevés chaque semaine (`weeklyPrice`), mise en
  service payée à la souscription (`setupFee`, `firstPayment`), box fibre exigée seulement pour la
  fibre dédiée. Salariés connectés = toute l'équipe (`serviceUsers`) ; au-delà de `maxUsers`,
  réseau saturé : plus d'effet et jusqu'à -12 % de productivité (`saturationPenalty`), alertes
  `INTERNET_SATURATED` / `INTERNET_OK`, champ `saturated` optionnel. Chaleur et froid en kW (`heat`,
  `cooling` du catalogue) : climatiseur mural 5 kW (Seed), clim de précision 15 kW, clim en rangée
  35 kW (Série A), sonde de supervision (Seed). Température 18 + 10 x chaleur / froid (+3 °C de
  juin à août) : au-delà de 27 °C la moitié des effets (75 % avec sonde), au-delà de 32 °C plus
  rien et -stabilité ; la sonde affiche la température et prévient quand le niveau change
  (`serverHeatSystem`, état `serverHeat` vide par défaut). Aucun tirage.

- Arbre de compétences des devs (`shared/sim/skills.ts`, `client/src/simulation/skills.ts`, onglet
  « Compétences » de la fiche, `ui/team/SkillTree.tsx`) : 1 point par niveau, 3 branches de 5 nœuds
  qui demandent chacun le précédent (Technique : code propre -10 % de dette, débogueur, architecte,
  revue de code -5 % de dette des features de l'équipe, gardien de la prod x2 sur « Réparer la
  prod » ; Vitesse : raccourcis +5 %, concentration, deep work le matin, fin de sprint, Crunch
  +50 % pendant 24 h et -10 moral une fois par sprint ; Humain : endurance -15 % de fatigue,
  diplomate, mentor +20 % d'XP aux collègues, bonne humeur, leader : plus de démission à moral 0).
  Un nœud de métier par profil qui code (demande le 3e nœud de sa branche) ; l'encadrement n'a pas
  d'arbre. Formations en planification (livre 500 €, formation 2 000 €, conférence 5 000 €, une
  par dev et par sprint, niveaux gagnés sans tirer de statistique), réinitialisation pour un mois
  de salaire. Ouvert partout sauf en Daily (`skillsEnabled`). Commandes `LEARN_SKILL`,
  `RESET_SKILLS`, `TRAIN_DEV`, `USE_CRUNCH`, composant ECS `skills` (vide par défaut), stats
  `skillsLearned`, `trainings`, `crunches`. Aucun tirage : sans compétence, chaque multiplicateur
  vaut 1 (48 parties de 4 modes comparées à `develop`, état identique) ; une compétence qui change
  une probabilité garde le même tirage. Bot « coach » dans `pnpm balance`.

- Saleté et ménage (`shared/sim/cleaning.ts`, `client/src/simulation/cleaning.ts`, bouton 🧹 en
  haut, panneau « Ménage », `ui/cleaning/Cleaning.tsx`) : chaque jour de semaine, l'équipe présente
  salit le bureau (0 à 100 %, de plus en plus vite sans ménage, chats compris) ; un dev sur place
  perd jusqu'à 40 % de travail (-20 % à 50 %, `dirtProductivity`), pas les télétravailleurs, le Dev
  Fantôme ni l'IA Agent ; alerte à 50 %. Entreprise de nettoyage Nickel Chrome (Fatou, Jean-Marc,
  Lucía) : appel le soir à 19h ou en express (`CALL_CLEANING`, payé à la réservation), ou
  abonnement « Ménage » du modèle commun (service `cleaning`, 3 offres de 1 à 5 soirs par semaine).
  Prix selon la phase et les ailes ou annexes (`PRICE_RULES` dans `simulation/subscriptions.ts`).
  Déchets en InstancedMesh placés par hachage de la graine et 3 agents animés en A*
  (`render/cleaning.ts`, formes des assets manquants). État `cleaning` par défaut, aucun tirage ;
  règle qui change toutes les parties (anciens replays de scores divergent).

- Hall d'entrée (`shared/sim/lobby.ts`, `client/src/simulation/lobby.ts`, rayon « 🛎️ Accueil » du
  mode construction, panneau « Hall d'entrée », `ui/lobby/Lobby.tsx`) : dès la Seed, 18 000 €
  pour un hall au rez-de-chaussée devant toutes les pièces (pièce `lobby`, `LobbyPlan` dans
  `view/layout.ts`), cloison percée de deux portes à badge (portillons qui s'ouvrent au passage),
  entrée du bureau par le hall ; comptoir d'accueil, banquette et deux plantes offerts et
  déplaçables (clés `L-0` à `L-3`), comptoir aussi en vente (2 500 €). Jusqu'à 2 secrétaires
  (3 100 € par mois, +1 % de productivité, +moral, +hype), au comptoir en semaine de 8h à 19h.
  Sécurité en abonnement du modèle commun (service `security`, installation `lobby`) :
  télésurveillance (95 €/mois), agent en journée (5 600 €, visible de 8h à 20h), gardiennage
  24 h/24 (16 500 €, Série A), payés chaque semaine. Rendu `render/lobby.ts` et
  `render/lobbyFurniture.ts` (formes `receptionDesk` et `badgeGates` des assets manquants).
  Commandes `BUILD_LOBBY` / `SET_RECEPTIONISTS`, état `lobby` (null par défaut), aucun tirage.

Reste à faire :
- Connexion GitHub : créer l'application GitHub OAuth (callback
  `https://open-space-simulator.vercel.app/api/auth/github/callback`) et mettre ses clés sur
  Render (étapes dans le README, section Déploiement). Le jeu avec comptes est en ligne sur
  https://open-space-simulator.vercel.app (serveur Render `https://oss-server-e90i.onrender.com`,
  base Supabase) ; la version invité reste sur https://7h0mas92.github.io/Open_Space_Simulator/.
  Les deux se redéploient à chaque fusion.
- Effets sonores et ambiance : le lecteur Howler est prêt (`audio/manifest.ts`), les fichiers
  restent à déposer (les bruits de clavier et de souris sont faits).

Développement local : `pnpm db:up`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm dev` (jeu sur
localhost:5173, API et Swagger sur localhost:3000/docs). Base : `pnpm --filter @oss/server
db:studio` (Prisma Studio sur localhost:5555) ou `docker compose exec db psql -U oss -d oss`. Production :
tableau de bord Supabase (Table Editor, SQL Editor).
Compte admin de développement créé par le seed : `admin@oss.local` / `admin-dev-password`.
