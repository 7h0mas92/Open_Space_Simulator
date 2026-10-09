# Rapport d'équilibrage

10000 parties simulées.

## Par stratégie

| Bot | Parties | Faillite | IPO | Rachat | Zombie | Licorne | Valo. moyenne | Valo. médiane | Sprints joués |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| random | 1667 | 21.6 % | 0.1 % | 60.1 % | 18.2 % | 0.1 % | 25.4 M€ | 5.9 M€ | 34.7 |
| shipper | 1667 | 0.1 % | 0.1 % | 99.8 % | 0.1 % | 0.1 % | 80.1 M€ | 61.1 M€ | 32.5 |
| balanced | 1667 | 0.0 % | 6.0 % | 94.0 % | 0.0 % | 6.1 % | 306.4 M€ | 179.6 M€ | 32.7 |
| cautious | 1667 | 0.8 % | 3.1 % | 79.8 % | 16.3 % | 3.1 % | 206.1 M€ | 104.6 M€ | 38.0 |
| investor | 1666 | 0.2 % | 5.2 % | 94.5 % | 0.0 % | 5.3 % | 279.5 M€ | 174.9 M€ | 33.1 |
| organizer | 1666 | 0.0 % | 10.1 % | 89.9 % | 0.0 % | 10.3 % | 385.0 M€ | 228.7 M€ | 32.4 |

## Filiales

Retour = (dividendes + reventes + valeur des parts en fin de partie) / sommes investies.

| Bot | Filiales par partie | Coulées | Retour |
| --- | ---: | ---: | ---: |
| investor | 2.80 | 43.8 % | ×28.97 |

## Taux de faillite par phase

| Bot | GARAGE | SEED | SERIES_A | UNICORN |
| --- | ---: | ---: | ---: | ---: |
| random | 4.0 % | 11.3 % | 6.3 % | 0.0 % |
| shipper | 0.0 % | 0.1 % | 0.0 % | 0.0 % |
| balanced | 0.0 % | 0.0 % | 0.0 % | 0.0 % |
| cautious | 0.0 % | 0.8 % | 0.0 % | 0.0 % |
| investor | 0.0 % | 0.1 % | 0.2 % | 0.0 % |
| organizer | 0.0 % | 0.0 % | 0.0 % | 0.0 % |

## Trajectoire des jauges (mode Normal)

Médiane de chaque jauge à la fin des sprints 5, 13, 26 et 39, sur les parties encore en cours. La trésorerie est en mois de dépenses : au-delà de 24 mois, l’argent ne compte plus vraiment.

| Bot | Sprint | Parties | Trésorerie (mois) | Café | Dette | Stabilité | Hype | Utilisateurs |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| random | 5 | 1579 | 15.8 | 93 | 15 | 88 | 28 | 4 k |
| random | 13 | 1538 | 12.2 | 92 | 29 | 45 | 20 | 16 k |
| random | 26 | 1377 | 7.0 | 93 | 44 | 7 | 11 | 29 k |
| random | 39 | 816 | 7.3 | 94 | 47 | 2 | 9 | 46 k |
| shipper | 5 | 1647 | 12.1 | 94 | 53 | 67 | 41 | 21 k |
| shipper | 13 | 1482 | 10.6 | 96 | 100 | 4 | 41 | 182 k |
| shipper | 26 | 1238 | 7.0 | 96 | 100 | 4 | 46 | 328 k |
| shipper | 39 | 831 | 12.8 | 96 | 100 | 4 | 48 | 363 k |
| balanced | 5 | 1663 | 12.7 | 90 | 10 | 95 | 37 | 25 k |
| balanced | 13 | 1557 | 11.7 | 80 | 15 | 90 | 34 | 273 k |
| balanced | 26 | 1288 | 7.2 | 76 | 18 | 88 | 31 | 747 k |
| balanced | 39 | 828 | 6.7 | 77 | 15 | 94 | 30 | 1.15 M |
| cautious | 5 | 1666 | 14.9 | 92 | 8 | 95 | 35 | 16 k |
| cautious | 13 | 1662 | 10.4 | 90 | 9 | 93 | 35 | 95 k |
| cautious | 26 | 1644 | 5.8 | 86 | 10 | 93 | 33 | 235 k |
| cautious | 39 | 1278 | 10.1 | 81 | 11 | 92 | 33 | 446 k |
| investor | 5 | 1661 | 12.6 | 90 | 10 | 95 | 37 | 25 k |
| investor | 13 | 1564 | 6.4 | 80 | 15 | 90 | 40 | 284 k |
| investor | 26 | 1295 | 9.0 | 67 | 24 | 67 | 26 | 581 k |
| investor | 39 | 846 | 15.8 | 68 | 23 | 73 | 21 | 442 k |
| organizer | 5 | 1661 | 12.6 | 89 | 9 | 95 | 38 | 25 k |
| organizer | 13 | 1558 | 11.6 | 78 | 15 | 91 | 38 | 301 k |
| organizer | 26 | 1270 | 7.1 | 74 | 16 | 88 | 33 | 818 k |
| organizer | 39 | 749 | 6.5 | 75 | 14 | 94 | 32 | 1.28 M |

