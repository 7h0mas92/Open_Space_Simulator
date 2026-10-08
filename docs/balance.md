# Rapport d'équilibrage

10000 parties simulées.

## Par stratégie

| Bot      | Parties | Faillite |   IPO | Rachat | Zombie | Licorne | Valo. moyenne | Valo. médiane | Sprints joués |
| -------- | ------: | -------: | ----: | -----: | -----: | ------: | ------------: | ------------: | ------------: |
| random   |    2500 |   22.2 % | 0.0 % | 58.8 % | 19.0 % |   0.0 % |       24.2 M€ |        5.9 M€ |          35.0 |
| shipper  |    2500 |    0.1 % | 0.0 % | 99.9 % |  0.0 % |   0.0 % |       76.3 M€ |       60.6 M€ |          32.3 |
| balanced |    2500 |    0.2 % | 6.6 % | 93.2 % |  0.0 % |   6.7 % |      317.3 M€ |      176.4 M€ |          32.5 |
| cautious |    2500 |    0.7 % | 4.7 % | 82.5 % | 12.1 % |   4.8 % |      232.8 M€ |      110.1 M€ |          37.8 |

## Taux de faillite par phase

| Bot      | GARAGE |   SEED | SERIES_A | UNICORN |
| -------- | -----: | -----: | -------: | ------: |
| random   |  4.6 % | 10.3 % |    7.3 % |   0.0 % |
| shipper  |  0.0 % |  0.0 % |    0.0 % |   0.0 % |
| balanced |  0.0 % |  0.0 % |    0.2 % |   0.0 % |
| cautious |  0.0 % |  0.5 % |    0.2 % |   0.0 % |

## Trajectoire des jauges (mode Normal)

Médiane de chaque jauge à la fin des sprints 5, 13, 26 et 39, sur les parties encore en cours. La trésorerie est en mois de dépenses : au-delà de 24 mois, l’argent ne compte plus vraiment.

| Bot      | Sprint | Parties | Trésorerie (mois) | Café | Dette | Stabilité | Hype | Utilisateurs |
| -------- | -----: | ------: | ----------------: | ---: | ----: | --------: | ---: | -----------: |
| random   |      5 |    2327 |              15.7 |   94 |    14 |        89 |   29 |          4 k |
| random   |     13 |    2286 |              12.1 |   94 |    28 |        46 |   21 |         16 k |
| random   |     26 |    2050 |               7.0 |   94 |    44 |         8 |   12 |         29 k |
| random   |     39 |    1232 |               7.3 |   94 |    45 |         4 |   11 |         49 k |
| shipper  |      5 |    2461 |              12.0 |   94 |    53 |        65 |   43 |         21 k |
| shipper  |     13 |    2156 |              10.5 |   96 |   100 |         4 |   42 |        187 k |
| shipper  |     26 |    1788 |               7.0 |   97 |   100 |         1 |   47 |        330 k |
| shipper  |     39 |    1247 |              12.6 |   97 |   100 |         4 |   48 |        355 k |
| balanced |      5 |    2488 |              12.6 |   92 |    10 |        95 |   38 |         25 k |
| balanced |     13 |    2321 |              11.6 |   83 |    16 |        89 |   36 |        282 k |
| balanced |     26 |    1897 |               7.1 |   79 |    18 |        86 |   31 |        707 k |
| balanced |     39 |    1202 |               6.7 |   79 |    14 |        94 |   32 |       1.12 M |
| cautious |      5 |    2496 |              14.8 |   93 |     9 |        95 |   37 |         17 k |
| cautious |     13 |    2489 |              10.3 |   90 |    10 |        92 |   37 |         99 k |
| cautious |     26 |    2446 |               5.6 |   88 |    10 |        91 |   35 |        247 k |
| cautious |     39 |    1854 |              10.2 |   83 |    13 |        88 |   33 |        449 k |

## Jauges bloquées

Part des jours passés au plancher (≤ 2) ou au plafond (≥ 98). Une jauge collée à 0 ou à 100 pendant des mois ne pose plus de choix au joueur.

