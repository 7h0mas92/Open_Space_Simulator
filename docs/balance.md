# Rapport d'équilibrage

10000 parties simulées.

## Par stratégie

| Bot      | Parties | Faillite |   IPO | Rachat | Zombie | Licorne | Valo. moyenne | Valo. médiane | Sprints joués |
| -------- | ------: | -------: | ----: | -----: | -----: | ------: | ------------: | ------------: | ------------: |
| random   |    2500 |   19.8 % | 0.0 % | 59.6 % | 20.6 % |   0.0 % |       25.2 M€ |        6.2 M€ |          35.0 |
| shipper  |    2500 |    0.2 % | 0.0 % | 99.8 % |  0.0 % |   0.0 % |       70.7 M€ |       57.1 M€ |          32.3 |
| balanced |    2500 |    0.0 % | 6.0 % | 94.0 % |  0.0 % |   6.2 % |      301.7 M€ |      178.0 M€ |          32.5 |
| cautious |    2500 |    0.6 % | 3.7 % | 82.2 % | 13.4 % |   3.8 % |      216.4 M€ |      100.1 M€ |          37.7 |

## Taux de faillite par phase

| Bot      | GARAGE |  SEED | SERIES_A | UNICORN |
| -------- | -----: | ----: | -------: | ------: |
| random   |  3.9 % | 9.7 % |    6.2 % |   0.0 % |
| shipper  |  0.0 % | 0.1 % |    0.0 % |   0.0 % |
| balanced |  0.0 % | 0.0 % |    0.0 % |   0.0 % |
| cautious |  0.0 % | 0.6 % |    0.0 % |   0.0 % |

## Trajectoire des jauges (mode Normal)

Médiane de chaque jauge à la fin des sprints 5, 13, 26 et 39, sur les parties encore en cours. La trésorerie est en mois de dépenses : au-delà de 24 mois, l’argent ne compte plus vraiment.

| Bot      | Sprint | Parties | Trésorerie (mois) | Café | Dette | Stabilité | Hype | Utilisateurs |
| -------- | -----: | ------: | ----------------: | ---: | ----: | --------: | ---: | -----------: |
| random   |      5 |    2338 |              15.7 |   94 |    14 |        89 |   29 |          4 k |
| random   |     13 |    2298 |              12.1 |   90 |    28 |        49 |   20 |         16 k |
| random   |     26 |    2032 |               7.1 |   86 |    41 |         8 |   12 |         29 k |
| random   |     39 |    1273 |               7.4 |   83 |    45 |         6 |   13 |         47 k |
| shipper  |      5 |    2469 |              11.9 |   87 |    52 |        66 |   43 |         22 k |
| shipper  |     13 |    2172 |              10.9 |   79 |   100 |         4 |   41 |        176 k |
| shipper  |     26 |    1826 |               7.3 |   82 |   100 |         2 |   44 |        281 k |
| shipper  |     39 |    1232 |              12.6 |   83 |   100 |         4 |   47 |        356 k |
| balanced |      5 |    2494 |              12.6 |   88 |    10 |        95 |   38 |         25 k |
| balanced |     13 |    2328 |              11.6 |   80 |    16 |        87 |   36 |        286 k |
| balanced |     26 |    1917 |               7.1 |   76 |    17 |        86 |   31 |        707 k |
| balanced |     39 |    1209 |               6.8 |   76 |    15 |        93 |   31 |       1.10 M |
| cautious |      5 |    2499 |              14.8 |   92 |     9 |        95 |   37 |         17 k |
| cautious |     13 |    2492 |              10.3 |   90 |     9 |        92 |   36 |         98 k |
| cautious |     26 |    2442 |               5.7 |   86 |    10 |        92 |   33 |        239 k |
| cautious |     39 |    1803 |              10.2 |   80 |    12 |        89 |   32 |        419 k |

## Jauges bloquées

Part des jours passés au plancher (≤ 2) ou au plafond (≥ 98). Une jauge collée à 0 ou à 100 pendant des mois ne pose plus de choix au joueur.

