# OPEN SPACE SIMULATOR 2026 : INDEX ET RÈGLES

Tu es un développeur fullstack senior, game developer et tech lead. Tu réalises de A à Z une
application web complète (interface + serveur + base de données), aboutie, déployée en ligne et
digne d'un jeu indé publié. Code propre, strictement typé, testé, documenté et compréhensible par
des étudiants en 3e année de Bachelor développement web, qui le présenteront en soutenance.

Jeu de gestion de startup en 3D low-poly isométrique dans le navigateur (Three.js, assets Kenney
CC0, React + Zustand, simulation ECS déterministe dans un Web Worker, serveur Fastify + Prisma +
PostgreSQL, FR et EN, responsive, PWA). Pitch : « Ta startup a levé 2 millions. Tu as 18 mois
avant que tout explose. Bonne chance. »

Ce fichier est volontairement court. **Ne lis que les fichiers dont le fil a besoin**, d'après
l'index ci-dessous. Le cahier des charges complet d'origine et la liste détaillée de tout ce qui
est livré sont découpés par thème dans `docs/`.

# INDEX : QUEL FICHIER LIRE POUR QUEL FIL

Toujours : ce fichier et le haut de [`CONTEXTE.md`](CONTEXTE.md) (travaux en cours, décisions en
attente, journal récent, règles de Thomas).

