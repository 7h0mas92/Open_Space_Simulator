# État d'avancement : Simulation, économie, tâches et temps

> Fonctionnalités livrées dans `develop` (anciennement « ÉTAT D'AVANCEMENT » de `CLAUDE.md`). Ajouter une puce ici à chaque fusion. Index : [`CLAUDE.md`](../../CLAUDE.md).

- Équilibrage des jauges sur toute la partie (`packages/shared/src/sim/balance.ts`), rapport
  dans `docs/balance.md`.
- Horloge continue : la simulation garde son pas de 30 min (replays, Daily, sauvegardes
  inchangés) mais l'heure, la barre de sprint et l'éclairage défilent minute par minute
  (`packages/client/src/view/liveTime.ts`). Un sprint dure environ 5 min à x1
  (`GAME.sprintRealSecondsAtX1` = 300).
- Calendrier et saisons (`packages/shared/src/sim/calendar.ts`) : la partie commence le lundi de
  la semaine réelle (date dans la graine), 12 périodes d'environ une semaine (Nouvel An,
  Saint-Valentin, Pâques, Espace, Moyen Âge, Super-héros, Années 80, Été, Pirates, Halloween,
  Cyberpunk, Noël) avec 24 cartes de saison prioritaires. Décorations par thème en Three.js
  (`render/decorations.ts`, `view/decor.ts`) aux murs et sur les bureaux, plus aucune au sol
  (objets fantômes ni déplaçables ni rangeables, retirés le 17 octobre 2026), réglées dans
  l'onglet « Décorations » du back-office : désactivé, en saison (défaut) ou toujours ; table
  `DecorTheme`.
- Vraies pauses (`BALANCE.breaks`, `scheduledBreak` dans `simulation/systems/activity.ts`) :
  10h30, déjeuner 12h (1 h), 15h, un dev sur deux décalé de 30 min ; café, babyfoot ou balade en
  cuisine selon le caractère (activités `BREAK` et `LUNCH`). Rendu (`ai/agents.ts`) : marche à
  8 cases/s, arrivée directe au bureau le matin, activité affichée menée à son terme
  (`MIN_STAY_STEPS`), personnages bloqués qui se faufilent.
- Filiales (panneau « Investir », dès la Série A) : 3 projets par planification (prudent,
  audacieux, moonshot), au plus 3 filiales, 6 mois de salaires toujours gardés en caisse. Chaque
  filiale donne une aile au bureau (incubateur) et +2 places dans l'équipe ; 80 % de ses parts
  comptent dans la valorisation, dividendes, revente à 90 %, vente d'urgence avant la faillite.
  Hasard sur une graine à part : une partie sans filiale reste identique (replays, Daily).
  6 cartes « filiales », 4 succès, bot « investor » dans `pnpm balance`
  (`packages/shared/src/sim/ventures.ts`, `client/src/simulation/ventures.ts`).
- Demandes d'augmentation (`BALANCE.raises`, `client/src/simulation/raises.ts`) : tous les 5 à 10
  sprints, avec au moins 3 devs, 60 % de chance qu'un dev (plutôt un gros ego) demande +10 à 20 %
  pendant la planification ; fenêtre de décision qui bloque le lancement du sprint. Accepté :
  salaire relevé, +20 moral, 2 compétences +1. Refusé : 50 % de démission (départ 2 planifications
  plus tard, badge dans l'équipe), sinon -15 moral et 2 compétences -1. Commande `ANSWER_RAISE`,
  hasard sur une graine à part, état `raises` par défaut pour les anciennes sauvegardes.
- Levées de fonds (`shared/sim/pitch.ts`, `shared/sim/funding.ts`, panneau « Lever des fonds ») :
  6 tours de plus en plus durs (Seed à pré-IPO : 3 à 5 questions, 3 à 4 réponses, barre plus
  haute, bluffs démasqués plus souvent, gros fonds, départ de l'investisseur dès la Série B) ;
  question par manche, réponse hors sujet pénalisée, jauge d'intérêt et réactions. Business
  angels, prêt bancaire, financement participatif, subvention (`TAKE_FINANCING`, état
  `financing`, sans hasard). Questions et bluffs sur une graine à part. Bot « financier ».
  Affichage fidèle : le panneau donne les chances estimées du prochain tour
  (`estimatePitchChance`, calée sur des milliers de pitchs simulés, écart de moins de 5 points
  par tranche de 10 %) et la force de chaque thème (`categoryStrengths`) ; pendant le pitch,
  chaque argument montre sa force face à cet investisseur et à la question (▲ fort, ● moyen,
  ▼ faible, `pitchRating`), la jauge dont il dépend (`argumentBasis`) et 🎲 s'il est aléatoire ;
  la jauge s'appelle « Chance de signer » (c'est la vraie probabilité). Rendu seulement :
  `pnpm balance` inchangé.
- Pause pendant les cartes d'événement : le temps s'arrête (❚❚ allumé, personnages immobiles)
  tant que la carte est ouverte, puis la vitesse d'avant reprend (`engine/host.ts`,
  `holdForEvent`) ; pas en Hardcore ni en replay. Le focus va sur la carte, pas sur un choix.
