# Rapport d'équilibrage

10000 parties simulées.

## Par stratégie

| Bot      | Parties | Faillite |   IPO | Rachat | Zombie | Licorne | Valo. moyenne | Valo. médiane | Sprints joués |
| -------- | ------: | -------: | ----: | -----: | -----: | ------: | ------------: | ------------: | ------------: |
| random   |    2000 |   20.8 % | 0.0 % | 60.3 % | 18.9 % |   0.0 % |       23.8 M€ |        6.0 M€ |          34.8 |
| shipper  |    2000 |    0.1 % | 0.0 % | 99.9 % |  0.1 % |   0.0 % |       78.7 M€ |       62.3 M€ |          32.3 |
| balanced |    2000 |    0.2 % | 6.1 % | 93.7 % |  0.0 % |   6.2 % |      312.7 M€ |      174.0 M€ |          32.3 |
| cautious |    2000 |    0.9 % | 4.3 % | 81.5 % | 13.3 % |   4.3 % |      219.9 M€ |      101.9 M€ |          37.8 |
| investor |    2000 |    0.1 % | 3.5 % | 96.4 % |  0.0 % |   3.8 % |      253.1 M€ |      160.3 M€ |          32.8 |

## Filiales

Retour = (dividendes + reventes + valeur des parts en fin de partie) / sommes investies.

| Bot      | Filiales par partie | Coulées | Retour |
| -------- | ------------------: | ------: | -----: |
| investor |                2.82 |  44.9 % | ×27.16 |

## Taux de faillite par phase

| Bot      | GARAGE |  SEED | SERIES_A | UNICORN |
| -------- | -----: | ----: | -------: | ------: |
| random   |  4.3 % | 9.9 % |    6.6 % |   0.0 % |
| shipper  |  0.0 % | 0.1 % |    0.0 % |   0.0 % |
| balanced |  0.0 % | 0.0 % |    0.2 % |   0.0 % |
| cautious |  0.1 % | 0.7 % |    0.1 % |   0.0 % |
| investor |  0.0 % | 0.0 % |    0.1 % |   0.0 % |

## Trajectoire des jauges (mode Normal)

Médiane de chaque jauge à la fin des sprints 5, 13, 26 et 39, sur les parties encore en cours. La trésorerie est en mois de dépenses : au-delà de 24 mois, l’argent ne compte plus vraiment.

| Bot      | Sprint | Parties | Trésorerie (mois) | Café | Dette | Stabilité | Hype | Utilisateurs |
| -------- | -----: | ------: | ----------------: | ---: | ----: | --------: | ---: | -----------: |
| random   |      5 |    1885 |              15.8 |   94 |    14 |        90 |   29 |          4 k |
| random   |     13 |    1814 |              12.1 |   94 |    27 |        52 |   22 |         17 k |
| random   |     26 |    1635 |               7.1 |   94 |    43 |         7 |   12 |         30 k |
| random   |     39 |     989 |               7.3 |   94 |    47 |         4 |   12 |         47 k |
| shipper  |      5 |    1973 |              12.1 |   94 |    55 |        65 |   43 |         21 k |
| shipper  |     13 |    1730 |              10.5 |   96 |   100 |         4 |   41 |        179 k |
| shipper  |     26 |    1456 |               7.0 |   97 |   100 |         3 |   47 |        329 k |
| shipper  |     39 |     972 |              12.2 |   97 |   100 |         4 |   48 |        378 k |
| balanced |      5 |    1985 |              12.6 |   90 |     9 |        95 |   38 |         25 k |
| balanced |     13 |    1862 |              11.5 |   83 |    17 |        89 |   36 |        280 k |
| balanced |     26 |    1509 |               7.1 |   79 |    18 |        85 |   31 |        715 k |
| balanced |     39 |     943 |               6.6 |   79 |    14 |        93 |   31 |       1.13 M |
| cautious |      5 |    1997 |              14.8 |   92 |     8 |        95 |   37 |         16 k |
| cautious |     13 |    1991 |              10.2 |   90 |    10 |        92 |   37 |        100 k |
| cautious |     26 |    1945 |               5.7 |   88 |    10 |        91 |   34 |        244 k |
| cautious |     39 |    1480 |              10.2 |   83 |    13 |        88 |   33 |        423 k |
| investor |      5 |    1992 |              12.6 |   92 |    10 |        95 |   39 |         26 k |
| investor |     13 |    1873 |               6.4 |   83 |    16 |        87 |   41 |        295 k |
| investor |     26 |    1526 |               9.0 |   71 |    25 |        62 |   25 |        528 k |
| investor |     39 |     973 |              15.4 |   72 |    25 |        68 |   19 |        362 k |

