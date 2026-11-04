# État d'avancement : Modes de jeu, Histoire, Carrière, R&D, succès, classements

> Fonctionnalités livrées dans `develop` (anciennement « ÉTAT D'AVANCEMENT » de `CLAUDE.md`). Ajouter une puce ici à chaque fusion. Index : [`CLAUDE.md`](../../CLAUDE.md).

- Mode Facile et tutoriel adapté à chaque mode ; zoom trackpad progressif ; défilement de la
  caméra au bord de l'écran.
- 70 succès avec difficultés, dont 22 secrets (nom visible, condition « ??? »).
- Mode illimité (`ENDLESS`, `shared/sim/endless.ts`) : pas de fin au 39e sprint, la partie dure tant
  que la trésorerie tient (IPO et rachat toujours possibles). Après 18 mois, la concurrence monte à
  chaque sprint : frais fixes x(1 + 4 % p + 0,4 % p²) (`fixedCosts` dans `economy.ts`), churn
  +0,004 % par jour et par sprint, levées divisées par (1 + 5 % p) (`maxRaise`), message
  `COMPETITION_RISES` tous les 13 sprints. 18 premiers mois identiques au Normal (même graine), aucun
  tirage en plus. `totalSprints` = 9999 (`ENDLESS.sprintCap`), HUD « Sprint n » sans total, phrase de
  fin avec les sprints tenus, 3 succès (2, 3, 5 ans), 2 étapes du tutoriel. Bots : ils ne vendent pas
  en illimité et tiennent de 76 à 300 sprints. Serveur : valeur `ENDLESS` de l'enum (migration
  `20261017150000_endless_mode`), classement par sprints tenus puis valorisation.
- Classement des meilleures entreprises (`ui/meta/Leaderboard.tsx`) au menu et en jeu (🏆 dans les
  boutons système, panneau `leaderboard`, sans replay en jeu) : « En ligne » ou « Sur cet appareil »
  (`save/localScores.ts`, 50 parties gardées par mode, invité et sans serveur ; ouvert par défaut
  quand le serveur ne répond pas). Nom d'entreprise tiré de la graine (`companyName` dans
  `shared/meta/company.ts`, hachage, sans tirage), champ `company` du `ScoreDto`, aussi sur l'écran
  de fin et l'image partagée. Ordre commun `compareGames` (`shared/meta/leaderboard.ts`) ; le global
  exclut Facile et Illimité (`GLOBAL_EXCLUDED_MODES`).
- Mode Histoire (`shared/story/`, `client/src/simulation/story.ts`, `ui/story/`, carte « Histoire »
  du menu) : 4 chapitres (Garage, Seed, Série A, Licorne) et 10 missions débloquées l'une après
  l'autre, chacune avec point de départ (phase, caisse, jauges, équipe), objectifs, contraintes et
  durée (3 à 12 sprints) ; panneau « 🎯 Mission » en jeu, objectifs en direct, écran de fin
  (suivante, réessayer, partager), titre de fondateur par chapitre. Mission terminée en « zombie »
  avec `result.mission` (réussie, ou ratée : contrainte, temps, faillite, vente) ; ni classement
  ni succès de fin. Chaque mission débloque une récompense nouvelle pour Facile, Normal et les
  défis, jamais le Daily (`UNLOCK_MODES`) : papiers peints « Plans du garage » et « Mur de
  post-it », sols « Dalles techniques » et « Damier rétro », couleurs Or et Néon, statue de licorne
  et cloche de la Bourse (formes Three.js, `render/storyRewards.ts`), bonus expresso dès le garage
  et carnet d'adresses (+10 hype). Récompenses fixées au départ (`state.unlocks`, vide par défaut),
  champ `unlock` du catalogue, erreur `LOCKED`. Progression sur l'appareil (`save/story.ts`) puis
  sur le compte : `GET /api/story`, `POST /api/story/complete` rejoue la mission (table
  `StoryMission`) ; `POST /api/scores` vérifie et rejoue les récompenses (`Score.unlocks`,
  `UNLOCK_NOT_EARNED`). Champs `story` (null) et `unlocks` ([]) par défaut, aucun tirage de plus.
  Calibrage par les bots : `pnpm balance:story` (chapitre 1 facile, chapitres 3 et 4 difficiles).
