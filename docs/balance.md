# Rapport d'équilibrage

10000 parties simulées.

## Par stratégie

| Bot       | Parties | Faillite |    IPO | Rachat | Zombie | Licorne | Valo. moyenne | Valo. médiane | Sprints joués |
| --------- | ------: | -------: | -----: | -----: | -----: | ------: | ------------: | ------------: | ------------: |
| random    |    1429 |    8.3 % |  0.0 % | 62.4 % | 29.3 % |   0.0 % |       38.2 M€ |       13.4 M€ |          34.9 |
| shipper   |    1429 |    0.1 % | 19.7 % | 80.2 % |  0.1 % |  20.4 % |      629.7 M€ |      337.5 M€ |          32.1 |
| balanced  |    1429 |    0.0 % | 10.8 % | 89.2 % |  0.0 % |  11.3 % |      448.2 M€ |      278.2 M€ |          32.5 |
| cautious  |    1429 |    0.1 % |  1.5 % | 80.3 % | 18.1 % |   1.5 % |      203.4 M€ |      129.6 M€ |          37.6 |
| investor  |    1428 |    0.1 % | 10.9 % | 89.1 % |  0.0 % |  11.1 % |      449.8 M€ |      272.1 M€ |          32.7 |
| organizer |    1428 |    0.0 % | 15.1 % | 84.9 % |  0.0 % |  16.2 % |      574.8 M€ |      355.7 M€ |          31.9 |
| financier |    1428 |    0.0 % | 10.5 % | 89.5 % |  0.0 % |  11.1 % |      454.2 M€ |      266.9 M€ |          32.5 |

## Filiales

Retour = (dividendes + reventes + valeur des parts en fin de partie) / sommes investies.

| Bot      | Filiales par partie | Coulées | Retour |
| -------- | ------------------: | ------: | -----: |
| investor |                2.77 |  41.8 % | ×29.53 |

## Levées de fonds

Chaque tour de table est plus dur que le précédent ; à partir de la Série B, il ouvre une annexe au bureau.

| Bot       | Tours réussis par partie | Pitchs réussis | Parties avec annexe | Autres financements par partie |
| --------- | -----------------------: | -------------: | ------------------: | -----------------------------: |
| random    |                     1.82 |         48.3 % |              20.9 % |                           0.00 |
| shipper   |                     2.06 |         86.3 % |               5.7 % |                           0.00 |
| balanced  |                     2.07 |         87.5 % |               6.6 % |                           0.00 |
| cautious  |                     1.78 |         89.5 % |               0.0 % |                           0.00 |
| investor  |                     2.55 |         88.3 % |              53.1 % |                           0.00 |
| organizer |                     2.04 |         88.2 % |               3.9 % |                           0.00 |
| financier |                     2.06 |         87.4 % |               5.7 % |                           0.12 |

## Tâches dynamiques

Urgences (prod cassée, faille, gros client...) et tâches de la semaine réussies à temps ; objectifs de sprint réussis.

| Bot       | Urgences par partie | Urgences à temps | Hebdo à temps | Objectifs par partie | Objectifs réussis |
| --------- | ------------------: | ---------------: | ------------: | -------------------: | ----------------: |
| random    |                38.7 |           57.8 % |        97.8 % |                 12.7 |            58.4 % |
| shipper   |                54.4 |           56.0 % |        99.8 % |                 12.0 |            44.8 % |
| balanced  |                32.3 |           75.2 % |        99.9 % |                 12.4 |            45.9 % |
| cautious  |                30.8 |           71.9 % |        99.9 % |                 14.7 |            64.1 % |
| investor  |                37.7 |           76.1 % |        99.9 % |                 12.6 |            43.1 % |
| organizer |                31.1 |           75.2 % |        99.9 % |                 12.3 |            46.1 % |
| financier |                32.3 |           76.2 % |        99.9 % |                 12.6 |            45.5 % |