| Bot / mode   | Café à 0 | Hype à 0 | Stabilité à 0 | Dette à 100 | Café à 100 | Hype à 100 | Stabilité à 100 | Dette à 0 |
| ------------ | -------: | -------: | ------------: | ----------: | ---------: | ---------: | --------------: | --------: |
| random       |    0.3 % |   12.5 % |        21.8 % |       5.1 % |     19.3 % |      0.0 % |          13.9 % |    10.3 % |
| shipper      |    0.0 % |    0.1 % |        22.3 % |      54.4 % |     22.2 % |      0.0 % |           3.2 % |     0.2 % |
| balanced     |    0.0 % |    1.9 % |         2.6 % |       0.4 % |      4.5 % |      0.0 % |          28.3 % |    15.0 % |
| cautious     |    0.0 % |    1.9 % |         1.7 % |       0.3 % |      7.3 % |      0.0 % |          33.9 % |    24.4 % |
| NORMAL       |    0.1 % |    4.1 % |        12.1 % |      15.1 % |     13.3 % |      0.0 % |          19.8 % |    12.5 % |
| EASY         |    0.1 % |    2.7 % |        11.2 % |      15.4 % |     11.9 % |      0.2 % |          20.3 % |    11.6 % |
| HARDCORE     |    0.1 % |    8.7 % |        21.7 % |      18.0 % |     30.0 % |      0.0 % |          22.9 % |    13.0 % |
| INTERNS_ONLY |    0.5 % |   45.7 % |        53.1 % |      32.4 % |      8.4 % |      0.0 % |           0.9 % |     3.0 % |
| SHIP_IN_3    |    0.0 % |    0.0 % |         0.0 % |       0.0 % |     23.7 % |      0.0 % |          26.4 % |    21.8 % |

## Par mode de jeu

| Mode         | Parties | Faillite | Valo. médiane | Trésorerie S13 (mois) | Hype S13 | Café S13 | Hype S39 |
| ------------ | ------: | -------: | ------------: | --------------------: | -------: | -------: | -------: |
| NORMAL       |   10000 |    5.8 % |       65.8 M€ |                  11.0 |       35 |       92 |       34 |
| EASY         |     400 |    0.0 % |       93.0 M€ |                  12.9 |       38 |       89 |       34 |
| HARDCORE     |     400 |    4.8 % |       33.3 M€ |                  11.7 |       23 |       93 |       20 |
| INTERNS_ONLY |     400 |   28.7 % |        2.0 M€ |                  10.6 |        1 |       88 |        1 |
| SHIP_IN_3    |     400 |    0.0 % |        6.8 M€ |                     — |        — |        — |        — |

## Cartes les plus tirées

- `friday-prod-down` : 72085
- `legacy-php` : 22626
- `button-color-meeting` : 16418
- `coffee-machine-broken` : 15818
- `standup-one-hour` : 15613
- `dev-wants-raise` : 15551
- `framework-of-the-week` : 13587
- `code-review-war` : 13140
- `works-on-my-machine` : 13093
- `wifi-down` : 13058
- `weekend-hackathon` : 12765
- `investor-blockchain` : 12377
- `birthday-cake` : 12361
- `npm-left-pad` : 12049
- `team-building` : 11809

## Cartes jamais tirées (0)

Aucune.

## Cartes à surveiller (3)

- `coffee-machine-dead` : un choix écrase les autres (écart de score 9.9)
- `big-tech-copies` : choix 1 : valorisation finale ×1.53 par rapport aux autres choix (trop fort ?)
- `legacy-php` : choix 2 : valorisation finale ×1.90 par rapport aux autres choix (trop fort ?)

## Succès débloqués par les bots

Les bots ne jouent pas comme un humain : ce taux sert à repérer un succès impossible (0 %) ou trop facile pour sa difficulté.

