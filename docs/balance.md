# Rapport d'équilibrage

10000 parties simulées.

## Par stratégie

| Bot      | Parties | Faillite |    IPO | Rachat | Zombie | Licorne | Valo. moyenne | Valo. médiane | Sprints joués |
| -------- | ------: | -------: | -----: | -----: | -----: | ------: | ------------: | ------------: | ------------: |
| random   |    2500 |   16.9 % |  0.2 % | 56.4 % | 26.5 % |   0.2 % |       20.3 M€ |        5.5 M€ |          35.2 |
| shipper  |    2500 |    0.9 % |  0.1 % | 98.6 % |  0.4 % |   0.1 % |       72.3 M€ |       49.5 M€ |          32.4 |
| balanced |    2500 |    0.2 % |  4.9 % | 94.5 % |  0.4 % |   5.2 % |      216.9 M€ |       80.9 M€ |          32.8 |
| cautious |    2500 |    1.1 % | 17.8 % | 76.0 % |  5.1 % |  18.4 % |      547.3 M€ |      152.2 M€ |          33.6 |

## Taux de faillite par phase

| Bot      | GARAGE |  SEED | SERIES_A | UNICORN |
| -------- | -----: | ----: | -------: | ------: |
| random   |  4.3 % | 7.4 % |    5.2 % |   0.0 % |
| shipper  |  0.5 % | 0.2 % |    0.2 % |   0.0 % |
| balanced |  0.0 % | 0.0 % |    0.1 % |   0.0 % |
| cautious |  0.9 % | 0.2 % |    0.0 % |   0.0 % |

## Cartes les plus tirées

- `friday-prod-down` : 54632
- `legacy-php` : 21107
- `button-color-meeting` : 16223
- `coffee-machine-broken` : 15737
- `standup-one-hour` : 15736
- `dev-wants-raise` : 15323
- `framework-of-the-week` : 13769
- `code-review-war` : 13151
- `wifi-down` : 13015
- `works-on-my-machine` : 12945
- `weekend-hackathon` : 12780
- `birthday-cake` : 12503
- `investor-blockchain` : 12155
- `it-is-dns` : 11758
- `aircon-war` : 11753

## Cartes jamais tirées (0)

Aucune.

## Cartes à surveiller (2)

- `coffee-machine-dead` : un choix écrase les autres (écart de score 9.9)
- `legacy-php` : choix 2 : valorisation finale ×2.07 par rapport aux autres choix (trop fort ?)

## Succès débloqués par les bots

Les bots ne jouent pas comme un humain : ce taux sert à repérer un succès impossible (0 %) ou trop facile pour sa difficulté.

| Succès                 | Difficulté | Secret | Parties |
| ---------------------- | ---------- | ------ | ------: |
| `this-is-fine`         | EASY       | oui    |  18.6 % |
| `duck-lead`            | EASY       | oui    |   7.6 % |
| `bobby-tables`         | MEDIUM     | oui    |   2.4 % |
| `zero-meeting`         | MEDIUM     |        |  78.7 % |
| `web3-bro`             | EASY       | oui    |   5.1 % |
| `log-scale`            | EASY       | oui    |  56.9 % |
| `office-dog`           | EASY       | oui    |  59.3 % |
| `black-friday`         | LEGENDARY  |        |   0.9 % |
| `debt-free-unicorn`    | HARD       |        |   5.3 % |
| `hello-world`          | EASY       |        | 100.0 % |
| `feature-factory`      | MEDIUM     |        |  95.1 % |
| `clean-coder`          | MEDIUM     |        |  72.8 % |
| `first-check`          | EASY       |        |  96.8 % |
| `unicorn`              | HARD       |        |   6.0 % |
| `decacorn`             | LEGENDARY  |        |   0.0 % |
| `ding-ding`            | HARD       |        |   5.8 % |
| `acquired`             | MEDIUM     |        |  81.4 % |
| `bankrupt`             | EASY       |        |   4.8 % |
| `zombie`               | MEDIUM     |        |   8.1 % |
| `founder-control`      | LEGENDARY  |        |   3.1 % |
| `burnout-factory`      | HARD       | oui    |   0.0 % |
| `big-team`             | HARD       |        |   0.0 % |
| `restructuring`        | MEDIUM     |        |   0.0 % |
| `hallucination-nation` | MEDIUM     |        |  32.5 % |
| `decaf`                | MEDIUM     |        |   6.1 % |
| `million-users`        | HARD       |        |  30.9 % |
| `crisis-manager`       | MEDIUM     |        |  91.6 % |
| `interior-designer`    | MEDIUM     |        |  24.3 % |
| `intern-army`          | HARD       |        |   0.0 % |
| `no-pause`             | HARD       |        |   0.0 % |
| `ship-it`              | HARD       |        |   0.0 % |
| `daily-player`         | EASY       |        |   0.0 % |
| `first-hire`           | EASY       |        |  99.9 % |
| `first-sprint`         | EASY       |        | 100.0 % |
| `first-users`          | EASY       |        | 100.0 % |
| `babyfoot`             | EASY       |        |   0.0 % |
| `barista`              | EASY       |        |  49.5 % |
| `bug-squasher`         | MEDIUM     |        |  53.5 % |
| `series-a`             | MEDIUM     |        |  88.5 % |
| `hype-train`           | HARD       |        |   9.9 % |
| `homegrown`            | MEDIUM     |        |  48.7 % |
| `scale-up`             | MEDIUM     |        |  62.2 % |
| `war-chest`            | MEDIUM     |        |  60.5 % |
| `great-place`          | MEDIUM     |        |  75.0 % |
| `kind-boss`            | MEDIUM     |        |  66.1 % |
| `speedrun`             | LEGENDARY  |        |   0.6 % |
| `gotta-catch`          | LEGENDARY  |        |   2.1 % |
| `skynet`               | MEDIUM     | oui    |  32.5 % |
| `beard-council`        | MEDIUM     | oui    |  58.1 % |
| `rust-cult`            | EASY       | oui    |  81.3 % |
| `friday-deploy`        | EASY       | oui    |  90.0 % |
| `office-romance`       | EASY       | oui    |  89.1 % |
| `cold-war`             | MEDIUM     | oui    |  36.6 % |
| `sovereign-debt`       | MEDIUM     | oui    |  30.3 % |
| `revolving-door`       | HARD       | oui    |  18.2 % |
| `garage-bankrupt`      | MEDIUM     | oui    |   1.4 % |
| `close-call`           | HARD       | oui    |   1.7 % |
| `yolo`                 | HARD       | oui    |  24.8 % |
| `lone-wolf`            | LEGENDARY  | oui    |   2.4 % |
| `google-campus`        | HARD       | oui    |   0.0 % |
| `ghost-company`        | LEGENDARY  | oui    |   0.0 % |