| Objectif      | Difficulté | Tirages | Réussite |
| ------------- | ---------- | ------: | -------: |
| SHIP_FEATURES | EASY       |   11841 |   56.3 % |
| SHIP_FEATURES | MEDIUM     |   11743 |   28.6 % |
| SHIP_FEATURES | HARD       |    6276 |    7.2 % |
| CLOSE_TASKS   | EASY       |   11989 |   72.6 % |
| CLOSE_TASKS   | MEDIUM     |   11578 |   45.2 % |
| CLOSE_TASKS   | HARD       |    6337 |   11.2 % |
| ZERO_INCIDENT | EASY       |   21052 |   82.5 % |
| ZERO_INCIDENT | MEDIUM     |    4092 |   45.8 % |
| ZERO_INCIDENT | HARD       |    4518 |   21.1 % |
| REDUCE_DEBT   | EASY       |    3382 |   40.4 % |
| REDUCE_DEBT   | MEDIUM     |    3289 |   32.5 % |
| REDUCE_DEBT   | HARD       |    1785 |   24.8 % |
| GAIN_USERS    | EASY       |   11857 |   69.4 % |
| GAIN_USERS    | MEDIUM     |   11657 |   50.3 % |
| GAIN_USERS    | HARD       |    6196 |   26.3 % |

## Taux de faillite par phase

| Bot       | GARAGE |  SEED | SERIES_A | UNICORN |
| --------- | -----: | ----: | -------: | ------: |
| random    |  0.2 % | 4.3 % |    3.8 % |   0.0 % |
| shipper   |  0.0 % | 0.0 % |    0.1 % |   0.0 % |
| balanced  |  0.0 % | 0.0 % |    0.0 % |   0.0 % |
| cautious  |  0.0 % | 0.1 % |    0.0 % |   0.0 % |
| investor  |  0.0 % | 0.0 % |    0.1 % |   0.0 % |
| organizer |  0.0 % | 0.0 % |    0.0 % |   0.0 % |
| financier |  0.0 % | 0.0 % |    0.0 % |   0.0 % |

## Trajectoire des jauges (mode Normal)

Médiane de chaque jauge à la fin des sprints 5, 13, 26 et 39, sur les parties encore en cours. La trésorerie est en mois de dépenses : au-delà de 24 mois, l’argent ne compte plus vraiment.

| Bot       | Sprint | Parties | Trésorerie (mois) | Café | Dette | Stabilité | Hype | Utilisateurs |
| --------- | -----: | ------: | ----------------: | ---: | ----: | --------: | ---: | -----------: |
| random    |      5 |    1342 |              15.9 |   92 |    13 |        92 |   29 |          4 k |
| random    |     13 |    1327 |              12.4 |   92 |    21 |        71 |   21 |         17 k |
| random    |     26 |    1163 |               7.7 |   93 |    26 |        41 |   13 |         35 k |
| random    |     39 |     864 |               6.4 |   93 |    24 |        47 |   15 |         64 k |
| shipper   |      5 |    1421 |              12.2 |   94 |    47 |        79 |   45 |         25 k |
| shipper   |     13 |    1262 |              10.5 |   94 |   100 |        34 |   47 |        286 k |
| shipper   |     26 |    1092 |               7.3 |   96 |   100 |        60 |   61 |       1.38 M |
| shipper   |     39 |     565 |               7.3 |   96 |   100 |        59 |   60 |       1.72 M |
| balanced  |      5 |    1421 |              12.7 |   88 |     8 |        97 |   38 |         25 k |
| balanced  |     13 |    1348 |              11.8 |   79 |     8 |        97 |   36 |        306 k |
| balanced  |     26 |    1115 |               7.6 |   73 |     8 |        97 |   32 |        944 k |
| balanced  |     39 |     660 |               7.0 |   74 |     7 |        98 |   30 |       1.52 M |
| cautious  |      5 |    1428 |              15.0 |   90 |     9 |        95 |   35 |         17 k |
| cautious  |     13 |    1425 |              10.8 |   88 |     9 |        94 |   35 |        101 k |
| cautious  |     26 |    1381 |               6.9 |   84 |     9 |        96 |   32 |        261 k |
| cautious  |     39 |    1079 |               9.6 |   78 |     8 |        96 |   28 |        492 k |
| investor  |      5 |    1424 |              12.8 |   88 |     8 |        97 |   39 |         26 k |
| investor  |     13 |    1343 |               6.2 |   79 |     9 |        96 |   41 |        332 k |
| investor  |     26 |    1130 |               7.3 |   64 |    10 |        94 |   26 |        853 k |
| investor  |     39 |     652 |              14.2 |   62 |     8 |        96 |   22 |       1.09 M |
| organizer |      5 |    1424 |              12.8 |   87 |     7 |        97 |   40 |         26 k |
| organizer |     13 |    1338 |              11.6 |   77 |     8 |        96 |   40 |        328 k |
| organizer |     26 |    1099 |               7.6 |   71 |     7 |        98 |   37 |       1.05 M |
| organizer |     39 |     586 |               6.9 |   71 |     7 |        98 |   33 |       1.68 M |
| financier |      5 |    1426 |              12.7 |   88 |     7 |        97 |   38 |         25 k |
| financier |     13 |    1353 |              11.8 |   79 |     8 |        97 |   35 |        303 k |
| financier |     26 |    1121 |               7.6 |   74 |     7 |        97 |   31 |        923 k |
| financier |     39 |     661 |               6.8 |   73 |     7 |        98 |   30 |       1.47 M |

