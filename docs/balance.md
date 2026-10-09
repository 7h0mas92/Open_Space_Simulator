# Rapport d'équilibrage

10000 parties simulées.

## Par stratégie

| Bot       | Parties | Faillite |   IPO | Rachat | Zombie | Licorne | Valo. moyenne | Valo. médiane | Sprints joués |
| --------- | ------: | -------: | ----: | -----: | -----: | ------: | ------------: | ------------: | ------------: |
| random    |    1429 |   24.1 % | 0.0 % | 51.3 % | 24.6 % |   0.0 % |       19.0 M€ |        4.9 M€ |          35.1 |
| shipper   |    1429 |    0.3 % | 0.0 % | 99.7 % |  0.1 % |   0.0 % |       80.9 M€ |       64.3 M€ |          32.7 |
| balanced  |    1429 |    0.1 % | 5.8 % | 94.1 % |  0.0 % |   5.8 % |      304.5 M€ |      183.2 M€ |          32.9 |
| cautious  |    1429 |    0.8 % | 4.3 % | 75.7 % | 19.2 % |   4.3 % |      228.5 M€ |      104.6 M€ |          38.0 |
| investor  |    1428 |    0.1 % | 3.9 % | 95.9 % |  0.0 % |   4.0 % |      271.4 M€ |      176.8 M€ |          32.9 |
| organizer |    1428 |    0.1 % | 9.7 % | 90.2 % |  0.0 % |  10.2 % |      404.2 M€ |      243.3 M€ |          32.9 |
| financier |    1428 |    0.0 % | 6.2 % | 93.8 % |  0.0 % |   6.5 % |      327.0 M€ |      181.4 M€ |          32.5 |

## Filiales

Retour = (dividendes + reventes + valeur des parts en fin de partie) / sommes investies.

| Bot      | Filiales par partie | Coulées | Retour |
| -------- | ------------------: | ------: | -----: |
| investor |                2.79 |  42.9 % | ×29.53 |

## Levées de fonds

Chaque tour de table est plus dur que le précédent ; à partir de la Série B, il ouvre une annexe au bureau.

| Bot       | Tours réussis par partie | Pitchs réussis | Parties avec annexe | Autres financements par partie |
| --------- | -----------------------: | -------------: | ------------------: | -----------------------------: |
| random    |                     1.64 |         44.2 % |              15.2 % |                           0.00 |
| shipper   |                     2.50 |         81.7 % |              49.5 % |                           0.00 |
| balanced  |                     2.24 |         86.5 % |              23.7 % |                           0.00 |
| cautious  |                     1.73 |         88.6 % |               0.6 % |                           0.00 |
| investor  |                     2.76 |         87.8 % |              68.8 % |                           0.00 |
| organizer |                     2.18 |         86.9 % |              17.6 % |                           0.00 |
| financier |                     2.21 |         86.4 % |              20.8 % |                           0.26 |

## Taux de faillite par phase

| Bot       | GARAGE |   SEED | SERIES_A | UNICORN |
| --------- | -----: | -----: | -------: | ------: |
| random    |  5.4 % | 11.2 % |    7.5 % |   0.0 % |
| shipper   |  0.1 % |  0.0 % |    0.1 % |   0.0 % |
| balanced  |  0.0 % |  0.1 % |    0.0 % |   0.0 % |
| cautious  |  0.0 % |  0.8 % |    0.0 % |   0.0 % |
| investor  |  0.0 % |  0.1 % |    0.1 % |   0.0 % |
| organizer |  0.0 % |  0.0 % |    0.1 % |   0.0 % |
| financier |  0.0 % |  0.0 % |    0.0 % |   0.0 % |

## Trajectoire des jauges (mode Normal)

Médiane de chaque jauge à la fin des sprints 5, 13, 26 et 39, sur les parties encore en cours. La trésorerie est en mois de dépenses : au-delà de 24 mois, l’argent ne compte plus vraiment.