- Histoire en 5 actes, socle (T2, PR 1 sur 4 ; `shared/story/acts.ts`, `client/src/simulation/story.ts`,
  `ui/story/CampaignPanel.tsx`) : « Ctrl+Alt+Fonder », une seule longue partie de 60 sprints
  (`STORY_TOTAL_SPRINTS`), lancée par `mission: 'campaign'` (`StoryStart`). 5 actes : Le garage
  (Seed avant le sprint 8), La course (Série A avant le 18), La guerre des prix (Licorne avant le
  48), Le géant (1,5 Md€ avant le 56), La cloche (Bourse ou rachat). Objectif principal rempli :
  acte suivant aussitôt (notification `STORY_ACT`, panneau ouvert) ; date limite dépassée à la
  démo, histoire arrêtée (`result.campaign`, échec `TIME`, `BANKRUPTCY` ou `SOLD` si vendue avant
  « Le géant »). Les 10 missions sont les objectifs secondaires des actes, avec leurs contraintes et
  leurs récompenses ; statistiques comptées depuis le début de l'acte (`statsAtAct`), notification
  `STORY_GOAL`. Chaque objectif rempli part à `POST /api/story/complete` avec `campaign: true` : le
  serveur rejoue l'histoire jusqu'à la dernière commande (`verifyCampaignGoal`). Point de
  sauvegarde par acte sur l'appareil (`storyCheckpoints`, `resumeAct`), repris depuis l'écran
  Histoire ou l'écran de fin. Écran Histoire en 2 onglets : « Histoire » (synopsis, frise et cartes
  des actes) et « Missions » (les 10 missions courtes, gardées jouables : choix de Thomas). Champ
  `story.campaign` optionnel (`missionId` devient optionnel), aucun tirage : les autres modes ne
  changent pas. Calibrage : `pnpm balance:campaign`.
- Rivaux de l'histoire en actes (T2, PR 2 sur 4 ; `shared/sim/rivals.ts`,
  `client/src/simulation/rivals.ts`, panneau « 📈 Marché » `ui/story/MarketPanel.tsx`) : 3 startups
  inventées simulées à chaque démo de la longue partie, sur la graine à part `seed#rival#sprint`.
  Synergix (Bastien Lemaître) dès le prologue, accélère quand le joueur le dépasse (copie, débauche,
  procès) ; Pivotly à la guerre des prix (pivote tous les 2 sprints, casse les prix) ; Gigacorp au
  « Géant », rachète Synergix (clone, pubs, débauche). Croissance logistique, faillite d'un rival
  qui chute sous 50 000 utilisateurs et 30 % de son record. Part de marché : la part des rivaux
  ajoute des départs quotidiens d'utilisateurs (`rivalExtraChurn`). Objectifs `rivalUsers` (La
  course : dépasser Synergix) et `marketShare` (Le géant : 30 % du marché). Panneau Marché : courbes
  des utilisateurs, parts, dernière action ; notifications `RIVAL_ACTION`. Enseignes lumineuses des
  rivaux sur des toits de la ville (`render/rivalTowers.ts`, `rivalTowerSpots` dans `skyline.ts`),
  plus larges avec la part de marché, éclairées la nuit, éteintes à la faillite. État
  `campaign.rivals` et `campaign.usersHistory` (vides par défaut). Hors de l'histoire en actes,
  rien ne change.