| Bot / mode   | Café à 0 | Hype à 0 | Stabilité à 0 | Dette à 100 | Café à 100 | Hype à 100 | Stabilité à 100 | Dette à 0 |
| ------------ | -------: | -------: | ------------: | ----------: | ---------: | ---------: | --------------: | --------: |
| random       |    2.1 % |   12.6 % |        21.3 % |       4.7 % |     11.5 % |      0.0 % |          14.3 % |    10.7 % |
| shipper      |    2.0 % |    0.1 % |        22.8 % |      53.3 % |      3.0 % |      0.0 % |           3.4 % |     0.3 % |
| balanced     |    0.0 % |    2.1 % |         2.8 % |       0.5 % |      3.1 % |      0.0 % |          28.2 % |    14.9 % |
| cautious     |    0.0 % |    2.1 % |         1.5 % |       0.2 % |      5.3 % |      0.0 % |          34.2 % |    25.0 % |
| NORMAL       |    1.0 % |    4.2 % |        12.1 % |      14.7 % |      5.7 % |      0.0 % |          20.0 % |    12.7 % |
| EASY         |    1.1 % |    3.2 % |        11.7 % |      16.5 % |      4.4 % |      0.1 % |          20.5 % |    12.2 % |
| HARDCORE     |    0.5 % |    9.9 % |        22.1 % |      17.5 % |     11.4 % |      0.0 % |          23.6 % |    13.6 % |
| INTERNS_ONLY |    4.9 % |   46.7 % |        54.1 % |      32.4 % |      2.9 % |      0.0 % |           0.8 % |     3.1 % |
| SHIP_IN_3    |    0.0 % |    0.0 % |         0.0 % |       0.0 % |     19.6 % |      0.0 % |          26.9 % |    22.4 % |

## Par mode de jeu

| Mode         | Parties | Faillite | Valo. médiane | Trésorerie S13 (mois) | Hype S13 | Café S13 | Hype S39 |
| ------------ | ------: | -------: | ------------: | --------------------: | -------: | -------: | -------: |
| NORMAL       |   10000 |    5.1 % |       63.5 M€ |                  11.1 |       34 |       85 |       33 |
| EASY         |     400 |    1.3 % |       86.4 M€ |                  13.3 |       36 |       82 |       31 |
| HARDCORE     |     400 |    6.0 % |       29.3 M€ |                  11.8 |       23 |       88 |       19 |
| INTERNS_ONLY |     400 |   32.0 % |        1.6 M€ |                  11.0 |        0 |       82 |        1 |
| SHIP_IN_3    |     400 |    0.0 % |        6.8 M€ |                     — |        — |        — |        — |

## Cartes les plus tirées

- `friday-prod-down` : 71799
- `legacy-php` : 22030
- `button-color-meeting` : 16563
- `standup-one-hour` : 15923
- `coffee-machine-broken` : 15869
- `dev-wants-raise` : 15518
- `framework-of-the-week` : 13514
- `works-on-my-machine` : 13330
- `code-review-war` : 13278
- `wifi-down` : 13129
- `weekend-hackathon` : 12773
- `birthday-cake` : 12576
- `investor-blockchain` : 12402
- `retro-post-its` : 11915
- `regex-email` : 11912

## Cartes jamais tirées (0)

Aucune.

## Cartes à surveiller (4)

- `coffee-machine-dead` : un choix écrase les autres (écart de score 9.9)
- `legacy-php` : choix 2 : valorisation finale ×1.90 par rapport aux autres choix (trop fort ?)
- `hiring-spree` : choix 1 : valorisation finale ×1.51 par rapport aux autres choix (trop fort ?)
- `big-tech-copies` : choix 1 : valorisation finale ×1.53 par rapport aux autres choix (trop fort ?)

## Succès débloqués par les bots

Les bots ne jouent pas comme un humain : ce taux sert à repérer un succès impossible (0 %) ou trop facile pour sa difficulté.

