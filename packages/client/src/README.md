# Client : organisation de `src/`

| Dossier       | Rôle                                                                             | Étape |
| ------------- | -------------------------------------------------------------------------------- | ----- |
| `api/`        | Client HTTP typé (réponses validées par les schémas Zod de `@oss/shared`)        | 1 ✅  |
| `i18n/`       | Traductions `fr.json` / `en.json` (i18next)                                      | 1 ✅  |
| `view/`       | Modèle de vue lu par le rendu et l'UI, catalogue, plans de bureau, fausse partie | 2 ✅  |
| `ai/`         | A* sur grille, behavior trees, bulles de pensée (IA visuelle, déterministe)      | 2 ✅  |
| `render/`     | Scène Three.js : lit des instantanés, interpole, ne modifie jamais l'état        | 2 ✅  |
| `ui/`         | React + Zustand : menus, HUD, Kanban, équipe, construction, options, tutoriel    | 2 ✅  |
| `simulation/` | ECS en TypeScript pur, déterministe (aucune dépendance au DOM)                   | 3     |
| `engine/`     | Horloge, vitesses, pont avec le Web Worker                                       | 3     |
| `events/`     | Moteur de cartes d'événements                                                    | 6     |
| `save/`       | Synchronisation serveur + cache IndexedDB hors ligne                             | 8     |
| `audio/`      | Howler.js : musique, effets, ambiance                                            | 11    |

Règles :

- `simulation/` et `events/` n'importent jamais `three`, `react` ni le DOM.
- `render/` et `ui/` ne lisent que des `GameView` (voir `view/types.ts`) et n'envoient que des
  `GameCommand`. `view/mock.ts` disparaîtra quand la simulation sera branchée.
