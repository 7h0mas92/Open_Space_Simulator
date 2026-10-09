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

# ÉTAT D'AVANCEMENT (mis à jour le 9 octobre 2026)
Les 12 étapes sont livrées et fusionnées dans `main`. Ajouts validés depuis, à conserver :
- Mode Facile et tutoriel adapté à chaque mode ; zoom trackpad progressif ; défilement de la
  caméra au bord de l'écran.
- Mode construction refondu : catalogue en bas, aperçu sur la grille, bouton « Poser » au
  tactile, rendu 3D distinct pour chacun des 22 objets.
- 65 succès avec difficultés, dont 22 secrets (nom visible, condition « ??? »).
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
  (`render/decorations.ts`, `view/decor.ts`), réglées dans l'onglet « Décorations » du
  back-office : désactivé, en saison (défaut) ou toujours ; table `DecorTheme`.
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
- Accessoires de bureau et inventaire : casque antibruit (`desk-headset`, protège 1 dev des
  réunions) et mini-cactus (`mini-cactus`) posés sur les bureaux, 3 emplacements par bureau ; le
  portant au sol et le cactus au sol restent (« Portant de casques antibruit », « Cactus en pot »).
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
- Levées de fonds (`shared/sim/pitch.ts`, `shared/sim/funding.ts`, panneau « Lever des fonds ») :
  6 tours de plus en plus durs (Seed à pré-IPO : 3 à 5 questions, 3 à 4 réponses, barre plus
  haute, bluffs démasqués plus souvent, gros fonds, départ de l'investisseur dès la Série B) ;
  question par manche, réponse hors sujet pénalisée, jauge d'intérêt et réactions. Business
  angels, prêt bancaire, financement participatif, subvention (`TAKE_FINANCING`, état
  `financing`, sans hasard). Questions et bluffs sur une graine à part. Bot « financier ».
- Annexes du bureau : dès la Série B, chaque tour réussi ouvre une annexe pleine largeur (arcade,
  jardin, auditorium) avec décor fixe (`render/annexDecor.ts`) et +2 places ; sols des pièces
  variés selon la graine (`view/layout.ts`, `FLOOR_STYLES`).
- Vue sur New York (`render/skyline.ts`) : le bureau est au dernier étage d'une tour, dans une ville low-poly façon
  Manhattan en formes Three.js (tours à gradins, réservoirs d'eau, parc, fleuve, taxis), sans
  bâtiment réel. Graine fixe, sans le RNG du jeu ; aucun toit proche ne cache la salle
  (`maxTop`) ; brume, fenêtres, lampadaires et balises qui suivent le jour et la nuit.
  Qualité basse par défaut quand WebGL tourne sans carte graphique (SwiftShader, llvmpipe).
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
  à 9h30, utile ou inutile, sur une graine à part (`seed#meeting#tick`) ; changer ou vider la
  salle rend 50 %. Commandes `FIT_MEETING_ROOM` / `CLEAR_MEETING_ROOM`, état `meetingRoom` (null
  par défaut). Bot « organizer » : environ +33 % de valorisation médiane face à « balanced ».
  À 375 px, les 8 boutons du dock tiennent sans défilement (libellé court « Réunion »).
- « Continuer » ne propose plus une partie terminée : à la fin, sa sauvegarde automatique est
  effacée (appareil et serveur) et sa date de fin notée ; ses sauvegardes manuelles restent dans
  « Charger une partie » (`saves.markFinished`, `saves.latestResumable` dans
  `client/src/save/saves.ts`). Un Daily rejoué reste proposé.
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

Reste à faire :
- Comptes en ligne : déployer le serveur sur Render (`render.yaml`) et créer l'application
  GitHub OAuth (étapes dans le README, section Déploiement). Le jeu invité est en ligne sur
  https://7h0mas92.github.io/Open_Space_Simulator/ et se redéploie à chaque fusion.
- Effets sonores et ambiance : le lecteur Howler est prêt (`audio/manifest.ts`), les fichiers
  restent à déposer.

Développement local : `pnpm db:up`, `pnpm db:migrate`, `pnpm db:seed`, `pnpm dev` (jeu sur
localhost:5173, API et Swagger sur localhost:3000/docs). Base : `pnpm --filter @oss/server
db:studio` (Prisma Studio sur localhost:5555) ou `docker compose exec db psql -U oss -d oss`.
Compte admin de développement créé par le seed : `admin@oss.local` / `admin-dev-password`.
