# Cahier des charges : fonctionnalités

> Extrait du cahier des charges d'origine (anciennement dans `CLAUDE.md`). Index : [`CLAUDE.md`](../../CLAUDE.md).

# FONCTIONNALITÉS

## 1. Temps et sprints

- Sprints de 2 semaines simulées, environ 3 min réelles à x1. Vitesses pause, x1, x2, x4.
- 18 mois, soit 39 sprints.
- Chaque sprint se déroule en 4 temps :
  1. Planification : backlog façon Kanban avec glisser-déposer (souris et tactile). Les features
     ont une taille, un type (feature, refacto, bugfix, infra) et un impact sur les jauges.
  2. Exécution : les devs travaillent en temps réel dans l'open space.
  3. Crises : des cartes d'événements tombent pendant l'exécution.
  4. Démo : écran de fin de sprint avec utilisateurs gagnés ou perdus, argent, réputation et
     retours d'utilisateurs drôles.
- Cycle jour/nuit visible par l'éclairage de la scène. Le vendredi 17h est signalé à l'écran.

## 2. Jauges

| Jauge           | Rôle                                | À 0                                          |
| --------------- | ----------------------------------- | -------------------------------------------- |
| Trésorerie      | Payer les salaires                  | Game over, faillite                          |
| Café            | Carburant                           | Productivité divisée par 3                   |
| Moral (par dev) | Motivation                          | Démission annoncée par un faux post LinkedIn |
| Dette technique | Monte à chaque raccourci            | Bugs, prod instable                          |
| Stabilité prod  | Fiabilité                           | Fuite des utilisateurs                       |
| Hype            | Attractivité pour les investisseurs | Plus de levée de fonds                       |

Un dashboard affiche l'historique de chaque jauge sous forme de graphiques.

## 3. Employés

Chaque dev a :

- des stats : Vitesse, Qualité, Endurance, Ego ;
- un trait, un nom généré et une mini-bio drôle (« Kevin, 24 ans, a mis "ninja" dans son titre
  LinkedIn ») ;
- un salaire, un niveau d'expérience qui progresse, et des relations avec ses collègues
  (affinités et conflits qui influencent le moral).

Les 8 profils :

- Senior Barbu : +50 % de qualité, refuse les frameworks de moins de 5 ans.
- 10x Developer : très rapide, mais son code augmente la dette, car personne ne le comprend.
- Stagiaire : 5 % de chance par jour de casser la prod.
- Rustacé : veut tout réécrire en Rust et convertit progressivement ses collègues.
- Designeuse : bloque les releases tant que le padding est faux, +qualité perçue aux démos.
- Product Owner : 4 réunions par jour, -10 % de productivité pour tous, +hype.
- IA Agent : ultra rapide, 30 % de chance d'halluciner une feature.
- Dev Fantôme : en télétravail, invisible dans le bureau, mais ses tickets se ferment.

Recrutement : 3 candidats générés par sprint, avec négociation de salaire et un risque que le
candidat refuse l'offre.
Fiche détaillée de chaque dev : stats, historique, humeur, relations.
Licenciement possible, avec un impact sur le moral de l'équipe.

## 4. IA des personnages

- Pathfinding A* sur la grille, avec évitement entre personnages.
- Behavior trees : travailler, aller au café, aller en réunion, discuter, se disputer, dormir sur
  le clavier, crier sur l'écran, jouer au babyfoot, partir le soir.
- Bulles de pensée contextuelles au-dessus des têtes (« pourquoi ça marche ?? »,
  « je vais démissionner »).

## 5. Événements

- 100 cartes à choix multiples, stockées en base et chargées au démarrage. Elles sont mises en
  cache pour le mode hors ligne.
- Chaque carte a un poids, des conditions (phase, rôle présent, seuils de jauges, jour et heure,
  carte déjà vue) et des choix avec des effets.
- Les chaînes d'événements sont possibles : le choix « On en reparle » remet en file une version
  pire de la même carte.
- Format :
  { id, title: {fr, en}, description: {fr, en},
  conditions: { minPhase?, maxPhase?, hasRole?, gauges?: {[name]: {min?, max?}},
  dayOfWeek?, afterHour?, requiresSeen? },
  weight, cooldownSprints,
  choices: [{ label: {fr, en}, effects: { treasury?, coffee?, hype?, debt?, stability?,
  users?, moral?, "moral.<role>"?, sprintsLost?, requeue?, spawnDev?,
  fireDev?, unlockAchievement? } }] }
- Cartes à inclure parmi les 100 :
  - « Le CTO a lu un article sur Medium » (migration en microservices).
  - « Vendredi 17h04, la prod est down ».
  - « Le stagiaire a git push --force sur main ».
  - « Un dev propose un hackathon le week-end ».
  - « Un investisseur veut ajouter de la blockchain ».
  - « La machine à café est en panne ».
  - « Un canard en plastique a été trouvé sur un bureau ».
  - « Ton concurrent vient de lever 50 M€ ».
  - « Réunion de 2h pour choisir la couleur d'un bouton ».
    Écris les 91 autres dans le même esprit.

