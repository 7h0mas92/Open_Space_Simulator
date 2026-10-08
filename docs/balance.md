# Rapport d'équilibrage

10000 parties simulées.

## Par stratégie

| Bot      | Parties | Faillite |    IPO | Rachat | Zombie | Licorne | Valo. moyenne | Valo. médiane | Sprints joués |
| -------- | ------: | -------: | -----: | -----: | -----: | ------: | ------------: | ------------: | ------------: |
| random   |    2500 |   17.0 % |  0.2 % | 56.8 % | 26.0 % |   0.2 % |       20.6 M€ |        5.5 M€ |          35.2 |
| shipper  |    2500 |    0.8 % |  0.1 % | 98.9 % |  0.1 % |   0.1 % |       73.0 M€ |       47.6 M€ |          32.4 |
| balanced |    2500 |    0.2 % |  4.9 % | 94.5 % |  0.4 % |   5.2 % |      216.7 M€ |       80.8 M€ |          32.8 |
| cautious |    2500 |    1.0 % | 17.8 % | 76.2 % |  5.0 % |  18.4 % |      546.4 M€ |      151.0 M€ |          33.6 |

## Taux de faillite par phase

| Bot      | GARAGE |  SEED | SERIES_A | UNICORN |
| -------- | -----: | ----: | -------: | ------: |
| random   |  4.7 % | 7.1 % |    5.2 % |   0.0 % |
| shipper  |  0.5 % | 0.2 % |    0.2 % |   0.0 % |
| balanced |  0.0 % | 0.0 % |    0.1 % |   0.0 % |
| cautious |  0.9 % | 0.1 % |    0.0 % |   0.0 % |

## Cartes les plus tirées

- `friday-prod-down` : 54442
- `legacy-php` : 21210
- `button-color-meeting` : 16304
- `coffee-machine-broken` : 15693
- `standup-one-hour` : 15617
- `dev-wants-raise` : 15275
- `framework-of-the-week` : 13754
- `wifi-down` : 13097
- `code-review-war` : 13034
- `works-on-my-machine` : 12885
- `weekend-hackathon` : 12724
- `birthday-cake` : 12497
- `investor-blockchain` : 12108
- `it-is-dns` : 11771
- `aircon-war` : 11716

## Cartes jamais tirées (0)

Aucune.

## Cartes à surveiller (2)

- `coffee-machine-dead` : un choix écrase les autres (écart de score 9.9)
- `legacy-php` : choix 2 : valorisation finale ×2.05 par rapport aux autres choix (trop fort ?)

## Succès débloqués par les bots

Les bots ne jouent pas comme un humain : ce taux sert à repérer un succès impossible (0 %) ou trop facile pour sa difficulté.

| Succès                 | Difficulté | Secret | Parties |
| ---------------------- | ---------- | ------ | ------: |
| `this-is-fine`         | EASY       | oui    |  18.4 % |
| `duck-lead`            | EASY       | oui    |   7.7 % |
| `bobby-tables`         | MEDIUM     | oui    |   2.3 % |
| `zero-meeting`         | MEDIUM     |        |  78.7 % |
| `web3-bro`             | EASY       | oui    |   5.1 % |
| `log-scale`            | EASY       | oui    |  57.2 % |
| `office-dog`           | EASY       | oui    |  59.4 % |
| `black-friday`         | LEGENDARY  |        |   0.9 % |
| `debt-free-unicorn`    | HARD       |        |   5.3 % |
| `hello-world`          | EASY       |        | 100.0 % |
| `feature-factory`      | MEDIUM     |        |  95.1 % |
| `clean-coder`          | MEDIUM     |        |  72.8 % |
| `first-check`          | EASY       |        |  96.7 % |
| `unicorn`              | HARD       |        |   6.0 % |
| `decacorn`             | LEGENDARY  |        |   0.0 % |
| `ding-ding`            | HARD       |        |   5.8 % |
| `acquired`             | MEDIUM     |        |  81.6 % |
| `bankrupt`             | EASY       |        |   4.8 % |
| `zombie`               | MEDIUM     |        |   7.9 % |
| `founder-control`      | LEGENDARY  |        |   3.1 % |
| `burnout-factory`      | HARD       | oui    |   0.0 % |
| `big-team`             | HARD       |        |   0.0 % |
| `restructuring`        | MEDIUM     |        |   0.0 % |
| `hallucination-nation` | MEDIUM     |        |  32.3 % |
| `decaf`                | MEDIUM     |        |   6.0 % |
| `million-users`        | HARD       |        |  30.9 % |
| `crisis-manager`       | MEDIUM     |        |  91.8 % |
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
| `bug-squasher`         | MEDIUM     |        |  53.4 % |
| `series-a`             | MEDIUM     |        |  88.7 % |
| `hype-train`           | HARD       |        |  10.0 % |
| `homegrown`            | MEDIUM     |        |  49.0 % |
| `scale-up`             | MEDIUM     |        |  62.5 % |
| `war-chest`            | MEDIUM     |        |  60.7 % |
| `great-place`          | MEDIUM     |        |  75.1 % |
| `kind-boss`            | MEDIUM     |        |  66.5 % |
| `speedrun`             | LEGENDARY  |        |   0.6 % |
| `gotta-catch`          | LEGENDARY  |        |   2.1 % |
| `skynet`               | MEDIUM     | oui    |  32.4 % |
| `beard-council`        | MEDIUM     | oui    |  58.3 % |
| `rust-cult`            | EASY       | oui    |  81.3 % |
| `friday-deploy`        | EASY       | oui    |  90.0 % |
| `office-romance`       | EASY       | oui    |  89.2 % |
| `cold-war`             | MEDIUM     | oui    |  37.1 % |
| `sovereign-debt`       | MEDIUM     | oui    |  30.3 % |
| `revolving-door`       | HARD       | oui    |  17.8 % |
| `garage-bankrupt`      | MEDIUM     | oui    |   1.5 % |
| `close-call`           | HARD       | oui    |   1.7 % |
| `yolo`                 | HARD       | oui    |  24.8 % |
| `lone-wolf`            | LEGENDARY  | oui    |   2.3 % |
| `google-campus`        | HARD       | oui    |   0.0 % |
| `ghost-company`        | LEGENDARY  | oui    |   0.0 % |
