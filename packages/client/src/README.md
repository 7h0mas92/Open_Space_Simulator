# Client : organisation de `src/`

| Dossier       | Rôle                                                                        | Étape |
| ------------- | --------------------------------------------------------------------------- | ----- |
| `api/`        | Client HTTP typé (réponses validées par les schémas Zod de `@oss/shared`)   | 1 ✅  |
| `i18n/`       | Traductions `fr.json` / `en.json` (i18next)                                 | 1 ✅  |
| `ui/`         | React + Zustand : menus, HUD, panneaux                                      | 1 → 5 |
| `render/`     | Scène Three.js : lit des snapshots d'état, ne modifie jamais l'état         | 2     |
| `simulation/` | ECS en TypeScript pur, déterministe ([mode d’emploi](simulation/README.md)) | 3 ✅  |
| `engine/`     | Horloge, vitesses, pont avec le Web Worker                                  | 3 ✅  |
| `ai/`         | A* sur grille, behavior trees des personnages                               | 4     |
| `events/`     | Moteur de cartes d’événements et 100 cartes                                 | 3 ✅  |
| `save/`       | Synchronisation serveur + cache IndexedDB hors ligne                        | 8     |
| `audio/`      | Howler.js : musique, effets, ambiance                                       | 11    |

Règle d'or : `simulation/` et `events/` n'importent jamais `three`, `react` ni le DOM.