- Tâches dynamiques (`shared/sim/taskFlow.ts`, `client/src/simulation/taskFlow.ts`) : backlog
  jusqu'à 2,5 idées par dev ; urgences avec délai en heures ouvrées, message et bandeau rouge
  (« Réparer la prod » à chaque panne, 5 autres au hasard à 10h, plus fréquentes avec l'équipe),
  servies en premier, bonus à temps, pénalité ratée ; 1 à 3 tâches de la semaine le lundi 9h, dues
  vendredi 18h ; objectif de sprint (4 sprints sur 10 dès le 2e, facile, moyen ou difficile,
  récompense à la démo) affiché en haut du Kanban. Seule la récompense propre compte pour ces
  tâches. Hasard sur une graine à part (`seed#tasks#…`), champs `kind`, `objective` par défaut.
- Tâches par métier (`ROLE_TRADE`, `TASK_TRADES` dans `shared/sim/components.ts`) : Code (6 profils),
  Design (designeuse), Produit (PO). Le backlog suit les effectifs de chaque métier (tirage seulement
  si l'équipe a plusieurs métiers) ; 21 tâches design et produit (8 features) ; l'assignation
  automatique ne donne une tâche qu'au bon métier, urgences d'abord (urgences et tâches de la
  semaine = code) ; confiée à la main hors métier, elle avance à 60 %
  (`BALANCE.work.offTradeMultiplier`). Bouton « Tout en À faire » (`MOVE_ALL_TO_TODO`). Champ
  `trade` optionnel (code par défaut). Effet sur `pnpm balance` : plus de licornes pour les bons bots
  (le PO ne prend plus les urgences), faillite inchangée.
- Variété des tâches du Kanban (`client/src/simulation/taskTitles.ts`, catalogues dans
  `client/src/simulation/data/tasks.ts`) : 114 titres de code de base, 28 débloqués par phase
  (`GROWTH_TASK_TITLES` : Seed, Série A, Licorne), 48 de saison (`SEASON_TASK_TITLES`, une tâche de
  code sur trois pendant la période), 23 pour la designeuse et 22 pour le PO ; 11 urgences et 12
  tâches de la semaine. Jamais deux fois le même titre sur le tableau, les 60 derniers ne reviennent
  pas tant qu'il en reste de neufs (état `recentTaskTitles`, vide par défaut). Le titre est
  décoratif et ne consomme aucun tirage de plus dans le générateur de la partie.
- Difficulté des modes (`shared/sim/difficulty.ts`, `difficultyOf(mode)`) : un profil de
  multiplicateurs par mode remplace `BALANCE.easy`. Facile : 2,2 M€ au départ, effets négatifs des
  cartes -15 %, autant de cartes qu'en Normal. Hardcore : 1,5 M€, dépenses +15 %, revenus -15 %,
  4 cartes au plus par sprint (tirage x1,5), effets négatifs +30 %, pannes +50 %, barre des
  investisseurs +0,3 (`pitchBar` dans `simulation/fundraising.ts`). Normal, Daily, Stagiaires Only
  et 3 sprints au profil neutre : mêmes parties qu'avant. Rapport `pnpm balance` : section
  « Difficulté par mode et par stratégie », 700 parties par autre mode. Faillite Hardcore 32 %
  (bons bots 7 à 20 %, licorne 2 à 4 %) ; Facile proche du Normal, un peu plus indulgent. Les
  replays des anciens scores Facile et Hardcore ne rejouent plus à l'identique.
- Saleté et ménage (`shared/sim/cleaning.ts`, `client/src/simulation/cleaning.ts`, bouton 🧹 en
  haut, panneau « Ménage », `ui/cleaning/Cleaning.tsx`) : chaque jour de semaine, l'équipe présente
  salit le bureau (0 à 100 %, de plus en plus vite sans ménage, chats compris) ; un dev sur place
  perd jusqu'à 40 % de travail (-20 % à 50 %, `dirtProductivity`), pas les télétravailleurs, le Dev
  Fantôme ni l'IA Agent ; alerte à 50 %. Entreprise de nettoyage Nickel Chrome (Fatou, Jean-Marc,
  Lucía) : appel le soir à 19h ou en express (`CALL_CLEANING`, payé à la réservation), ou
  abonnement « Ménage » du modèle commun (service `cleaning`, 3 offres de 1 à 5 soirs par semaine).
  Prix selon la phase et les ailes ou annexes (`PRICE_RULES` dans `simulation/subscriptions.ts`).
  Déchets en InstancedMesh placés par hachage de la graine et 3 agents animés en A*
  (`render/cleaning.ts`, formes des assets manquants). État `cleaning` par défaut, aucun tirage ;
  règle qui change toutes les parties (anciens replays de scores divergent).
- Panneau « 💶 Business » (`ui/business/Business.tsx`), trois leviers économiques :
  - Modèle économique (`shared/sim/pricing.ts`, `client/src/simulation/pricing.ts`) : gratuit
    avec pub, freemium, abonnement, achat unique, au prix bas, standard ou premium ; coefficients
    de revenu par utilisateur, d'arrivées, de départs et de valeur pour les investisseurs
    (`userValue`), achat unique encaissé à l'arrivée. Hausse de prix : 12 % d'utilisateurs perdus
    par doublement (35 % au plus), -5 hype ; baisse +3 hype. Un changement par sprint (`COOLDOWN`).
    Freemium standard = tous les coefficients à 1, parties qui n'y touchent pas inchangées.
    Commande `SET_PRICING`, état `pricing` par défaut, aucun tirage.
  - Clients B2B (`shared/sim/clients.ts`, `client/src/simulation/clients.ts`) : 3 offres par
    planification sur `seed#clients#sprint`, 16 entreprises inventées, petit, moyen ou gros
    contrat, besoin en points de features, d'infra ou de bugfix avant une échéance (1 à 4 contrats
    en cours selon la phase). Prime à la signature, forfait mensuel, livraison à la démo (prime,
    utilisateurs, hype), puis 6 sprints de maintenance à 25 % du forfait. SLA : pénalité à chaque
    panne, départ après 3 ; échéance ratée ou rupture : pénalité et -6 hype. Commandes
    `SIGN_CLIENT` / `DROP_CLIENT`, état `clients` par défaut ; sans contrat, partie inchangée.
  - Support client (`shared/sim/support.ts`, `client/src/simulation/support.ts`) : tickets chaque
    jour ouvré, 3 x √(utilisateurs / 1 000) x (1 + dette + instabilité) ; agents (3 500 € par mois,
    30 tickets par jour, 1 à 25 selon la phase) et devs de garde (10 ou 25 % de leur temps).
    Satisfaction de 0 à 100 selon l'attente : sous 60, jusqu'à +60 % de départs ; au-dessus de
    80, +6 % de croissance et un peu de hype. Commande `SET_SUPPORT`, état `support` par défaut,
    aucun tirage ; règle qui change toutes les parties (anciens replays de scores divergent).
    Bot planner : `sensibleSupportAgents`.