## Jauges bloquées

Part des jours passés au plancher (≤ 2) ou au plafond (≥ 98). Une jauge collée à 0 ou à 100 pendant des mois ne pose plus de choix au joueur.

| Bot / mode   | Café à 0 | Hype à 0 | Stabilité à 0 | Dette à 100 | Café à 100 | Hype à 100 | Stabilité à 100 | Dette à 0 |
| ------------ | -------: | -------: | ------------: | ----------: | ---------: | ---------: | --------------: | --------: |
| random       |    0.3 % |   12.3 % |        21.4 % |       4.9 % |     19.2 % |      0.0 % |          14.0 % |    10.3 % |
| shipper      |    0.0 % |    0.2 % |        22.5 % |      54.4 % |     22.2 % |      0.0 % |           3.1 % |     0.2 % |
| balanced     |    0.0 % |    1.8 % |         2.9 % |       0.5 % |      4.5 % |      0.0 % |          28.4 % |    15.1 % |
| cautious     |    0.0 % |    2.1 % |         1.6 % |       0.3 % |      7.0 % |      0.0 % |          34.1 % |    24.9 % |
| investor     |    0.0 % |    3.9 % |         5.9 % |       1.2 % |      4.4 % |      0.0 % |          23.1 % |    13.2 % |
| NORMAL       |    0.1 % |    4.0 % |        10.8 % |      12.3 % |     11.5 % |      0.0 % |          20.6 % |    12.8 % |
| EASY         |    0.1 % |    2.8 % |         9.4 % |      12.6 % |      9.7 % |      0.1 % |          22.0 % |    12.3 % |
| HARDCORE     |    0.1 % |    8.1 % |        18.4 % |      14.0 % |     28.3 % |      0.0 % |          23.9 % |    12.6 % |
| INTERNS_ONLY |    0.3 % |   47.3 % |        51.5 % |      29.6 % |      6.8 % |      0.0 % |           0.6 % |     3.0 % |
| SHIP_IN_3    |    0.0 % |    0.0 % |         0.1 % |       0.0 % |     23.8 % |      0.0 % |          27.5 % |    20.0 % |

## Par mode de jeu

| Mode         | Parties | Faillite | Valo. médiane | Trésorerie S13 (mois) | Hype S13 | Café S13 | Hype S39 |
| ------------ | ------: | -------: | ------------: | --------------------: | -------: | -------: | -------: |
| NORMAL       |   10000 |    4.4 % |       79.9 M€ |                  10.7 |       36 |       90 |       30 |
| EASY         |     400 |    0.0 % |      112.1 M€ |                  12.2 |       37 |       87 |       34 |
| HARDCORE     |     400 |    3.3 % |       44.8 M€ |                  11.5 |       24 |       92 |       21 |
| INTERNS_ONLY |     400 |   27.3 % |        2.5 M€ |                  10.4 |        1 |       88 |        0 |
| SHIP_IN_3    |     400 |    0.0 % |        7.7 M€ |                     — |        — |        — |        — |

## Cartes les plus tirées

- `friday-prod-down` : 69088
- `legacy-php` : 20167
- `button-color-meeting` : 16034
- `coffee-machine-broken` : 15426
- `standup-one-hour` : 15081
- `dev-wants-raise` : 14669
- `framework-of-the-week` : 13340
- `code-review-war` : 12906
- `wifi-down` : 12843
- `works-on-my-machine` : 12699
- `weekend-hackathon` : 12354
- `birthday-cake` : 12211
- `investor-blockchain` : 12015
- `team-building` : 11587
- `npm-left-pad` : 11528

## Cartes jamais tirées (0)

Aucune.

## Cartes à surveiller (3)

- `coffee-machine-dead` : un choix écrase les autres (écart de score 9.9)
- `legacy-php` : choix 2 : valorisation finale ×1.76 par rapport aux autres choix (trop fort ?)
- `venture-bridge-round` : choix 1 : valorisation finale ×1.68 par rapport aux autres choix (trop fort ?)

## Succès débloqués par les bots

Les bots ne jouent pas comme un humain : ce taux sert à repérer un succès impossible (0 %) ou trop facile pour sa difficulté.