## Jauges bloquées

Part des jours passés au plancher (≤ 2) ou au plafond (≥ 98). Une jauge collée à 0 ou à 100 pendant des mois ne pose plus de choix au joueur.

| Bot / mode   | Café à 0 | Hype à 0 | Stabilité à 0 | Dette à 100 | Café à 100 | Hype à 100 | Stabilité à 100 | Dette à 0 |
| ------------ | -------: | -------: | ------------: | ----------: | ---------: | ---------: | --------------: | --------: |
| random       |    0.4 % |   12.6 % |        15.4 % |       2.9 % |      9.2 % |      0.0 % |          20.8 % |    14.0 % |
| shipper      |    0.0 % |    0.1 % |         7.3 % |      43.6 % |      9.3 % |      0.1 % |           7.3 % |     0.3 % |
| balanced     |    0.0 % |    1.8 % |         0.4 % |       0.0 % |      1.5 % |      0.0 % |          46.4 % |    25.6 % |
| cautious     |    0.0 % |    2.7 % |         0.6 % |       0.1 % |      2.8 % |      0.0 % |          41.8 % |    28.6 % |
| investor     |    0.2 % |    3.1 % |         0.9 % |       0.0 % |      1.5 % |      0.0 % |          41.4 % |    22.2 % |
| organizer    |    0.0 % |    1.1 % |         0.2 % |       0.0 % |      1.1 % |      0.0 % |          47.1 % |    26.5 % |
| financier    |    0.0 % |    1.7 % |         0.4 % |       0.0 % |      1.7 % |      0.0 % |          46.4 % |    26.0 % |
| NORMAL       |    0.1 % |    3.3 % |         3.6 % |       6.7 % |      3.9 % |      0.0 % |          35.9 % |    20.4 % |
| EASY         |    0.1 % |    3.1 % |         3.1 % |       6.9 % |      3.8 % |      0.0 % |          36.1 % |    20.6 % |
| HARDCORE     |    0.1 % |   27.4 % |        28.1 % |      13.6 % |     32.1 % |      0.0 % |          21.5 % |    16.8 % |
| INTERNS_ONLY |    2.1 % |   61.5 % |        47.2 % |      19.6 % |      2.5 % |      0.0 % |           0.4 % |     4.9 % |
| SHIP_IN_3    |    0.1 % |    0.0 % |         0.0 % |       0.0 % |     11.4 % |      0.0 % |          26.0 % |    19.9 % |

## Par mode de jeu

| Mode         | Parties | Faillite | Valo. médiane | Trésorerie S13 (mois) | Hype S13 | Café S13 | Hype S39 |
| ------------ | ------: | -------: | ------------: | --------------------: | -------: | -------: | -------: |
| NORMAL       |   10000 |    1.2 % |      213.5 M€ |                  11.2 |       37 |       85 |       29 |
| EASY         |     700 |    0.6 % |      220.3 M€ |                  11.2 |       39 |       84 |       30 |
| HARDCORE     |     700 |   32.0 % |        7.9 M€ |                   8.7 |        9 |       92 |        5 |
| INTERNS_ONLY |     700 |   13.1 % |        3.8 M€ |                  10.5 |        0 |       81 |        0 |
| SHIP_IN_3    |     700 |    0.0 % |        8.5 M€ |                     — |        — |        — |        — |