| Succès                 | Difficulté | Secret | Parties |
| ---------------------- | ---------- | ------ | ------: |
| `this-is-fine`         | EASY       | oui    |  22.0 % |
| `duck-lead`            | EASY       | oui    |   7.0 % |
| `bobby-tables`         | MEDIUM     | oui    |   3.1 % |
| `zero-meeting`         | MEDIUM     |        |  78.2 % |
| `web3-bro`             | EASY       | oui    |   4.9 % |
| `log-scale`            | EASY       | oui    |  59.8 % |
| `office-dog`           | EASY       | oui    |  59.7 % |
| `black-friday`         | LEGENDARY  |        |   1.3 % |
| `debt-free-unicorn`    | HARD       |        |   1.6 % |
| `hello-world`          | EASY       |        | 100.0 % |
| `feature-factory`      | MEDIUM     |        |  95.5 % |
| `clean-coder`          | MEDIUM     |        |  73.3 % |
| `first-check`          | EASY       |        |  97.4 % |
| `unicorn`              | HARD       |        |   2.9 % |
| `decacorn`             | LEGENDARY  |        |   0.0 % |
| `ding-ding`            | HARD       |        |   2.8 % |
| `acquired`             | MEDIUM     |        |  83.6 % |
| `bankrupt`             | EASY       |        |   5.8 % |
| `zombie`               | MEDIUM     |        |   7.8 % |
| `founder-control`      | LEGENDARY  |        |   2.8 % |
| `burnout-factory`      | HARD       | oui    |   0.0 % |
| `big-team`             | HARD       |        |   0.0 % |
| `restructuring`        | MEDIUM     |        |   0.0 % |
| `hallucination-nation` | MEDIUM     |        |  32.9 % |
| `decaf`                | MEDIUM     |        |   1.0 % |
| `million-users`        | HARD       |        |  22.9 % |
| `crisis-manager`       | MEDIUM     |        |  93.1 % |
| `interior-designer`    | MEDIUM     |        |  22.4 % |
| `intern-army`          | HARD       |        |   0.0 % |
| `no-pause`             | HARD       |        |   0.0 % |
| `ship-it`              | HARD       |        |   0.0 % |
| `daily-player`         | EASY       |        |   0.0 % |
| `first-hire`           | EASY       |        | 100.0 % |
| `first-sprint`         | EASY       |        | 100.0 % |
| `first-users`          | EASY       |        | 100.0 % |
| `babyfoot`             | EASY       |        |   0.0 % |
| `barista`              | EASY       |        |  49.9 % |
| `bug-squasher`         | MEDIUM     |        |  52.1 % |
| `series-a`             | MEDIUM     |        |  87.1 % |
| `hype-train`           | HARD       |        |   2.5 % |
| `homegrown`            | MEDIUM     |        |  58.8 % |
| `scale-up`             | MEDIUM     |        |  51.0 % |
| `war-chest`            | MEDIUM     |        |  74.7 % |
| `great-place`          | MEDIUM     |        |  67.2 % |
| `kind-boss`            | MEDIUM     |        |  63.3 % |
| `speedrun`             | LEGENDARY  |        |   0.1 % |
| `gotta-catch`          | LEGENDARY  |        |   2.1 % |
| `skynet`               | MEDIUM     | oui    |  33.1 % |
| `beard-council`        | MEDIUM     | oui    |  51.9 % |
| `rust-cult`            | EASY       | oui    |  79.0 % |
| `friday-deploy`        | EASY       | oui    |  97.0 % |
| `office-romance`       | EASY       | oui    |  89.9 % |
| `cold-war`             | MEDIUM     | oui    |  32.8 % |
| `sovereign-debt`       | MEDIUM     | oui    |  40.1 % |
| `revolving-door`       | HARD       | oui    |  18.8 % |
| `garage-bankrupt`      | MEDIUM     | oui    |   1.2 % |
| `close-call`           | HARD       | oui    |   1.6 % |
| `yolo`                 | HARD       | oui    |  25.0 % |
| `lone-wolf`            | LEGENDARY  | oui    |   1.9 % |
| `google-campus`        | HARD       | oui    |   0.0 % |
| `ghost-company`        | LEGENDARY  | oui    |   0.0 % |