| Succès                 | Difficulté | Secret | Parties |
| ---------------------- | ---------- | ------ | ------: |
| `this-is-fine`         | EASY       | oui    |  17.4 % |
| `duck-lead`            | EASY       | oui    |   5.7 % |
| `bobby-tables`         | MEDIUM     | oui    |   2.7 % |
| `zero-meeting`         | MEDIUM     |        |  78.4 % |
| `web3-bro`             | EASY       | oui    |   3.6 % |
| `log-scale`            | EASY       | oui    |  59.8 % |
| `office-dog`           | EASY       | oui    |  60.5 % |
| `black-friday`         | LEGENDARY  |        |   1.1 % |
| `debt-free-unicorn`    | HARD       |        |   1.5 % |
| `hello-world`          | EASY       |        | 100.0 % |
| `feature-factory`      | MEDIUM     |        |  95.2 % |
| `clean-coder`          | MEDIUM     |        |  78.0 % |
| `first-check`          | EASY       |        |  97.9 % |
| `unicorn`              | HARD       |        |   2.9 % |
| `decacorn`             | LEGENDARY  |        |   0.0 % |
| `ding-ding`            | HARD       |        |   2.8 % |
| `acquired`             | MEDIUM     |        |  86.4 % |
| `bankrupt`             | EASY       |        |   4.4 % |
| `zombie`               | MEDIUM     |        |   6.5 % |
| `founder-control`      | LEGENDARY  |        |   2.8 % |
| `burnout-factory`      | HARD       | oui    |   0.0 % |
| `big-team`             | HARD       |        |   0.0 % |
| `restructuring`        | MEDIUM     |        |   0.0 % |
| `hallucination-nation` | MEDIUM     |        |  31.9 % |
| `decaf`                | MEDIUM     |        |   0.7 % |
| `million-users`        | HARD       |        |  24.8 % |
| `crisis-manager`       | MEDIUM     |        |  92.3 % |
| `interior-designer`    | MEDIUM     |        |  33.6 % |
| `intern-army`          | HARD       |        |   0.0 % |
| `no-pause`             | HARD       |        |   0.0 % |
| `ship-it`              | HARD       |        |   0.0 % |
| `daily-player`         | EASY       |        |   0.0 % |
| `first-hire`           | EASY       |        | 100.0 % |
| `first-sprint`         | EASY       |        | 100.0 % |
| `first-users`          | EASY       |        | 100.0 % |
| `babyfoot`             | EASY       |        |   0.0 % |
| `barista`              | EASY       |        |  59.9 % |
| `bug-squasher`         | MEDIUM     |        |  49.0 % |
| `series-a`             | MEDIUM     |        |  89.4 % |
| `hype-train`           | HARD       |        |   2.2 % |
| `homegrown`            | MEDIUM     |        |  48.9 % |
| `scale-up`             | MEDIUM     |        |  58.4 % |
| `war-chest`            | MEDIUM     |        |  79.4 % |
| `great-place`          | MEDIUM     |        |  72.1 % |
| `kind-boss`            | MEDIUM     |        |  70.4 % |
| `speedrun`             | LEGENDARY  |        |   0.1 % |
| `gotta-catch`          | LEGENDARY  |        |   5.4 % |
| `skynet`               | MEDIUM     | oui    |  39.4 % |
| `beard-council`        | MEDIUM     | oui    |  56.6 % |
| `rust-cult`            | EASY       | oui    |  81.5 % |
| `friday-deploy`        | EASY       | oui    |  96.4 % |
| `office-romance`       | EASY       | oui    |  91.7 % |
| `cold-war`             | MEDIUM     | oui    |  42.5 % |
| `sovereign-debt`       | MEDIUM     | oui    |  35.7 % |
| `revolving-door`       | HARD       | oui    |  15.0 % |
| `garage-bankrupt`      | MEDIUM     | oui    |   0.9 % |
| `close-call`           | HARD       | oui    |   1.5 % |
| `yolo`                 | HARD       | oui    |  20.0 % |
| `lone-wolf`            | LEGENDARY  | oui    |   1.6 % |
| `google-campus`        | HARD       | oui    |   0.0 % |
| `ghost-company`        | LEGENDARY  | oui    |   0.0 % |
| `business-angel`       | EASY       |        |  20.0 % |
| `holding`              | HARD       |        |  12.0 % |
| `golden-exit`          | MEDIUM     |        |   0.0 % |
| `money-pit`            | MEDIUM     | oui    |   8.4 % |
