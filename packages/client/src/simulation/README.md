# Simulation : comment s'y brancher

La simulation est du TypeScript pur : aucune dépendance à Three.js, React ou au DOM
(ESLint l'interdit, ainsi que `Math.random`, `Date.now` et les fonctions `Math.log`,
`Math.exp`… dont le résultat peut varier d'un moteur JavaScript à l'autre).

```
UI (React/Zustand) ──commandes──▶ engine/bridge ──postMessage──▶ Web Worker
        ▲                                                         │
        └──────── snapshots (état + notifications) ◀──────────────┘
Rendu (Three.js) lit les mêmes snapshots et interpole entre deux ticks.
```

## Utilisation côté thread principal

```ts
import { createGameEngine, SnapshotBuffer } from '../engine';
import { DEFAULT_CARDS } from '../simulation';

const engine = createGameEngine(); // vrai Web Worker, ou repli sur le thread principal
await engine.start({ kind: 'new', seed: 'daily-2026-10-06', mode: 'NORMAL' }, DEFAULT_CARDS);

engine.subscribe((snapshot) => {
  // snapshot.state : GameState complet (lecture seule)
  // snapshot.notifications : ce qui vient de se passer (fumée, confettis, Slack…)
});

await engine.dispatch({ type: 'START_SPRINT' }); // → { ok: true } ou { ok: false, error }
engine.setSpeed(4); // 0 (pause, refusée en Hardcore), 1, 2, 4
const save = await engine.save(); // { state, commands } : à envoyer à POST /saves
await engine.start({ kind: 'load', save }, DEFAULT_CARDS);
```

Le rendu garde les deux derniers snapshots dans un `SnapshotBuffer` et appelle
`buffer.alpha(performance.now())` à chaque image pour interpoler positions et éclairage.

## Où lire quoi dans `GameState`

| Besoin                      | Chemin                                                             |
| --------------------------- | ------------------------------------------------------------------ |
| Étape du sprint             | `stage` : `PLANNING`, `EXECUTION`, `DEMO`, `PITCH`, `ENDED`        |
| Jauges                      | `gauges.treasury`, `coffee`, `debt`, `stability`, `hype`, `users`  |
| Heure, jour, vendredi 17h   | `getClock(state)` → `hour`, `dayOfWeek`, `isFriday17`…             |
| Devs                        | `devIds(state)` puis `components.identity/stats/mood/employment`   |
| Ce que fait un perso        | `components.activity[id]` : `kind`, `withId` (collègue)            |
| Dev en télétravail          | `id in components.remote` (Dev Fantôme : ne pas l'afficher)        |
| Kanban                      | `tasksInColumn(state, 'TODO')`, `components.task[id]`              |
| Mobilier                    | `components.furniture[id]` : `itemId`, `x`, `y`, `rotation`        |
| Taille du bureau            | `OFFICE_SIZE[state.phase]` (`@oss/shared`)                         |
| Carte affichée              | `events.pending` → `cardId`, `level` ; texte via `CardLibrary.get` |
| Candidats                   | `candidates` (`status` : `OPEN`, `HIRED`, `REFUSED`)               |
| Pitch en cours              | `pitch` : investisseur, manches, `options`, `result`               |
| Offre de rachat             | `acquisitionOffer`                                                 |
| Dashboard (graphiques)      | `history.daily` (un point par jour), `history.sprints` (démos)     |
| Fin de partie               | `result` : `outcome`, `valuation`, `headline` (texte partageable)  |
| Succès débloqués par cartes | `achievements`                                                     |

Les commandes et leurs erreurs sont décrites dans `@oss/shared` (`CommandSchema`,
`COMMAND_ERRORS`). Une commande refusée ne modifie jamais l'état et n'est pas journalisée.

## Propriétés garanties (et testées)

- **Déterminisme** : même graine + mêmes commandes aux mêmes ticks ⇒ même partie au bit près.
- **Replay** : `replay({ seed, mode, commands, cards })` rejoue une partie ; un journal
  falsifié lève `ReplayError` (base de l'anti-triche de `POST /scores`).
- **Sauvegarde instantanée** : l'état est du JSON ; rechargé, il continue à l'identique.
- **Sans navigateur** : `pnpm balance` joue 10 000 parties avec des bots.