## 6. Progression

| Phase   | Décor                             | Équipe max | Déblocage             |
| ------- | --------------------------------- | ---------- | --------------------- |
| Garage  | 1 bureau IKEA, ramen              | 2          | Départ                |
| Seed    | Petit open space                  | 6          | 1re levée             |
| Série A | Babyfoot, plantes, standing desks | 15         | 2e levée              |
| Licorne | Toboggan, sieste-pods, cantine    | 30         | Valorisation de 1 Md€ |
| Fin     | IPO ou rachat par une big tech    |            |                       |

- À chaque phase, le bureau s'agrandit : nouvelles salles, salle de réunion, cuisine.
- Levées de fonds : mini-jeu de pitch où le joueur choisit ses arguments face à un investisseur.
  Le succès dépend de la hype, des utilisateurs et de la dette. La dilution est calculée.
- Fins : faillite, IPO, rachat, ou « zombie » (survie sans croissance au bout de 18 mois).
  L'écran de fin est partageable sous forme d'image générée, par exemple : « Ma startup a été
  rachetée 400 M€ et 7 devs ont fait un burn-out ».

## 7. Aménagement

Mode construction : acheter, placer, tourner et revendre des objets sur la grille. Chaque objet a
un effet réel.

- Machine à café premium : +Café.
- Babyfoot : +Moral, -Productivité.
- Plantes : léger +Moral.
- Casques antibruit : annulent le malus des réunions.
- Chaise ergonomique : +Endurance.
- Ajoute au moins 10 autres objets, en fonction des modèles Kenney disponibles.

## 8. Slack simulé

- Panneau Slack dans un coin de l'écran, avec des canaux #general, #random et #incidents.
- Par défaut, les messages viennent d'une bibliothèque de templates contextuels (plus de 200).
- En mode IA, optionnel et activable dans les options :
  - le serveur appelle l'API Claude avec l'état résumé de la partie et les personnalités des devs ;
  - les persos réagissent aux événements en direct ;
  - le modèle est configurable par variable d'environnement ;
  - quota par utilisateur, cache des réponses, et retour automatique aux templates en cas
    d'erreur.

## 9. Méta-jeu

- Au moins 25 succès, par exemple :
  - « Vendredi Noir » : casser la prod 10 vendredis de suite ;
  - « Zéro Réunion » ;
  - « Licorne sans dette ».
- Modes de jeu :
  - Normal ;
  - Hardcore : pas de pause ;
  - Stagiaires Only ;
  - Défi « Cette app doit sortir en 3 sprints » ;
  - Daily : même graine pour tout le monde chaque jour, à la manière de Wordle, avec un classement
    du jour.
- Classements en ligne : global, Daily et par mode.
- Profil joueur : statistiques cumulées, succès débloqués, meilleures parties.
- Replays : revoir une partie du classement à partir de sa graine et de ses commandes.

## 10. Back-office admin

Interface réservée au rôle ADMIN :

- créer, modifier, dupliquer, désactiver et réactiver les cartes d'événements, avec
  prévisualisation ;
- retrouver une carte grâce à des filtres combinables : recherche plein texte (FR et EN), état,
  phase, profil requis, jauge modifiée, particularités (chaîne, hors tirage, jour ou heure,
  seuil de jauge, recrutement ou licenciement, succès) et tri (titre, poids, tirages, date) ;
- consulter des statistiques : cartes les plus tirées, choix les plus fréquents, taux de faillite
  par phase.

## 11. Direction artistique et audio

- Low-poly isométrique avec les modèles Kenney, une palette cohérente et des ombres douces.
- Animations des personnages : clips du GLB s'ils existent, sinon animations procédurales (bob,
  rotation, petits sauts).
- Effets visuels : particules de fumée quand la prod tombe, confettis lors d'une levée, écran
  rouge clignotant pendant un incident.
- Musique lo-fi, sons de clavier mécanique et sons d'interface Kenney.
- Volumes réglables séparément pour la musique, les effets et l'ambiance.

## 12. Tutoriel et accessibilité

- Tutoriel interactif pendant le premier sprint.
- Infobulles sur toutes les jauges.
- Navigation complète au clavier dans l'UI, contrastes AA, option pour réduire les animations,
  taille de texte réglable.

# CE QUE L'APPLICATION NE FAIT PAS

- Pas de multijoueur en temps réel (le seul aspect compétitif est le classement).
- Pas d'achats intégrés ni de publicité.
- Pas de chat entre joueurs.
- Pas d'application mobile native : c'est une PWA uniquement.
- Pas d'assets payants ni dessinés à la main : uniquement Kenney et des formes Three.js.
- L'IA ne génère que des messages Slack. Elle ne crée jamais d'événements ni ne modifie
  l'équilibrage.