- Histoire écrite, fins et Saison libre (T2, PR 3 sur 4 ; `shared/story/scenes.ts`,
  `shared/story/cards.ts`, `ui/story/StoryScene.tsx`, `events/storyCards.ts`) : scènes dialoguées
  (Bastien Lemaître, Mamie Josette, Inès Kader de TechMatin, Hugo l'ami dev, Gigacorp) au lancement,
  au début de chaque acte et à l'entrée en Bourse ; temps arrêté pendant la scène, « Suivant »,
  « Passer », guide masqué, puis objectifs de l'acte. 10 cartes d'histoire hors base et hors tirage
  (poids 0), deux par acte, imposées le mardi 10h d'un sprint fixé de l'acte
  (`STORY_CARD_SCHEDULE`, sans tirage) ; `CardLibrary` les retrouve toujours par identifiant. Effet
  de carte `rivals` (utilisateurs des rivaux en %, optionnel). Slack : SMS de Mamie Josette et
  articles d'Inès Kader sur `STORY_ACT`, `STORY_GOAL`, `STORY_END` et `RIVAL_ACTION`. Deux fins
  écrites : rachat par Gigacorp (fin de partie) ou entrée en Bourse à partir du « Géant », qui
  ouvre la Saison libre (`campaign.freeSeason`, notification `STORY_END`) : plus de date limite,
  pression du mode illimité à partir du sprint de l'entrée en Bourse (`freeSeasonStart`, 3e
  argument des fonctions de `endless.ts`), une nouvelle startup tous les 10 sprints (Quantik,
  Hyperlane, Blitzly), commande `END_STORY` pour finir sur l'entrée en Bourse
  (`result.campaign.freeSeasonSprints`). Écran de fin : scène de la fin, bilan face aux rivaux.
  Aucun tirage sur le RNG de la partie ; hors de l'histoire en actes, rien ne change.
- Équilibrage de l'histoire en actes (T2, PR 4 sur 4) : dates limites 8, 18, 48, 56 et 60 (début
  plus serré, plus de temps pour la Licorne et le Géant), départs d'utilisateurs dus aux rivaux
  divisés par deux (`RIVAL_RULES.dailyChurnPerRivalShare` 0,0006). Bonus d'histoire pour chaque
  objectif secondaire rempli (`STORY_SIDE_BONUS` dans `shared/story/acts.ts` : argent de Mamie
  Josette, hype et utilisateurs grâce aux articles d'Inès, rivaux affaiblis), annoncé par une
  notification `STORY_GOAL`, sans tirage. Bot conteur (`storyteller` dans `simulation/analysis.ts` :
  refuse les rachats avant « Le géant ») et section « Histoire en actes » de `pnpm balance`
  (`--campaign-games 220`) : les bons bots finissent l'histoire dans 40 à 65 % des parties
  (organizer, rested, investor, coach), le hasard jamais ; l'acte qui bloque reste la guerre des
  prix (`docs/balance.md`).
- Arbre R&D des objets (T4 ; `shared/sim/research.ts`, `client/src/simulation/research.ts`, panneau
  « 🔬 R&D » `ui/story/ResearchPanel.tsx`, `view/research.ts`) : dans l'histoire en 5 actes, le
  catalogue démarre réduit (`RESEARCH_FREE` : bureau, bureau IKEA, plantes, cafetière, mug, canard,
  lampe, poubelle, tour et écran bureautiques, mur crème) et se débloque avec des points
  d'innovation : +1 par feature livrée, +3 par objectif secondaire rempli, +2 quand le joueur gagne
  plus d'utilisateurs que chaque rival sur un sprint (comptés à la démo, `researchSprint`), 4 au
  départ. 5 branches de 4 niveaux (Confort, Tech, Ambiance, Cuisine, Organisation ; coûts 4, 8,
  14, 20) : chaque niveau demande le précédent et l'acte correspondant (niveau 1 au garage, 4 dès
  « Le géant ») ; le verrou de phase reste. Chaque niveau débloque des clés `item:`, `computer:`,
  `monitor:` (et `monitor:arm`), `wall:`, `floor:`, `meeting:` ; un test vérifie que tout le
  catalogue est rattaché. Branche Prestige : les récompenses des objectifs (papiers peints, sols,
  couleurs, objets, pas les bonus de départ) s'achètent dès l'objectif rempli dans la partie
  (`prestigeEarned`, lu par `hasUnlock`). Verrou dans chaque achat (erreur `LOCKED`), blocage
  `researchLocked` de `shopStatus`, raison « 🔬 R&D : Tech, niveau 3 » dans le catalogue, les murs,
  les sols, les écrans, les ordinateurs et les salles de réunion. Commande `RESEARCH_NODE`, erreur
  `NOT_ENOUGH_POINTS`, notifications `RESEARCH_POINTS` / `RESEARCH_DONE`, état
  `campaign.research` optionnel (absent des histoires commencées avant : catalogue complet),
  étape « L'arbre R&D » du tutoriel. Aucun tirage : missions courtes et autres modes inchangés.
  Bot de recherche (`researchCommands`) ; `pnpm balance:campaign` affiche les points et niveaux
  (réussite des bots inchangée à ±1 partie sur 20). Choix de Thomas (« le plus logique, tu es
  libre ») : rattachement explicite objet par objet, Prestige par les objectifs ; coûts de 2, 4, 7,
  10 doublés après calibrage. Hall d'entrée et offres internet (fichiers de Melvin) non verrouillés.