| Succès                 | Difficulté | Secret | Parties |
| ---------------------- | ---------- | ------ | ------: |
| `this-is-fine`         | EASY       | oui    |  22.0 % |
| `duck-lead`            | EASY       | oui    |   7.1 % |
| `bobby-tables`         | MEDIUM     | oui    |   3.1 % |
| `zero-meeting`         | MEDIUM     |        |  79.0 % |
| `web3-bro`             | EASY       | oui    |   5.1 % |
| `log-scale`            | EASY       | oui    |  60.2 % |
| `office-dog`           | EASY       | oui    |  60.3 % |
| `black-friday`         | LEGENDARY  |        |   1.6 % |
| `debt-free-unicorn`    | HARD       |        |   1.3 % |
| `hello-world`          | EASY       |        | 100.0 % |
| `feature-factory`      | MEDIUM     |        |  95.8 % |
| `clean-coder`          | MEDIUM     |        |  73.3 % |
| `first-check`          | EASY       |        |  97.5 % |
| `unicorn`              | HARD       |        |   2.5 % |
| `decacorn`             | LEGENDARY  |        |   0.0 % |
| `ding-ding`            | HARD       |        |   2.4 % |
| `acquired`             | MEDIUM     |        |  83.9 % |
| `bankrupt`             | EASY       |        |   5.1 % |
| `zombie`               | MEDIUM     |        |   8.5 % |
| `founder-control`      | LEGENDARY  |        |   2.4 % |
| `burnout-factory`      | HARD       | oui    |   0.0 % |
| `big-team`             | HARD       |        |   0.0 % |
| `restructuring`        | MEDIUM     |        |   0.0 % |
| `hallucination-nation` | MEDIUM     |        |  34.2 % |
| `decaf`                | MEDIUM     |        |  19.2 % |
| `million-users`        | HARD       |        |  21.7 % |
| `crisis-manager`       | MEDIUM     |        |  93.1 % |
| `interior-designer`    | MEDIUM     |        |  21.2 % |
| `intern-army`          | HARD       |        |   0.0 % |
| `no-pause`             | HARD       |        |   0.0 % |
| `ship-it`              | HARD       |        |   0.0 % |
| `daily-player`         | EASY       |        |   0.0 % |
| `first-hire`           | EASY       |        | 100.0 % |
| `first-sprint`         | EASY       |        | 100.0 % |
| `first-users`          | EASY       |        | 100.0 % |
| `babyfoot`             | EASY       |        |   0.0 % |
| `barista`              | EASY       |        |  49.9 % |
| `bug-squasher`         | MEDIUM     |        |  51.6 % |
| `series-a`             | MEDIUM     |        |  86.4 % |
| `hype-train`           | HARD       |        |   1.8 % |
| `homegrown`            | MEDIUM     |        |  58.5 % |
| `scale-up`             | MEDIUM     |        |  46.3 % |
| `war-chest`            | MEDIUM     |        |  74.2 % |
| `great-place`          | MEDIUM     |        |  62.3 % |
| `kind-boss`            | MEDIUM     |        |  59.6 % |
| `speedrun`             | LEGENDARY  |        |   0.1 % |
| `gotta-catch`          | LEGENDARY  |        |   1.9 % |
| `skynet`               | MEDIUM     | oui    |  33.6 % |
| `beard-council`        | MEDIUM     | oui    |  51.4 % |
| `rust-cult`            | EASY       | oui    |  78.8 % |
| `friday-deploy`        | EASY       | oui    |  97.0 % |
| `office-romance`       | EASY       | oui    |  97.4 % |
| `cold-war`             | MEDIUM     | oui    |  63.0 % |
| `sovereign-debt`       | MEDIUM     | oui    |  39.9 % |
| `revolving-door`       | HARD       | oui    |  20.6 % |
| `garage-bankrupt`      | MEDIUM     | oui    |   1.0 % |
| `close-call`           | HARD       | oui    |   1.8 % |
| `yolo`                 | HARD       | oui    |  25.0 % |
| `lone-wolf`            | LEGENDARY  | oui    |   2.0 % |
| `google-campus`        | HARD       | oui    |   0.0 % |
| `ghost-company`        | LEGENDARY  | oui    |   0.0 % |