- **Charge du sprint selon l'équipe** (`client/src/simulation/sprintLoad.ts`) : 3 idées par
  personne qui prend des tâches et par sprint (`TASK_FLOW.ideasPerDev`, l'encadrement ne compte
  pas), backlog jusqu'à 4 par dev. Chaque matin de semaine à 9h, le rythme de chaque métier depuis
  le début du sprint (`tracker.workByTrade`) est comparé au travail restant : s'il manque de quoi
  tenir jusqu'à la démo, des tâches passent du backlog au « À faire », sinon de nouvelles idées
  sont créées (`TODO_TOPPED_UP`) ; à 14h, un dev qui attend sans tâche en reçoit une. Au 6e jour
  ouvré, une équipe nettement en retard est prévenue (`SPRINT_BEHIND`), rien n'est retiré. Ligne
  au-dessus du Kanban : équipe, tâches finissables d'ici la démo, tâches prévues. Les devs ne
  chôment plus (avant : environ 60 % du temps sans tâche), donc tâches du backlog plus longues
  (`BALANCE.work.unitsPerPoint` 5 → 14, urgences et hebdo à 5) et chaque point livré pèse moins
  (`BALANCE.work.pointEffect` 0,13). Nouvelles idées sur `seed#tasks#topup#…` ; règle qui change
  toutes les parties (anciens replays de scores divergent). 192 titres de plus
  (`data/moreTasks.ts`, 439 au total), 5 urgences et 5 tâches de la semaine de plus, 150 titres
  récents gardés.

- Prix hebdo de la fibre calculé comme les autres abonnements (×12/52) ; besoin du client affiché sur sa fiche ; graines annexes via `sideRng` ; règles par mode dans `MODE_RULES` (#171).
