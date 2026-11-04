# État d'avancement : Équipe : devs, métiers, vie de l'équipe

> Fonctionnalités livrées dans `develop` (anciennement « ÉTAT D'AVANCEMENT » de `CLAUDE.md`). Ajouter une puce ici à chaque fusion. Index : [`CLAUDE.md`](../../CLAUDE.md).

- Télétravail automatique chaque matin de semaine (bureau manquant, épuisement, conflit, café
  vide pour les accros, Dev Fantôme toujours) : -15 % de vitesse, -5 % de qualité, moins de
  fatigue.
- Anniversaires des devs (date tirée de la graine, sans toucher au RNG) : table de fête
  décorative (gâteau, cadeaux, ballons), +moral, confettis, Slack ; le week-end, fête le lundi.
- Performance des devs (`client/src/simulation/performance.ts`, composant ECS `performance`) :
  note globale S à D mesurée sur les 2 derniers sprints, productivité par sprint côte à côte
  dans la fiche (100 % = un dev standard), ancienneté, XP, tâche en cours, allié et bête noire ;
  au recrutement, performance estimée, salaire du marché et chances d'acceptation de l'offre.
- Filtres de l'équipe (`client/src/ui/team/filters.ts`, `TeamFilterBar.tsx`) : filtres cumulables
  (note S à D, en conflit, fatigué, moral bas, télétravail, au bureau, métier) et tri
  (performance, moral, énergie, conflits, salaire, ancienneté, nom), gardés dans le store
  (`teamFilters`) ; chaque ligne affiche ⚔️ et le nombre de conflits. Lecture seule de la GameView.
- Congés, jours fériés et arrêts maladie (`shared/sim/teamLife.ts`, `client/src/simulation/teamLife.ts`,
  bloc « Congés » de la fiche d'un dev, `ui/team/Leave.tsx`) : 11 jours fériés français (Pâques
  calculé), personne au bureau ce jour-là. 1 jour de congé par sprint dès le 2e (10 au plus), posé
  en planification sur la 1re ou la 2e semaine (1 à 5 jours, 1 dev absent pour 4 en même temps) :
  +4 moral par jour au retour (20 au plus). Réserve pleine : -1 moral par jour, et après 2 sprints
  le dev pose 5 jours tout seul. Ponts de mai (vendredi après un jeudi férié, lundi avant un mardi
  férié) : faits par défaut, refusés en un clic (-5 moral pour tous). Arrêt maladie de 1 à 3 jours
  (0,5 % par jour, double l'hiver, moins avec l'endurance). Moral à 0 : arrêt de 10 jours ouvrés
  pour burn-out au lieu de la démission, retour à 40 de moral ; rechute dans les 10 sprints :
  démission. Un absent n'a ni tâche ni bureau, filtre 🏖️ de l'équipe. Commandes `BOOK_LEAVE`,
  `CANCEL_LEAVE`, `REFUSE_BRIDGES`, état `teamLife` (null pour les anciennes sauvegardes et le défi
  3 sprints = comportement d'avant), hasard sur `seed#leave#jour`. 2 succès, bot « rested ».
- Rétrospective de sprint (`shared/sim/retro.ts`, `client/src/simulation/retro.ts`, fenêtre
  « Rétrospective » en planification dès le 2e sprint) : 3 actions proposées selon les problèmes du
  sprint écoulé (dette, pannes, urgences ratées, café, fatigue, conflits, réunions…) parmi 10 (plus
  de tests, revue de code, café en libre-service, médiation, astreinte, horaires souples, petits
  tickets, mercredi sans réunion, kudos, continuer comme ça). Chaque dev vote selon son profil et
  son caractère (`seed#retro#sprint`). Suivre le vote : +3 moral pour tous ; imposer autre chose :
  -3 pour ceux qui ont voté autrement ; passer la rétro ne coûte rien. L'action dure un sprint
  (🔁 dans le HUD). Commande `HOLD_RETRO`, état `retro` (vide par défaut), bot « retro ».
- Team building (`shared/sim/teamBuilding.ts`, `client/src/simulation/teamBuilding.ts`, bloc
  « 🎉 Team building » du panneau Équipe, `ui/team/TeamBuilding.tsx`) : une sortie par sprint,
  réservée et payée en planification (prix par participant, sans Dev Fantôme ni IA Agent), en fin
  de 2e semaine. Afterwork (40 €, jeudi 18h, aucune heure perdue, -15 énergie), escape game (90 €,
  vendredi 14h, +25 d'affinité pour les paires en conflit, 15 % de chance que ça empire), laser
  game (70 €, Seed, gros egos perdants qui boudent), séminaire au vert (600 €, Série A, journée,
  +énergie, +hype), off-site à Lisbonne (2 500 €, Licorne, 2 jours, +hype, -dette). Effets à 18h le
  dernier jour (moral selon le caractère, affinités) ; même sortie deux sprints de suite : moitié
  moins de moral ; annulation remboursée à 50 %. Hasard sur `seed#teambuilding#sprint`. Commandes
  `BOOK_TEAM_BUILDING` / `CANCEL_TEAM_BUILDING`, état `teamBuilding` (vide par défaut), 2 succès,
  bot « teambuilder ».
- Équipe web (`shared/sim/teamRoles.ts`, `client/src/simulation/leadership.ts`) : 10 métiers en
  plus des 8 profils (`WEB_ROLES`). Devs Front, Back et Fullstack : côté de la tâche déduit du
  titre anglais (mots-clés puis hachage, sans tirage), `BALANCE.stacks` (1,15 de son côté, 0,6 de
  l'autre, fullstack 0,85, spécialité x1,2 sur son type de tâche), `identity.specialty` optionnelle.
  Tech Lead (-15 % de dette des features), DevOps (+stabilité par jour), testeurs QA (métier `QA`,
  12 tâches de recette, -10 % de dette par testeur, 30 % au plus). Encadrement sans tâches
  (`ROLE_TRADE` à null) : scrum master, managers (1 pour 6), sous-directeur, directeur technique,
  effets dans `BALANCE.leadership`. Postes ouverts selon l'équipe et la phase (`roleLimit`), bloc
  « Encadrement » du panneau Équipe. 3 candidats habituels inchangés + 2 de l'équipe web sur
  `seed#web-roles#sprint` (replays, Daily, sauvegardes inchangés). `pnpm balance` : faillite
  inchangée, licornes réparties autrement, car les bots ne savent pas composer une équipe web.
- Arbre de compétences des devs (`shared/sim/skills.ts`, `client/src/simulation/skills.ts`, onglet
  « Compétences » de la fiche, `ui/team/SkillTree.tsx`) : 1 point par niveau, 3 branches de 5 nœuds
  qui demandent chacun le précédent (Technique : code propre -10 % de dette, débogueur, architecte,
  revue de code -5 % de dette des features de l'équipe, gardien de la prod x2 sur « Réparer la
  prod » ; Vitesse : raccourcis +5 %, concentration, deep work le matin, fin de sprint, Crunch
  +50 % pendant 24 h et -10 moral une fois par sprint ; Humain : endurance -15 % de fatigue,
  diplomate, mentor +20 % d'XP aux collègues, bonne humeur, leader : plus de démission à moral 0).
  Un nœud de métier par profil qui code (demande le 3e nœud de sa branche) ; l'encadrement n'a pas
  d'arbre. Formations en planification (livre 500 €, formation 2 000 €, conférence 5 000 €, une
  par dev et par sprint, niveaux gagnés sans tirer de statistique), réinitialisation pour un mois
  de salaire. Ouvert partout sauf en Daily (`skillsEnabled`). Commandes `LEARN_SKILL`,
  `RESET_SKILLS`, `TRAIN_DEV`, `USE_CRUNCH`, composant ECS `skills` (vide par défaut), stats
  `skillsLearned`, `trainings`, `crunches`. Aucun tirage : sans compétence, chaque multiplicateur
  vaut 1 (48 parties de 4 modes comparées à `develop`, état identique) ; une compétence qui change
  une probabilité garde le même tirage. Bot « coach » dans `pnpm balance`.