## Jauges bloquées

Part des jours passés au plancher (≤ 2) ou au plafond (≥ 98). Une jauge collée à 0 ou à 100 pendant des mois ne pose plus de choix au joueur.

| Bot / mode | Café à 0 | Hype à 0 | Stabilité à 0 | Dette à 100 | Café à 100 | Hype à 100 | Stabilité à 100 | Dette à 0 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| random | 0.3 % | 12.9 % | 22.1 % | 5.2 % | 10.9 % | 0.0 % | 13.7 % | 10.3 % |
| shipper | 0.0 % | 0.2 % | 22.3 % | 56.0 % | 12.2 % | 0.0 % | 3.3 % | 0.2 % |
| balanced | 0.0 % | 1.9 % | 2.5 % | 0.4 % | 2.4 % | 0.0 % | 29.5 % | 14.9 % |
| cautious | 0.0 % | 1.8 % | 1.1 % | 0.2 % | 3.9 % | 0.0 % | 36.6 % | 26.0 % |
| investor | 0.0 % | 3.7 % | 4.9 % | 0.9 % | 2.4 % | 0.0 % | 24.2 % | 13.4 % |
| organizer | 0.0 % | 1.6 % | 1.8 % | 0.4 % | 1.6 % | 0.0 % | 30.0 % | 16.0 % |
| NORMAL | 0.1 % | 3.7 % | 9.1 % | 10.5 % | 5.6 % | 0.0 % | 22.9 % | 13.5 % |
| EASY | 0.1 % | 3.1 % | 9.1 % | 10.9 % | 6.2 % | 0.0 % | 24.1 % | 12.8 % |
| HARDCORE | 0.1 % | 10.5 % | 23.6 % | 16.5 % | 20.5 % | 0.0 % | 18.4 % | 11.9 % |
| INTERNS_ONLY | 0.5 % | 50.6 % | 48.2 % | 24.7 % | 3.8 % | 0.0 % | 0.7 % | 3.3 % |
| SHIP_IN_3 | 0.1 % | 0.1 % | 0.1 % | 0.0 % | 15.8 % | 0.0 % | 27.0 % | 20.3 % |

## Par mode de jeu

| Mode | Parties | Faillite | Valo. médiane | Trésorerie S13 (mois) | Hype S13 | Café S13 | Hype S39 |
| --- | ---: | ---: | ---: | ---: | ---: | ---: | ---: |
| NORMAL | 10000 | 3.8 % | 96.0 M€ | 11.0 | 36 | 87 | 30 |
| EASY | 400 | 0.5 % | 146.3 M€ | 12.2 | 37 | 85 | 32 |
| HARDCORE | 400 | 5.0 % | 17.5 M€ | 11.7 | 24 | 90 | 12 |
| INTERNS_ONLY | 400 | 21.5 % | 2.7 M€ | 10.5 | 1 | 84 | 0 |
| SHIP_IN_3 | 400 | 0.0 % | 7.7 M€ | — | — | — | — |

## Cartes les plus tirées

- `friday-prod-down` : 63318
- `legacy-php` : 15729
- `button-color-meeting` : 13434
- `coffee-machine-broken` : 13082
- `standup-one-hour` : 12515
- `dev-wants-raise` : 11860
- `framework-of-the-week` : 10904
- `wifi-down` : 10713
- `works-on-my-machine` : 10679
- `code-review-war` : 10643
- `weekend-hackathon` : 10354
- `investor-blockchain` : 10124
- `birthday-cake` : 10033
- `competitor-raised-50m` : 9793
- `cto-medium-microservices` : 9677

## Cartes jamais tirées (0)

Aucune.

## Cartes à surveiller (5)