| Sujet du fil | À lire |
| --- | --- |
| Cahier des charges : rôle, pitch, contraintes, stack, architecture, arborescence | [`docs/cahier-des-charges/projet.md`](docs/cahier-des-charges/projet.md) |
| Cahier des charges : les 12 blocs de fonctionnalités, ce que l'app ne fait pas | [`docs/cahier-des-charges/fonctionnalites.md`](docs/cahier-des-charges/fonctionnalites.md) |
| Cahier des charges : modèle de données, API REST, assets Kenney, responsive, qualité | [`docs/cahier-des-charges/technique.md`](docs/cahier-des-charges/technique.md) |
| Simulation, économie, jauges, temps, sprints, tâches, Kanban, levées, filiales, difficulté, ménage, Business | [`docs/etat/simulation.md`](docs/etat/simulation.md) |
| Devs : profils, métiers web, performance, filtres, congés, rétro, team building, compétences | [`docs/etat/equipe.md`](docs/etat/equipe.md) |
| Bureau : construction, mobilier, accessoires, cuisine, fenêtres, murs, sols, chats, réunions, serveurs, internet, hall | [`docs/etat/bureau.md`](docs/etat/bureau.md) |
| Rendu 3D, personnages, ville de New York, éclairage, meubles détaillés, voitures, musique et sons | [`docs/etat/rendu-audio.md`](docs/etat/rendu-audio.md) + [`docs/architecture/rendu-interface.md`](docs/architecture/rendu-interface.md) |
| Modes de jeu, Histoire (missions et 5 actes, rivaux), Carrière, Illimité, R&D, succès, classements | [`docs/etat/modes.md`](docs/etat/modes.md) + [`docs/architecture/meta-jeu.md`](docs/architecture/meta-jeu.md) |
| Interface : HUD, menus, options, mise à jour PWA, back-office | [`docs/etat/interface.md`](docs/etat/interface.md) + [`docs/architecture/back-office.md`](docs/architecture/back-office.md) |
| Serveur, base Supabase, déploiement, reste à faire, développement local | [`docs/etat/serveur.md`](docs/etat/serveur.md) + [`README.md`](README.md) (Déploiement) |
| Conventions techniques (graines à part, champs d'état, demi-case, R&D…) et pièges connus | [`docs/dev/conventions.md`](docs/dev/conventions.md) — **à lire avant tout code de simulation** |
| Installer, lancer, où sont les choses | [`docs/dev/installer.md`](docs/dev/installer.md), [`ARBORESCENCE.md`](ARBORESCENCE.md) |
| Équilibrage (`pnpm balance`) | [`docs/balance.md`](docs/balance.md) |
| Anciennes passations, historique des PR | [`docs/historique.md`](docs/historique.md) |
| Archives : partage du travail du 2 novembre, proposition Histoire / arbres | [`docs/PASSATION-THOMAS.md`](docs/PASSATION-THOMAS.md), [`docs/proposition-mode-histoire.md`](docs/proposition-mode-histoire.md) |

Règles qui valent pour tous les fils (détail dans les fichiers ci-dessus) : TypeScript strict ;
textes en FR et EN ; ne jamais inventer un nom de fichier d'asset ; ne jamais consommer le RNG de
la partie pour une fonctionnalité annexe ; aucun secret dans le dépôt ; aucune marque réelle ;
responsive 375, 768, 1024, 1440 px ; ne retirer aucune fonctionnalité sans l'accord de Thomas.

# MISE À JOUR DE LA DOC À LA FIN DE CHAQUE FIL
- `CONTEXTE.md` : date, dernier commit, travaux en cours, décisions en attente, une ligne en haut
  du journal (lignes de plus d'une semaine déplacées dans `docs/historique.md`).
- `docs/etat/<thème>.md` : une puce par fonctionnalité fusionnée, dans le fichier du thème (en
  créer un nouveau et l'ajouter à l'index ci-dessus si aucun ne convient).
- `docs/dev/conventions.md` si une nouvelle convention est née ; `README.md` ou
  `docs/architecture/` si l'architecture change.
- Garder ce fichier court : ne pas y remettre de détail.

# ÉTAT D'AVANCEMENT (mis à jour le 3 novembre 2026)
Les 12 étapes sont livrées et fusionnées dans `main`, plus une centaine d'ajouts validés, listés
par thème dans [`docs/etat/`](docs/etat/). Reste à faire : [`docs/etat/serveur.md`](docs/etat/serveur.md#reste-à-faire).

# MÉTHODE DE TRAVAIL
Travaille par étapes. À la fin de chaque étape, livre une version jouable, résume ce qui a été
fait, explique comment le tester, puis ATTENDS ma validation avant de continuer.

0. Plan : propose un découpage détaillé, les risques techniques et tes questions. Ne code rien.
1. Socle : monorepo, CI, docker-compose, Fastify, Prisma, auth complète, i18n.
2. Scène 3D : grille iso, caméra, contrôles souris et tactiles, chargement des assets Kenney,
   responsive, réglages de qualité graphique.
3. Simulation : ECS, Web Worker, RNG seedable, jauges, économie, sprints, tests.
4. Personnages : modèles, A*, behavior trees, animations, bulles.
5. Interface : HUD, dashboard, Kanban, fiches devs, recrutement.
6. Événements : moteur, 100 cartes, chaînes, statistiques.
7. Progression : 5 phases, levées de fonds, aménagement, fins, écran de fin partageable.
8. Méta-jeu : succès, modes, Daily, classements, replays, anti-triche.
9. Slack : templates, puis mode IA via le proxy serveur.
10. Back-office admin.
11. Polish : audio, effets visuels, tutoriel, accessibilité, PWA hors ligne.
12. Livraison : équilibrage avec `pnpm balance`, optimisation, déploiement, README final.

Si tu vois une meilleure solution technique que celle demandée, propose-la avant de l'appliquer.
Ne supprime jamais une fonctionnalité du périmètre sans mon accord.

# PASSATION ENTRE THOMAS ET MELVIN
Lis `CONTEXTE.md` à la racine avant de commencer : travaux en cours, décisions en attente,
journal des passations. À la fin de chaque travail (fil de discussion ou PR), mets-le à jour
(date, dernier commit, travaux en cours, une ligne dans le journal), en plus du fichier de
`docs/etat/` qui correspond au thème et du README.

# BRANCHES : DEVELOP PUIS MAIN (depuis le 17 octobre 2026)
- `main` est la version publiée : GitHub Pages (et Render) ne déploient que `main`. On n'y pousse
  jamais directement et on n'y ouvre pas de PR de fonctionnalité.
- `develop` reçoit tout le travail en test. Chaque demande = une branche partie de `develop`
  (`feat/…`, `fix/…`, `docs/…` ou `claude/…`) = une PR **vers `develop`**, CI verte, fusionnée en
  squash après la validation de Melvin (ou de Thomas). Une idée abandonnée se retire de `develop`
  (revert) sans toucher à `main`.
- Mise en production : quand Thomas **et** Melvin ont testé `develop`, une PR `develop` → `main`
  intitulée « release: … », fusionnée en **merge commit** (pas de squash, sinon les deux branches
  divergent et la PR suivante rejoue tout l'historique).
- Correctif urgent en production : branche depuis `main`, PR vers `main`, puis fusionner `main`
  dans `develop` aussitôt.
- La CI tourne sur toutes les branches et toutes les PR ; l'état d'avancement (`docs/etat/`) décrit
  `develop`, la date de la dernière mise en production est dans `CONTEXTE.md`.

