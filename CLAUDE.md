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
- créer, modifier et désactiver les cartes d'événements, avec prévisualisation ;
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