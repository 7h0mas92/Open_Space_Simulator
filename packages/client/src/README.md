# Client : organisation de `src/`

| Dossier       | Rôle                                                                          | Étape |
| ------------- | ----------------------------------------------------------------------------- | ----- |
| `api/`        | Client HTTP typé (réponses validées par les schémas Zod de `@oss/shared`)     | 1 ✅  |
| `i18n/`       | Traductions `fr.json` / `en.json` (i18next)                                   | 1 ✅  |
| `simulation/` | ECS en TypeScript pur, déterministe ([mode d’emploi](simulation/README.md))   | 3 ✅  |
| `engine/`     | Horloge, vitesses, pont avec le Web Worker                                    | 3 ✅  |
| `events/`     | Moteur de cartes d’événements et 100 cartes                                   | 3 ✅  |
| `view/`       | Modèle de vue lu par le rendu et l'UI, catalogue, plans de bureau, adaptateur | 3 ✅  |
| `ai/`         | A* sur grille, behavior trees, bulles de pensée (IA visuelle, déterministe)   | 3 ✅  |
| `render/`     | Scène Three.js : lit des instantanés, interpole, ne modifie jamais l'état     | 3 ✅  |
| `ui/`         | React + Zustand : menus, HUD, Kanban, équipe, construction, options, tutoriel | 3 ✅  |
| `save/`       | Sauvegardes, succès et cartes : IndexedDB hors ligne + synchronisation        | 4 ✅  |
| `slack/`      | Slack simulé : 256 templates, mode IA via le serveur, repli automatique       | 4 ✅  |
| `audio/`      | Howler.js : musique, effets, ambiance (en attente des packs sons Kenney)      | 4 ✅  |

Règles :

- `simulation/` et `events/` n'importent jamais `three`, `react` ni le DOM.
- `render/` et `ui/` ne lisent que des `GameView` (voir `view/types.ts`) et n'envoient que des
  `GameCommand`. `view/adapter.ts` fait la traduction avec l'état et les commandes de la
  simulation ; `view/source.ts` la relie au moteur (Web Worker).
