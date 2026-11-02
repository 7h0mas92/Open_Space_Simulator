# Mode Histoire, arbre des devs et arbre des objets : proposition

> Proposition du 17 octobre 2026, écrite pour Melvin et confiée à Thomas le 2 novembre 2026
> (voir `docs/PASSATION-THOMAS.md`). Depuis, la PR #122 (mode Histoire) est fusionnée, le mode
> Carrière (#121) est dans `main` et le mode illimité `ENDLESS` (#135) dans `develop`.
>
> Proposition d'origine, à valider avant tout code. Le mode Illimité et le
> classement sont traités dans un autre fil.

## 0. Ce qui existe déjà

- **PR #122 de Thomas (ouverte, pas fusionnée)** : un mode Histoire en **4 chapitres et 10 missions
  courtes** (Premier commit, Le café d'abord, Sortir du garage, La réunion utile, La salle des
  serveurs, Les chats de l'open space, Une Série A propre, Les pompiers, Licorne sans dette, La
  cloche de la Bourse). Chaque mission est une partie séparée, et sa réussite débloque une
  récompense (papier peint, sol, couleur, objet, bonus de départ) pour les autres modes, jamais
  pour le Daily. Le serveur vérifie les missions par rejeu (table `StoryMission`).
- **PR #121 de Thomas (brouillon)** : mode Carrière, 8 parcours de startups célèbres sans les nommer.
- Les devs ont déjà une **expérience et un niveau** (`employment.xp`, `employment.level`, +5 % de
  vitesse par niveau), mais aucun choix à faire quand ils montent.
- Le catalogue de construction est seulement verrouillé par **phase** (Seed, Série A, Licorne).

**Recommandation** : partir de la PR #122 plutôt que de tout refaire. On garde son
infrastructure (mode `STORY`, verrous `unlock`, récompenses vérifiées par le serveur) et on
transforme ses 10 missions séparées en **une seule longue partie racontée**, ce que tu demandes.
Il faudra prévenir Thomas, puisque c'est sa PR.

## 1. Synopsis : « Ctrl+Alt+Fonder »

Tu viens de te faire voler ton idée. Ton ancien chef, **Bastien Lemaître**, a présenté ton
projet comme le sien devant des investisseurs, a levé 5 M€ et fondé **Synergix**, dans la tour
d'en face. Il te reste un garage, un ami dev et 2 M€ de business angels qui croient en toi.

Une seule partie, du garage à la Bourse, découpée en **5 actes** d'environ 12 sprints chacun
(**environ 60 sprints**, soit 5 h à x1, contre 39 pour une partie normale). Chaque acte a des
scènes dialoguées, des cartes d'événements propres à l'histoire et 2 ou 3 objectifs (on y
recycle les 10 missions de Thomas).

| Acte     | Titre              | Ce qui se passe                                                                                                                                         | Objectifs (exemples)                                                            |
| -------- | ------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------- |
| Prologue | Le garage          | Ton idée volée, le premier commit. Synergix ouvre en face.                                                                                              | Livrer 3 features (mission de Thomas), ne jamais manquer de café, lever la Seed |
| I        | La course          | Les premiers utilisateurs. Synergix débauche ton meilleur dev.                                                                                          | Dépasser Synergix en utilisateurs, aménager une salle de réunion utile          |
| II       | La guerre des prix | Un 3e concurrent, **Pivotly**, change de produit tous les deux sprints et casse les prix. Fuite de données chez Synergix : tu en profites ou tu aides ? | Monter une salle des serveurs sans panne, Série A avec moins de 30 % de dette   |
| III      | Le géant           | **Gigacorp** (big tech inventée) rachète Synergix et sort un clone de ton produit.                                                                      | Devenir licorne, garder 40 % du marché, licorne sans dette                      |
| IV       | La cloche          | Gigacorp t'offre un rachat. Tu signes ou tu vises l'IPO ? Deux fins écrites.                                                                            | IPO ou rachat, avec un bilan face aux concurrents                               |
| Épilogue | Saison libre       | L'histoire est finie, la partie continue **sans limite** : de nouvelles startups apparaissent tous les 10 sprints, plus agressives.                     | Rester n°1 le plus longtemps possible                                           |

Personnages récurrents (tous inventés, aucun nom ni logo réel) : **Bastien Lemaître** (rival,
patron de Synergix), **Mamie Josette** (ta première business angel, qui t'envoie des SMS),
**Inès Kader** (journaliste tech qui fait et défait la hype), **Gigacorp** (le géant).

### La concurrence

- **3 startups rivales** simulées à côté de la tienne : utilisateurs, valorisation, hype, effectif.
  Elles grandissent selon leur caractère (Synergix copie, Pivotly change de cap, Gigacorp écrase)
  et réagissent à tes résultats. Le marché est partagé : leurs utilisateurs freinent ta croissance.
- Leurs actions arrivent en cartes : débauchage d'un dev, baisse de prix, feature sortie avant toi,
  procès, rachat d'un concurrent.
- Panneau **« Marché »** : parts de marché, courbes comparées, dernière action de chaque rival.
- **Bâtiment voisin visible** : la tour de Synergix se dresse dans la ville de New York, à une
  rue de distance (assez loin pour ne pas masquer le bureau). Son enseigne lumineuse et ses
  fenêtres allumées grandissent avec la startup ; elle s'éteint si le rival fait faillite. Les
  autres rivaux ont leur tour plus loin dans la ville.
- Déterminisme : les rivaux tirent sur une graine à part (`seed#rival#…`), le RNG de la partie
  n'est pas touché, les autres modes restent identiques.

## 2. Arbre de compétences des devs

Chaque niveau gagné donne **1 point de compétence** au dev (le système de niveaux existe déjà).
Le joueur le dépense dans la fiche du dev, onglet « Compétences ». 3 branches de 5 nœuds, chaque
nœud demande le précédent ; un dev ne peut pas tout prendre (environ 8 points sur une partie
complète), il faut donc spécialiser l'équipe.

| Branche          | Nœuds, dans l'ordre                                                                                                                                                                                                                                   |
| ---------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 🛠️ **Technique** | Code propre (-10 % de dette) → Débogueur (+25 % sur les bugfix) → Architecte (+25 % sur les refactos) → Revue de code (-5 % de dette pour toute l'équipe) → **Gardien de la prod** (répare les pannes 2 fois plus vite)                               |
| ⚡ **Vitesse**   | Raccourcis clavier (+5 % de vitesse) → Concentration (malus des réunions divisé par 2) → Deep work (+10 % hors réunion) → Fin de sprint (+15 % le dernier jour) → **Crunch** (pouvoir : +50 % de vitesse pendant 1 jour, -moral, une fois par sprint) |
| 🤝 **Humain**    | Endurance (-15 % de fatigue) → Diplomate (conflits divisés par 2) → Mentor (+20 % d'XP pour ses voisins) → Bonne humeur (+moral de l'équipe) → **Leader** (personne ne démissionne tant qu'il est là, sauf licenciement)                              |

- Chaque profil ajoute un **nœud de métier** au bout d'une branche (le Rustacé : « Réécriture
  réussie », -20 % de dette sur ses refactos ; la Designeuse : « Pixel perfect », +qualité aux
  démos ; l'Agent IA : « Moins d'hallucinations », 15 % au lieu de 30 %…).
- **Formation** : on peut acheter de l'XP (stage, conférence, livre) contre de l'argent.
- **Réinitialiser** un dev coûte un mois de son salaire.
- Les bonus passent par les systèmes existants (travail, dette, fatigue, réunions), sans tirage.

## 3. Arbre de déblocage des objets (« R&D »)

En Histoire, le catalogue de construction démarre réduit au strict nécessaire (bureau IKEA,
chaise, cafetière, plante). Le reste se débloque dans un arbre d'entreprise avec des **points
d'innovation** gagnés en livrant des features, en réussissant les objectifs de l'histoire et en
battant les rivaux sur un sprint.

| Branche             | Niveau 1                   | Niveau 2                              | Niveau 3                  | Niveau 4                                                                                  |
| ------------------- | -------------------------- | ------------------------------------- | ------------------------- | ----------------------------------------------------------------------------------------- |
| 🪑 **Confort**      | Chaise de bureau, canapé   | Chaise ergonomique, standing desk     | Babyfoot, enceinte        | Capsule de sieste, toboggan                                                               |
| 💻 **Tech**         | Écrans 24-27 pouces        | Tours gaming, bras articulés          | Local serveur, fibre      | Salle des serveurs vitrée, écrans incurvés, MacBook                                       |
| 🌿 **Ambiance**     | Petites plantes, peintures | Papiers peints, sols                  | Grandes plantes, fenêtres | Baie vitrée, marbre, chats                                                                |
| ☕ **Cuisine**      | Bouilloire, micro-ondes    | Machine à expresso                    | Îlot, frigo à boissons    | Cantine                                                                                   |
| 🗓️ **Organisation** | Salle de stand-up          | Vidéoprojecteur, écrans de projection | War room, salle zen       | Salle du conseil                                                                          |
| 🏆 **Prestige**     | —                          | —                                     | —                         | Récompenses des missions de Thomas : statue licorne, cloche de la Bourse, sol datacenter… |

- Chaque niveau demande aussi l'acte correspondant (impossible d'avoir la salle du conseil dans
  le garage), et le verrou de phase actuel reste.
- Les objets débloqués dans l'histoire restent débloqués pour la Saison libre. Les récompenses de
  Thomas restent, comme dans sa PR, utilisables en Facile, Normal et dans les défis, jamais en Daily.

## 4. Découpage en PR (toutes vers `develop`)

1. **Socle** : reprendre la PR #122 sur `develop`, transformer les missions en une partie continue
   en actes, sans limite de sprints après l'épilogue (Saison libre).
2. **Rivaux** : simulation des 3 startups, cartes de rivaux, panneau Marché, tours voisines dans
   la ville.
3. **Histoire** : scènes dialoguées, cartes propres à chaque acte, deux fins écrites, FR et EN.
4. **Arbre des devs** : points, fiche « Compétences », formations, bonus dans les systèmes.
5. **Arbre des objets** : points d'innovation, écran R&D, verrous du catalogue.
6. **Équilibrage** : bot « conteur » dans `pnpm balance`, réglage de la durée et de la difficulté.

Chaque PR : textes FR et EN, aucun tirage sur le RNG de la partie, nouveaux champs optionnels,
captures 1440 et 375 px, CI verte, et j'attends ta validation avant de fusionner.

## 5. Tes réponses attendues

1. **Base** : partir de la PR #122 de Thomas (recommandé) ou repartir de zéro ?
2. **Arbre des devs** : seulement en Histoire et en Illimité (recommandé, le Normal et le Daily
   ne bougent pas) ou dans tous les modes sauf le Daily ?
3. **Durée** : environ 60 sprints (recommandé) ou 39 comme une partie normale ?
4. **Synopsis, noms, arbres** : tu valides tels quels ou tu veux changer quelque chose ?