| Bot       | Sprint | Parties | Trésorerie (mois) | Café | Dette | Stabilité | Hype | Utilisateurs |
| --------- | -----: | ------: | ----------------: | ---: | ----: | --------: | ---: | -----------: |
| random    |      5 |    1339 |              15.7 |   94 |    14 |        88 |   28 |          4 k |
| random    |     13 |    1312 |              12.0 |   94 |    29 |        49 |   19 |         15 k |
| random    |     26 |    1200 |               6.7 |   94 |    45 |         6 |    9 |         24 k |
| random    |     39 |     714 |               5.0 |   94 |    47 |         4 |    9 |         37 k |
| shipper   |      5 |    1408 |              12.1 |   94 |    53 |        66 |   41 |         22 k |
| shipper   |     13 |    1272 |              10.6 |   96 |   100 |         2 |   40 |        179 k |
| shipper   |     26 |    1062 |               6.9 |   96 |   100 |         4 |   47 |        329 k |
| shipper   |     39 |     733 |              11.5 |   96 |   100 |         4 |   48 |        385 k |
| balanced  |      5 |    1424 |              12.7 |   90 |    10 |        95 |   37 |         24 k |
| balanced  |     13 |    1353 |              11.6 |   80 |    15 |        91 |   35 |        274 k |
| balanced  |     26 |    1114 |               7.0 |   75 |    16 |        89 |   31 |        727 k |
| balanced  |     39 |     709 |               6.7 |   76 |    13 |        95 |   30 |       1.17 M |
| cautious  |      5 |    1428 |              15.0 |   92 |     8 |        96 |   35 |         15 k |
| cautious  |     13 |    1423 |              10.5 |   89 |     9 |        93 |   35 |         95 k |
| cautious  |     26 |    1404 |               5.7 |   86 |    10 |        94 |   34 |        243 k |
| cautious  |     39 |    1092 |               9.9 |   82 |    11 |        93 |   34 |        420 k |
| investor  |      5 |    1424 |              12.5 |   88 |    10 |        95 |   37 |         24 k |
| investor  |     13 |    1335 |               6.3 |   80 |    16 |        89 |   40 |        300 k |
| investor  |     26 |    1106 |               8.6 |   66 |    23 |        68 |   26 |        579 k |
| investor  |     39 |     713 |              15.0 |   66 |    26 |        75 |   22 |        493 k |
| organizer |      5 |    1423 |              12.7 |   89 |     9 |        95 |   38 |         25 k |
| organizer |     13 |    1358 |              11.6 |   80 |    14 |        91 |   37 |        291 k |
| organizer |     26 |    1125 |               7.1 |   75 |    15 |        90 |   35 |        869 k |
| organizer |     39 |     672 |               6.4 |   73 |    14 |        95 |   34 |       1.36 M |
| financier |      5 |    1422 |              12.7 |   90 |    10 |        95 |   37 |         24 k |
| financier |     13 |    1329 |              11.7 |   80 |    16 |        90 |   35 |        274 k |
| financier |     26 |    1100 |               7.2 |   76 |    15 |        90 |   31 |        764 k |
| financier |     39 |     689 |               6.5 |   76 |    13 |        95 |   30 |       1.13 M |

## Jauges bloquées

Part des jours passés au plancher (≤ 2) ou au plafond (≥ 98). Une jauge collée à 0 ou à 100 pendant des mois ne pose plus de choix au joueur.