- `coffee-machine-dead` : un choix écrase les autres (écart de score 9.9)
- `pirate-talk-day` : choix 2 dominé : un autre choix est meilleur sur toutes les jauges
- `legacy-php` : choix 2 : valorisation finale ×1.75 par rapport aux autres choix (trop fort ?)
- `database-deleted` : choix 2 : valorisation finale ×1.52 par rapport aux autres choix (trop fort ?)
- `burnout-warning` : choix 1 : valorisation finale ×1.59 par rapport aux autres choix (trop fort ?)

## Succès débloqués par les bots

Les bots ne jouent pas comme un humain : ce taux sert à repérer un succès impossible (0 %) ou trop facile pour sa difficulté.

| Succès | Difficulté | Secret | Parties |
| --- | --- | --- | ---: |
| `this-is-fine` | EASY | oui | 14.4 % |
| `duck-lead` | EASY | oui | 4.0 % |
| `bobby-tables` | MEDIUM | oui | 1.7 % |
| `zero-meeting` | MEDIUM |  | 67.7 % |
| `web3-bro` | EASY | oui | 2.9 % |
| `log-scale` | EASY | oui | 55.1 % |
| `office-dog` | EASY | oui | 55.3 % |
| `black-friday` | LEGENDARY |  | 1.1 % |
| `debt-free-unicorn` | HARD |  | 2.2 % |
| `hello-world` | EASY |  | 100.0 % |
| `feature-factory` | MEDIUM |  | 95.1 % |
| `clean-coder` | MEDIUM |  | 81.2 % |
| `first-check` | EASY |  | 98.5 % |
| `unicorn` | HARD |  | 4.2 % |
| `decacorn` | LEGENDARY |  | 0.0 % |
| `ding-ding` | HARD |  | 4.1 % |
| `acquired` | MEDIUM |  | 86.4 % |
| `bankrupt` | EASY |  | 3.8 % |
| `zombie` | MEDIUM |  | 5.8 % |
| `founder-control` | LEGENDARY |  | 4.1 % |
| `burnout-factory` | HARD | oui | 0.0 % |
| `big-team` | HARD |  | 0.0 % |
| `restructuring` | MEDIUM |  | 0.0 % |
| `hallucination-nation` | MEDIUM |  | 32.2 % |
| `decaf` | MEDIUM |  | 0.6 % |
| `million-users` | HARD |  | 29.8 % |
| `crisis-manager` | MEDIUM |  | 92.3 % |
| `interior-designer` | MEDIUM |  | 35.8 % |
| `intern-army` | HARD |  | 0.0 % |
| `no-pause` | HARD |  | 0.0 % |
| `ship-it` | HARD |  | 0.0 % |
| `daily-player` | EASY |  | 0.0 % |
| `first-hire` | EASY |  | 100.0 % |
| `first-sprint` | EASY |  | 100.0 % |
| `first-users` | EASY |  | 100.0 % |
| `babyfoot` | EASY |  | 0.0 % |
| `barista` | EASY |  | 66.5 % |
| `bug-squasher` | MEDIUM |  | 46.6 % |
| `series-a` | MEDIUM |  | 90.5 % |
| `hype-train` | HARD |  | 1.5 % |
| `homegrown` | MEDIUM |  | 47.0 % |
| `scale-up` | MEDIUM |  | 63.1 % |
| `war-chest` | MEDIUM |  | 81.9 % |
| `great-place` | MEDIUM |  | 80.9 % |
| `kind-boss` | MEDIUM |  | 76.3 % |
| `speedrun` | LEGENDARY |  | 0.2 % |
| `gotta-catch` | LEGENDARY |  | 5.0 % |
| `skynet` | MEDIUM | oui | 40.9 % |
| `beard-council` | MEDIUM | oui | 56.8 % |
| `rust-cult` | EASY | oui | 82.3 % |
| `friday-deploy` | EASY | oui | 95.7 % |
| `office-romance` | EASY | oui | 92.1 % |
| `cold-war` | MEDIUM | oui | 44.9 % |
| `sovereign-debt` | MEDIUM | oui | 31.5 % |
| `revolving-door` | HARD | oui | 12.2 % |
| `garage-bankrupt` | MEDIUM | oui | 0.7 % |
| `close-call` | HARD | oui | 0.9 % |
| `yolo` | HARD | oui | 16.7 % |
| `lone-wolf` | LEGENDARY | oui | 1.3 % |
| `google-campus` | HARD | oui | 0.0 % |
| `ghost-company` | LEGENDARY | oui | 0.0 % |
| `business-angel` | EASY |  | 16.7 % |
| `holding` | HARD |  | 10.0 % |
| `golden-exit` | MEDIUM |  | 0.0 % |
| `money-pit` | MEDIUM | oui | 6.5 % |
