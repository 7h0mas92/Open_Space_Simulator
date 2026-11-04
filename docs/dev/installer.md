# Installer, lancer et trouver les choses

> Extrait de [`CONTEXTE.md`](../../CONTEXTE.md).

## Où sont les choses

| Quoi                                             | Où                                                                                                                               |
| ------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------- |
| Dépôt                                            | https://github.com/7h0mas92/Open_Space_Simulator (`develop` en test, `main` publiée)                                             |
| Cahier des charges, état d'avancement            | `docs/cahier-des-charges/`, `docs/etat/`, index dans `CLAUDE.md`                                                                 |
| Installation, architecture, déploiement, crédits | `README.md`                                                                                                                      |
| Ce relais                                        | `CONTEXTE.md`                                                                                                                    |
| Rôle et emplacement de chaque fichier            | `ARBORESCENCE.md`                                                                                                                |
| Rapport d'équilibrage (10 000 parties)           | `docs/balance.md`                                                                                                                |
| Captures du README                               | `docs/screenshots/`                                                                                                              |
| Rôle de chaque dossier du client                 | `packages/client/src/README.md`                                                                                                  |
| Interface de la simulation                       | `packages/client/src/simulation/README.md`                                                                                       |
| Constantes partagées de chaque système           | `packages/shared/src/sim/*.ts` (balance, furniture, pets, floors, serverRoom…)                                                   |
| Succès (70, dont 22 secrets)                     | `packages/shared/src/meta/achievements.ts`                                                                                       |
| 100 cartes d'événements                          | `packages/shared/src/data/cards/`                                                                                                |
| Modes de jeu                                     | `GAME_MODES` dans `packages/shared/src/game.ts` (EASY, NORMAL, HARDCORE, INTERNS_ONLY, SHIP_IN_3, ENDLESS, DAILY, STORY, CAREER) |
| Mode Histoire (chapitres, missions, récompenses) | `packages/shared/src/story/`, `packages/client/src/simulation/story.ts`, `packages/client/src/ui/story/`                         |
| Mode Carrière (légendes, jalons, étoiles)        | `packages/shared/src/sim/career.ts`, `packages/client/src/simulation/career.ts`, `packages/client/src/ui/career/`                |
| Bots de `pnpm balance`                           | `packages/client/src/simulation/bots.ts` (random, shipper, balanced, cautious, investor, organizer, financier)                   |
| Assets Kenney (déjà commités)                    | `packages/client/public/assets/kenney/` (Furniture Kit, Blocky Characters)                                                       |
| Musiques et sons                                 | `packages/client/public/assets/music/`, `packages/client/public/assets/sounds/`                                                  |
| Variables d'environnement                        | `packages/server/.env.example`, `packages/client/.env.example`                                                                   |
| Déploiement                                      | `render.yaml`, `packages/client/vercel.json`, `.github/workflows/pages.yml`                                                      |
| CI                                               | `.github/workflows/ci.yml` (lint, format, typecheck, tests, build, e2e)                                                          |

## Installer et lancer

Prérequis : Node 22.12 ou plus (`.nvmrc`), pnpm 10 via `corepack enable`, Docker (PostgreSQL 16
seulement, pas de Dockerfile).

```bash
git clone https://github.com/7h0mas92/Open_Space_Simulator.git
cd Open_Space_Simulator
corepack enable
pnpm install
cp packages/server/.env.example packages/server/.env
pnpm db:up && pnpm db:migrate && pnpm db:seed
pnpm dev   # jeu sur localhost:5173, API et Swagger sur localhost:3000/docs
```

- Base : `pnpm --filter @oss/server db:studio` (localhost:5555) ou
  `docker compose exec db psql -U oss -d oss` (dev : `oss` / `oss` / `oss`).
- Compte admin créé par le seed (dev uniquement) : `admin@oss.local` / `admin-dev-password`.
- Avant de pousser : `pnpm lint && pnpm format:check && pnpm typecheck && pnpm test`.
- `pnpm balance` (ou `pnpm balance --games 2000` pour aller vite) : rapport dans
  `packages/client/reports/balance.md`, à recopier dans `docs/balance.md`.
