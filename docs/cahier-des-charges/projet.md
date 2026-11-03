# Cahier des charges : projet, stack et architecture

> Extrait du cahier des charges d'origine (anciennement dans `CLAUDE.md`). Index : [`CLAUDE.md`](../../CLAUDE.md).

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