## Difficulté par mode et par stratégie

| Mode     | Bot       | Parties | Faillite | Zombie | Licorne | Valo. médiane |
| -------- | --------- | ------: | -------: | -----: | ------: | ------------: |
| EASY     | random    |     100 |    4.0 % | 22.0 % |   0.0 % |       22.6 M€ |
| EASY     | shipper   |     100 |    0.0 % |  0.0 % |  22.0 % |      340.0 M€ |
| EASY     | balanced  |     100 |    0.0 % |  0.0 % |  15.0 % |      288.4 M€ |
| EASY     | cautious  |     100 |    0.0 % | 17.0 % |   4.0 % |      143.1 M€ |
| EASY     | investor  |     100 |    0.0 % |  0.0 % |  10.0 % |      216.9 M€ |
| EASY     | organizer |     100 |    0.0 % |  0.0 % |  21.0 % |      397.2 M€ |
| EASY     | financier |     100 |    0.0 % |  0.0 % |  13.0 % |      289.2 M€ |
| NORMAL   | random    |    1429 |    8.3 % | 29.3 % |   0.0 % |       13.4 M€ |
| NORMAL   | shipper   |    1429 |    0.1 % |  0.1 % |  20.4 % |      337.5 M€ |
| NORMAL   | balanced  |    1429 |    0.0 % |  0.0 % |  11.3 % |      278.2 M€ |
| NORMAL   | cautious  |    1429 |    0.1 % | 18.1 % |   1.5 % |      129.6 M€ |
| NORMAL   | investor  |    1428 |    0.1 % |  0.0 % |  11.1 % |      272.1 M€ |
| NORMAL   | organizer |    1428 |    0.0 % |  0.0 % |  16.2 % |      355.7 M€ |
| NORMAL   | financier |    1428 |    0.0 % |  0.0 % |  11.1 % |      266.9 M€ |
| HARDCORE | random    |     100 |   76.0 % |  6.0 % |   0.0 % |        0.0 M€ |
| HARDCORE | shipper   |     100 |   20.0 % |  4.0 % |   0.0 % |        2.2 M€ |
| HARDCORE | balanced  |     100 |    9.0 % |  0.0 % |   3.0 % |       40.2 M€ |
| HARDCORE | cautious  |     100 |   91.0 % |  8.0 % |   0.0 % |        0.0 M€ |
| HARDCORE | investor  |     100 |   13.0 % |  3.0 % |   2.0 % |       94.1 M€ |
| HARDCORE | organizer |     100 |    8.0 % |  0.0 % |   4.0 % |       60.4 M€ |
| HARDCORE | financier |     100 |    7.0 % |  2.0 % |   2.0 % |       17.0 M€ |

## Cartes les plus tirées

- `friday-prod-down` : 40715
- `legacy-php` : 14469
- `button-color-meeting` : 13626
- `coffee-machine-broken` : 13107
- `standup-one-hour` : 13046
- `dev-wants-raise` : 12170
- `framework-of-the-week` : 11396
- `code-review-war` : 10979
- `works-on-my-machine` : 10938
- `wifi-down` : 10882
- `weekend-hackathon` : 10681
- `investor-blockchain` : 10349
- `birthday-cake` : 10339
- `competitor-raised-50m` : 9859
- `cto-medium-microservices` : 9857

## Cartes jamais tirées (0)

Aucune.

## Cartes à surveiller (2)

- `coffee-machine-dead` : un choix écrase les autres (écart de score 9.9)
- `pirate-talk-day` : choix 2 dominé : un autre choix est meilleur sur toutes les jauges

## Succès débloqués par les bots

Les bots ne jouent pas comme un humain : ce taux sert à repérer un succès impossible (0 %) ou trop facile pour sa difficulté.