- Arbre R&D dans tous les modes (demande de Thomas, « r&d dans tous les modes ») : Normal, Facile,
  Hardcore, Daily, Stagiaires Only, 3 sprints, Illimité et Carrière ont le même arbre, dans
  `state.research` (null dans les missions courtes et les vieilles sauvegardes : tout le
  catalogue). Les niveaux s'ouvrent avec la phase (niveau 2 en Seed, 3 en Série A, 4 en Licorne ;
  `researchStage`, statut `phase`) ; points : +1 par feature livrée, +3 par levée de fonds réussie
  (`RESEARCH.perRound`, compteur `roundsCounted`), +2 par objectif de sprint atteint
  (`perObjective`), 4 au départ. Pas de Prestige hors histoire. Bouton 🔬 dans les boutons système,
  étape « L'arbre R&D » du chapitre Construction du tutoriel, phase affichée avant la R&D dans les
  raisons de verrou. Vinyle et moquette passent au niveau 1 d'Ambiance. Aucun tirage ; règle qui
  change toutes les parties (anciens replays de scores divergent). Tests d'objets : `openCatalogue`
  dans `tests/simulation/fixtures.ts`.
- Mode Carrière (`shared/sim/career.ts`, `client/src/simulation/career.ts`, page « Carrière » du
  menu `ui/career/CareerPage.tsx`, panneau `ui/career/CareerPanel.tsx`) : refaire le parcours de
  8 startups devenues géantes, jamais nommées (Pépin Computer, Matelas & Céréales, Rembobine,
  MicroMou, Trombinoscope, Orénoque, Centillion, Ampère Motors), 3 niveaux de difficulté. Chaque
  légende fixe le départ (trésorerie, hype, dette, profil du premier dev, cofondateur) et 4 jalons
  (phase, utilisateurs, valorisation, levées, features, équipe, stabilité, hype, part du capital
  avant un sprint ou à la fin, dette maximale, issue). Jalons vérifiés à chaque démo, puis jugés à
  la fin : ★ un jalon, ★★ la moitié, ★★★ tous, ajouté à la phrase partageable
  (`GameResult.career`). Légende écrite dans la graine (`career:<légende>:<graine>`), aucun tirage :
  replays, sauvegardes et anti-triche inchangés. Mode `CAREER` (migration Prisma), état `career`
  (null par défaut), notifications `CAREER_MILESTONE` / `CAREER_MISSED`, bouton 🧭 du HUD, chapitre
  du tutoriel, meilleur résultat par légende sur l'appareil (`oss.career.best`), 2 succès
  (`career-first-star`, `career-legend`), section « Mode Carrière » de `pnpm balance`.