| Bot / mode   | Café à 0 | Hype à 0 | Stabilité à 0 | Dette à 100 | Café à 100 | Hype à 100 | Stabilité à 100 | Dette à 0 |
| ------------ | -------: | -------: | ------------: | ----------: | ---------: | ---------: | --------------: | --------: |
| random       |    0.4 % |   14.2 % |        22.8 % |       5.5 % |     12.1 % |      0.0 % |          13.6 % |    10.6 % |
| shipper      |    0.0 % |    0.2 % |        21.8 % |      55.8 % |     12.4 % |      0.0 % |           3.4 % |     0.2 % |
| balanced     |    0.0 % |    2.0 % |         2.3 % |       0.5 % |      2.2 % |      0.0 % |          29.8 % |    15.4 % |
| cautious     |    0.0 % |    1.8 % |         1.0 % |       0.2 % |      4.0 % |      0.0 % |          37.3 % |    27.1 % |
| investor     |    0.0 % |    3.9 % |         5.0 % |       0.8 % |      2.3 % |      0.0 % |          23.8 % |    13.2 % |
| organizer    |    0.0 % |    1.4 % |         1.8 % |       0.4 % |      1.7 % |      0.0 % |          30.8 % |    16.4 % |
| financier    |    0.0 % |    1.9 % |         2.6 % |       0.5 % |      2.6 % |      0.0 % |          29.6 % |    15.2 % |
| NORMAL       |    0.1 % |    3.6 % |         8.2 % |       9.1 % |      5.3 % |      0.0 % |          24.0 % |    14.0 % |
| EASY         |    0.1 % |    3.1 % |         7.6 % |       9.2 % |      5.1 % |      0.0 % |          23.8 % |    13.1 % |
| HARDCORE     |    0.0 % |    9.5 % |        21.0 % |      13.8 % |     19.6 % |      0.0 % |          20.2 % |    12.0 % |
| INTERNS_ONLY |    0.3 % |   50.5 % |        46.3 % |      22.6 % |      3.8 % |      0.0 % |           0.5 % |     3.1 % |
| SHIP_IN_3    |    0.0 % |    0.0 % |         0.1 % |       0.0 % |     16.0 % |      0.0 % |          24.7 % |    19.4 % |

## Par mode de jeu

| Mode         | Parties | Faillite | Valo. médiane | Trésorerie S13 (mois) | Hype S13 | Café S13 | Hype S39 |
| ------------ | ------: | -------: | ------------: | --------------------: | -------: | -------: | -------: |
| NORMAL       |   10000 |    3.6 % |      105.9 M€ |                  11.0 |       35 |       86 |       31 |
| EASY         |     400 |    1.5 % |      146.3 M€ |                  12.3 |       35 |       83 |       34 |
| HARDCORE     |     400 |    4.0 % |       24.7 M€ |                  11.8 |       24 |       88 |       14 |
| INTERNS_ONLY |     400 |   25.8 % |        2.8 M€ |                  10.0 |        0 |       83 |        0 |
| SHIP_IN_3    |     400 |    0.0 % |        7.7 M€ |                     — |        — |        — |        — |

## Cartes les plus tirées

- `friday-prod-down` : 60788
- `legacy-php` : 15610
- `button-color-meeting` : 13331
- `coffee-machine-broken` : 12786
- `standup-one-hour` : 12751
- `dev-wants-raise` : 11978
- `framework-of-the-week` : 10964
- `wifi-down` : 10761
- `code-review-war` : 10737
- `works-on-my-machine` : 10639
- `weekend-hackathon` : 10379
- `investor-blockchain` : 10186
- `birthday-cake` : 10173
- `competitor-raised-50m` : 9714
- `cto-medium-microservices` : 9641

## Cartes jamais tirées (0)

Aucune.

## Cartes à surveiller (5)

- `coffee-machine-dead` : un choix écrase les autres (écart de score 9.9)
- `pirate-talk-day` : choix 2 dominé : un autre choix est meilleur sur toutes les jauges
- `legacy-php` : choix 2 : valorisation finale ×1.73 par rapport aux autres choix (trop fort ?)
- `venture-bridge-round` : choix 1 : valorisation finale ×1.72 par rapport aux autres choix (trop fort ?)
- `burnout-warning` : choix 1 : valorisation finale ×1.55 par rapport aux autres choix (trop fort ?)

## Succès débloqués par les bots

Les bots ne jouent pas comme un humain : ce taux sert à repérer un succès impossible (0 %) ou trop facile pour sa difficulté.