| Succès                 | Difficulté | Secret | Parties |
| ---------------------- | ---------- | ------ | ------: |
| `this-is-fine`         | EASY       | oui    |  11.5 % |
| `duck-lead`            | EASY       | oui    |   3.7 % |
| `bobby-tables`         | MEDIUM     | oui    |   1.4 % |
| `zero-meeting`         | MEDIUM     |        |  79.5 % |
| `web3-bro`             | EASY       | oui    |   2.5 % |
| `log-scale`            | EASY       | oui    |  56.7 % |
| `office-dog`           | EASY       | oui    |  56.3 % |
| `black-friday`         | LEGENDARY  |        |   0.6 % |
| `debt-free-unicorn`    | HARD       |        |   5.5 % |
| `hello-world`          | EASY       |        | 100.0 % |
| `feature-factory`      | MEDIUM     |        |  94.6 % |
| `clean-coder`          | MEDIUM     |        |  83.5 % |
| `first-check`          | EASY       |        |  98.6 % |
| `unicorn`              | HARD       |        |  10.2 % |
| `decacorn`             | LEGENDARY  |        |   0.0 % |
| `ding-ding`            | HARD       |        |   9.8 % |
| `acquired`             | MEDIUM     |        |  82.2 % |
| `bankrupt`             | EASY       |        |   1.2 % |
| `zombie`               | MEDIUM     |        |   6.8 % |
| `founder-control`      | LEGENDARY  |        |   9.8 % |
| `burnout-factory`      | HARD       | oui    |   0.0 % |
| `big-team`             | HARD       |        |   0.1 % |
| `restructuring`        | MEDIUM     |        |   0.0 % |
| `hallucination-nation` | MEDIUM     |        |  27.4 % |
| `decaf`                | MEDIUM     |        |   1.5 % |
| `million-users`        | HARD       |        |  51.1 % |
| `crisis-manager`       | MEDIUM     |        |  91.7 % |
| `interior-designer`    | MEDIUM     |        |  25.5 % |
| `intern-army`          | HARD       |        |   0.0 % |
| `no-pause`             | HARD       |        |   0.0 % |
| `ship-it`              | HARD       |        |   0.0 % |
| `daily-player`         | EASY       |        |   0.0 % |
| `first-hire`           | EASY       |        | 100.0 % |
| `first-sprint`         | EASY       |        | 100.0 % |
| `first-users`          | EASY       |        | 100.0 % |
| `babyfoot`             | EASY       |        |   0.0 % |
| `barista`              | EASY       |        |  71.4 % |
| `bug-squasher`         | MEDIUM     |        |  97.0 % |
| `series-a`             | MEDIUM     |        |  92.0 % |
| `hype-train`           | HARD       |        |   6.2 % |
| `homegrown`            | MEDIUM     |        |  77.4 % |
| `scale-up`             | MEDIUM     |        |  69.4 % |
| `war-chest`            | MEDIUM     |        |  84.3 % |
| `great-place`          | MEDIUM     |        |  89.9 % |
| `kind-boss`            | MEDIUM     |        |  81.0 % |
| `speedrun`             | LEGENDARY  |        |   0.9 % |
| `gotta-catch`          | LEGENDARY  |        |  63.4 % |
| `skynet`               | MEDIUM     | oui    |  24.3 % |
| `beard-council`        | MEDIUM     | oui    |  33.9 % |
| `rust-cult`            | EASY       | oui    |  74.1 % |
| `friday-deploy`        | EASY       | oui    |  89.9 % |
| `office-romance`       | EASY       | oui    |  91.9 % |
| `cold-war`             | MEDIUM     | oui    |  51.5 % |
| `sovereign-debt`       | MEDIUM     | oui    |  19.5 % |
| `revolving-door`       | HARD       | oui    |   3.7 % |
| `garage-bankrupt`      | MEDIUM     | oui    |   0.0 % |
| `close-call`           | HARD       | oui    |   0.5 % |
| `yolo`                 | HARD       | oui    |  14.3 % |
| `lone-wolf`            | LEGENDARY  | oui    |   1.6 % |
| `google-campus`        | HARD       | oui    |   0.0 % |
| `ghost-company`        | LEGENDARY  | oui    |   0.0 % |
| `business-angel`       | EASY       |        |  14.3 % |
| `holding`              | HARD       |        |   8.2 % |
| `golden-exit`          | MEDIUM     |        |   0.0 % |
| `money-pit`            | MEDIUM     | oui    |   5.0 % |