| Succès                 | Difficulté | Secret | Parties |
| ---------------------- | ---------- | ------ | ------: |
| `this-is-fine`         | EASY       | oui    |  12.7 % |
| `duck-lead`            | EASY       | oui    |   3.6 % |
| `bobby-tables`         | MEDIUM     | oui    |   1.6 % |
| `zero-meeting`         | MEDIUM     |        |  69.8 % |
| `web3-bro`             | EASY       | oui    |   2.3 % |
| `log-scale`            | EASY       | oui    |  55.1 % |
| `office-dog`           | EASY       | oui    |  55.4 % |
| `black-friday`         | LEGENDARY  |        |   1.2 % |
| `debt-free-unicorn`    | HARD       |        |   2.5 % |
| `hello-world`          | EASY       |        | 100.0 % |
| `feature-factory`      | MEDIUM     |        |  95.4 % |
| `clean-coder`          | MEDIUM     |        |  83.5 % |
| `first-check`          | EASY       |        |  98.2 % |
| `unicorn`              | HARD       |        |   4.4 % |
| `decacorn`             | LEGENDARY  |        |   0.0 % |
| `ding-ding`            | HARD       |        |   4.3 % |
| `acquired`             | MEDIUM     |        |  85.8 % |
| `bankrupt`             | EASY       |        |   3.6 % |
| `zombie`               | MEDIUM     |        |   6.3 % |
| `founder-control`      | LEGENDARY  |        |   4.3 % |
| `burnout-factory`      | HARD       | oui    |   0.0 % |
| `big-team`             | HARD       |        |   0.0 % |
| `restructuring`        | MEDIUM     |        |   0.0 % |
| `hallucination-nation` | MEDIUM     |        |  31.8 % |
| `decaf`                | MEDIUM     |        |   0.5 % |
| `million-users`        | HARD       |        |  33.4 % |
| `crisis-manager`       | MEDIUM     |        |  92.4 % |
| `interior-designer`    | MEDIUM     |        |  38.9 % |
| `intern-army`          | HARD       |        |   0.0 % |
| `no-pause`             | HARD       |        |   0.0 % |
| `ship-it`              | HARD       |        |   0.0 % |
| `daily-player`         | EASY       |        |   0.0 % |
| `first-hire`           | EASY       |        | 100.0 % |
| `first-sprint`         | EASY       |        | 100.0 % |
| `first-users`          | EASY       |        | 100.0 % |
| `babyfoot`             | EASY       |        |   0.0 % |
| `barista`              | EASY       |        |  71.3 % |
| `bug-squasher`         | MEDIUM     |        |  46.0 % |
| `series-a`             | MEDIUM     |        |  90.1 % |
| `hype-train`           | HARD       |        |   1.7 % |
| `homegrown`            | MEDIUM     |        |  42.5 % |
| `scale-up`             | MEDIUM     |        |  66.8 % |
| `war-chest`            | MEDIUM     |        |  82.3 % |
| `great-place`          | MEDIUM     |        |  82.3 % |
| `kind-boss`            | MEDIUM     |        |  76.1 % |
| `speedrun`             | LEGENDARY  |        |   0.2 % |
| `gotta-catch`          | LEGENDARY  |        |   5.9 % |
| `skynet`               | MEDIUM     | oui    |  42.6 % |
| `beard-council`        | MEDIUM     | oui    |  57.5 % |
| `rust-cult`            | EASY       | oui    |  82.2 % |
| `friday-deploy`        | EASY       | oui    |  95.0 % |
| `office-romance`       | EASY       | oui    |  93.5 % |
| `cold-war`             | MEDIUM     | oui    |  48.9 % |
| `sovereign-debt`       | MEDIUM     | oui    |  28.2 % |
| `revolving-door`       | HARD       | oui    |  10.3 % |
| `garage-bankrupt`      | MEDIUM     | oui    |   0.8 % |
| `close-call`           | HARD       | oui    |   1.3 % |
| `yolo`                 | HARD       | oui    |  14.2 % |
| `lone-wolf`            | LEGENDARY  | oui    |   1.4 % |
| `google-campus`        | HARD       | oui    |   0.0 % |
| `ghost-company`        | LEGENDARY  | oui    |   0.0 % |
| `business-angel`       | EASY       |        |  14.3 % |
| `holding`              | HARD       |        |   8.8 % |
| `golden-exit`          | MEDIUM     |        |   0.0 % |
| `money-pit`            | MEDIUM     | oui    |   5.2 % |
