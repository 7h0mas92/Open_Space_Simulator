# État d'avancement : Bureau : construction, mobilier, salles, aménagement

> Fonctionnalités livrées dans `develop` (anciennement « ÉTAT D'AVANCEMENT » de `CLAUDE.md`). Ajouter une puce ici à chaque fusion. Index : [`CLAUDE.md`](../../CLAUDE.md).

- Mode construction refondu : catalogue en bas, aperçu sur la grille, bouton « Poser » au
  tactile, rendu 3D distinct pour chacun des 22 objets.
- Construction : pose en série (l'objet reste en main jusqu'à « Terminer », arrêt automatique au
  maximum ou si la trésorerie manque) ; 12 accessoires posés sur les meubles (`surfaceSlots`,
  commandes `BUY_ACCESSORY` / `MOVE_ACCESSORY`, revendus et déplacés avec leur meuble) ; 12 couleurs
  au choix à l'achat ou via « Peindre » (`PAINT_FURNITURE`, `client/src/view/colors.ts`).
- Accessoires de bureau et inventaire : écouteurs sans fil (`desk-earbuds`, protègent 1 dev des
  réunions) et mini-cactus (`mini-cactus`) posés sur les bureaux, 3 emplacements par bureau ; la
  station au sol et le cactus au sol restent (« Station de recharge d'écouteurs », « Cactus en pot »).
  « 📦 Ranger » met un objet et ses accessoires dans l'inventaire (onglet du catalogue) ; on l'en
  ressort gratuitement ou on le revend. Commandes `STORE_FURNITURE`, `PLACE_STORED`,
  `PLACE_STORED_ACCESSORY`, `SELL_STORED` ; état `inventory` (vide par défaut) ; un objet rangé n'a
  plus d'effet mais compte dans le maximum de la boutique.
- Annexes du bureau : dès la Série B, chaque tour réussi ouvre une annexe pleine largeur (arcade,
  jardin, auditorium) avec décor fixe (`render/annexDecor.ts`) et +2 places. Sol d'origine
  identique dans toutes les pièces (damier beige, `BASE_FLOOR_COLORS` dans `render/office.ts`) :
  ajouter ou agrandir une pièce ne change pas sa couleur, seul le rayon « Sols » la change.
- Salles de réunion (`shared/sim/meetings.ts`, `client/src/simulation/meetings.ts`, panneau
  « 🗓️ Réunion ») : dès la Seed, 6 formules avec bonus et malus (stand-up, brainstorming,
  aquarium ; zen et war room en Série A ; salle du conseil en Licorne), rendu 3D distinct
  (`render/meetingRoom.ts`), chaises attribuées aux devs. Réunion d'équipe chaque matin de semaine
  à 9h, dès l'arrivée, pendant 20 min (`MEETINGS.dailyMinutes`, le reste de la demi-heure on code),
  utile ou inutile, sur une graine à part (`seed#meeting#tick`) ; changer ou vider la
  salle rend 50 %. Réunion de crise à chaque panne (`holdCrisisMeeting`, sans hasard) : le
  coupable, 3 devs du code au plus (DevOps et Tech Lead d'abord) et le PO ou un manager passent
  une demi-heure en salle, puis le meneur prend « Réparer la prod », déjà avancée de 15 à 50 %
  selon la formule (`crisisHeadStart`, war room 50 %) ; coupable -3 moral, stat `crisisMeetings`. Commandes `FIT_MEETING_ROOM` / `CLEAR_MEETING_ROOM`, état `meetingRoom` (null
  par défaut). Bot « organizer » : environ +33 % de valorisation médiane face à « balanced ».
  À 375 px, les 8 boutons du dock tiennent sans défilement (libellé court « Réunion »).
- Fenêtres à acheter (`view/windows.ts`, rayon « Fenêtres » du mode construction) : les locaux
  démarrent sans fenêtre, murs du fond pleins. Petite fenêtre (1 case, 800 €), fenêtre (2 cases),
  grande fenêtre (3 cases) et baie vitrée du sol au plafond (2 cases, 5 000 €), +moral. Objets
  `wall` fixés dans le mur du fond (rotation 0, y = 0) ou de gauche (rotation 1, x = 0) ; le mur
  est percé et la ville se voit à travers, soleil devant, applique couverte décrochée
  (`wallSpans` dans `render/office.ts`). Pas de nouvelle commande ni de champ d'état.
- Chats de bureau (`shared/sim/pets.ts`, `client/src/simulation/pets.ts`, rayon « Animaux » du
  mode construction, panneau « 🐈 Chats ») : 5 chats au plus, 5 000 € l'adoption, possible
  seulement avec une litière, une gamelle et un arbre à chat posés (un objet rangé ne compte pas).
  3 litières (ouverte 60 €, fermée 220 €, robot 1 200 €), 3 arbres à chat de 1, 2 et 3 cases aux
  coloris différents, 2 gamelles nourriture et eau (simple, distributeur). Chat heureux : +moral,
  +hype, léger -0,4 % de productivité ; sans équipement complet, il boude (-moral). Confier un chat
  à une famille : pas de remboursement, -5 moral. 6 robes au choix, nom tiré de
  `seed#pet#n` sans toucher au RNG. Commandes `ADOPT_PET` / `REHOME_PET`, état `pets` (vide par
  défaut), stat `petsAdopted`. Chats en Three.js (`render/pets.ts`) qui se baladent en A*, mangent,
  se cachent dans la litière fermée, grimpent aux perchoirs et dorment surtout la nuit
  (`ai/cats.ts`, graine à part, rendu seulement). Besoins par chat (faim, soif, litière, fatigue,
  envie de jouer) : croquettes puis souvent eau juste après (places `feeding` devant chaque bol),
  litière, jeu sous le pompon de l'arbre à chat (`toys`, postures « jouer » et « boire ») en
  sautant d'un plateau à l'autre, puis sieste. Places réservées : deux chats ne se posent jamais
  au même endroit, et ils contournent ceux couchés par terre.
- Peintures et papiers peints (`shared/sim/walls.ts`, `client/src/simulation/walls.ts`, rayon
  « 🎨 Murs » du mode construction, `ui/build/WallFinishes.tsx`) : 8 peintures à 400 € le mur et
  9 papiers peints de 900 à 8 000 € (rayures, pois, chevrons, briques +hype ; jungle, lambris,
  tableau noir +qualité en Seed ; art déco en Série A ; pluie de code en Licorne), +moral par mur.
  Pose par zone de mur (`WALL_ZONES` : fond et gauche de l'open space, fond de la cuisine et des
  ailes, gauche des annexes), sans remboursement de l'ancien revêtement. Motifs dessinés sur
  canvas (`view/walls.ts`), peau sur la face intérieure des murs (`render/wallFinishes.ts`),
  percée par les fenêtres. Commande `COVER_WALL`, état `walls` (vide par défaut), aucun tirage.
  Les onglets du catalogue défilent quand ils ne tiennent pas sur la largeur.
- Écouteurs à la place des casques antibruit : « Écouteurs sans fil à réduction de bruit »
  (`desk-earbuds`, étui blanc ouvert repeignable, deux écouteurs rangés et un posé à côté) et
  « Station de recharge d'écouteurs » (`earbuds-dock`, 3 étuis) ; même effet, prix et maximums. Les
  personnages qui portaient un casque ont des écouteurs blancs (accessoire `earbuds`) ; le casque
  rétro des Années 80 reste. Nom générique, sans marque. Les anciens identifiants (`desk-headset`,
  `noise-headsets`) sont traduits au chargement et à chaque commande (`LEGACY_FURNITURE_IDS`,
  `client/src/simulation/renamedItems.ts`) : sauvegardes, replays et scores restent valides.
- Cuisine séparée (`shared/sim/furniture.ts`, rayons « Cuisine » et « Électroménager ») : les
  combinés meuble + appareil disparaissent. 6 meubles de cuisine (tiroirs 160 €, portes 140 €, évier
  2 x 1, colonne et vaisselier en Seed, îlot 2 x 1 en Série A, léger +moral) et 5 appareils posés
  dessus comme des accessoires (`appliance`, places `applianceSlots`) : cafetière à filtre (+25 café),
  machine à expresso (+50 café, +moral, succès Barista), micro-ondes, bouilloire, cuiseur à riz
  (Seed). Grille-pain et blender rejoignent l'électroménager. Au garage, la cafetière est posée sur
  le second bureau IKEA (mêmes entités, Daily et replays inchangés). Vieilles sauvegardes : chaque
  combiné devient au chargement un meuble offert + son appareil au même prix, même effet
  (`LEGACY_KITCHEN_ITEMS`, `client/src/simulation/kitchen.ts`). Bot : `findFreeSlot`.
- Ordinateurs des postes (`shared/sim/computers.ts`, `render/computers.ts`, bouton « Ordinateur »
  de l'objet sélectionné, `ui/build/ComputerPicker.tsx`) : chaque bureau de dev et bureau debout a
  une tour sobre d'origine (incluse, au sol sous le plateau), ou au choix 3 tours gaming (« Néon »
  900 €, watercooling 2 200 € en Seed, XXL « Titan » 4 500 € en Série A ; +1 à +3 % de productivité
  au poste, +moral) ou un MacBook Pro (2 800 €, sans logo) posé à la place du clavier, qui disparaît
  (+1 % au poste, +qualité, +hype). L'ancien est revendu à moitié prix, la valeur suit le bureau
  (revente, inventaire). Le clavier QWERTY est posé avec l'ordinateur (`workstation` dans
  `view/catalog.ts`, gabarit `@pc:<bureau>:<ordinateur>` dans `render/office.ts`). Commande
  `SET_COMPUTER`, champ `computer` optionnel (absent = tour sobre), aucun tirage.
- Murs fins (`render/partitions.ts`, rayon « 🧱 Cloisons » du mode construction) : les cloisons du
  plan ne sont plus des blocs d'une case séparés par une fente, mais des murs fins continus
  raccordés à leurs voisins (angles, T, croix) et enfoncés dans les murs extérieurs. Deux objets
  d'une case, posés en série, tournés (0 le long de x, 1 le long de z), repeints : « Mur fin »
  (`thin-wall`, 150 €, mi-hauteur, +0,05 % de productivité) et « Mur fin vitré »
  (`glass-partition`, 450 €, verre du sol au plafond, léger +moral), 80 au plus chacun. Champ
  `partition: 'solid' | 'glass'` du catalogue ; dessinés avec les cloisons, boîte invisible pour
  la sélection. Ils bloquent le passage ; un mur qui enfermerait une zone est refusé (erreur
  `blocksPath` dans `view/placement.ts`). Vitres des salles de réunion raccordées pareil. Aucun
  tirage, ni commande, ni champ d'état.
- Vidéoprojecteur et écrans déroulants (`shared/sim/projection.ts`, `client/src/simulation/projection.ts`,
  rayon « 📽️ Périphériques » du mode construction) : vidéoprojecteur (`projector`, 700 €, accessoire
  posé sur un meuble, bouton « ⏻ Allumer / Éteindre ») et 3 écrans de projection posés au sol
  (petit 2 cases 450 €, moyen 3 cases 1 100 € en Seed, grand 4 cases 2 400 € en Série A). Allumé et
  tourné vers un écran (cône de 50°, 1,5 à 10 cases, devant la toile), il déroule la toile, puis
  l'image s'allume (faisceau, diaporama) ; éteint, l'image s'éteint et la toile s'enroule ; la toile
  reste toute blanche, sans cadre noir (`FABRIC_WHITE`). Un écran par projecteur, le plus proche,
  projecteurs servis dans l'ordre d'achat (`projectionPairs`, même calcul pour la simulation et le
  rendu). Effets seulement pendant la projection : écran +qualité,
  +hype (+moral moyen et grand), projecteur +moral et -0,4 % de productivité. Commande
  `SWITCH_PROJECTOR`, champ `on` optionnel (absent = éteint), `GameView.projections`, rendu animé
  dans `render/projection.ts` (sans animation si « réduire les animations »). Aucun tirage.
  Projecteur de plafond (`ceiling-projector`, 1 300 €, 3 au plus) : accroché au-dessus d'une case,
  même d'un bureau, il vise depuis sa case avec les mêmes effets. Drapeau `ceiling` du catalogue :
  les objets du plafond ne se chevauchent qu'entre eux, jamais au-dessus d'un mur vitré, et ne
  bloquent pas le pathfinding (`ai/grid.ts`). Modèle `ceilingProjector` (`lensOf` pour le faisceau).
- Écrans des postes (`shared/sim/monitors.ts`, `render/monitors.ts`, rayon « 🖥️ Écrans » du mode
  construction, `ui/build/MonitorShop.tsx`, bouton « 🖥️ Écran » de l'objet sélectionné) : l'écran
  ne fait plus partie du bureau. 5 modèles (bureautique livré avec le bureau, pivoté vertical,
  gaming 165 Hz, pro ultra-fin et incurvé ultra-large en Seed), 3 tailles chacun (24, 27, 32 pouces ;
  34, 38, 45 pour l'incurvé, de 120 à 1 300 €), sur son pied ou sur un bras articulé (+150 €, -5 % de
  fatigue au poste). Effets au poste : productivité (0 à +5 %), et selon le modèle -dette, +moral ou
  +qualité ; ils s'ajoutent à ceux de l'ordinateur. Installation sur le bureau sélectionné ou sur
  tous les postes d'un coup ; l'ancien écran est repris à moitié prix, l'écran suit le bureau
  (inventaire, revente). Écran allumé du dev posé sur la dalle choisie (`screenMountOf`, dalle
  courbe pour l'incurvé). Gabarit `@monitor:<bureau>:<modèle>:<taille>:<fixation>` dans
  `render/office.ts`, vignettes 3D sans redessin au changement de taille. Commande `SET_MONITOR`,
  champ `monitor` optionnel (absent = écran bureautique 27 pouces sur pied), aucun tirage.
- Décor des annexes déplaçable (`shared/sim/annexDecor.ts`) : bornes d'arcade, flipper, enseigne
  néon, arbres, banc, fontaine, plante, enceintes, scène, pupitre et écran des annexes sont des
  objets posés (`annex:<clé>` dans `GameView.items`, champ `annexDecor`) : clic, « Tourner » et
  « Déplacer » comme le mobilier ; offerts, ils n'ont pas d'effet et ne se vendent, ne se rangent
  ni ne se repeignent. Pas d'entité ni de tirage : seuls les déplacements sont gardés (commande
  `MOVE_ANNEX_DECOR`, état `annexDecor` vide par défaut). 9 objets en boutique avec effet : borne
  d'arcade, flipper, petite scène, pupitre, écran géant d'auditorium (Détente), enseigne néon,
  arbre d'intérieur, fontaine zen (Déco), banc (Confort) ; le décor offert ne compte pas dans le
  maximum.
- Sols (`shared/sim/floors.ts`, `client/src/simulation/floors.ts`, rayon « 🟫 Sols » du mode
  construction, `ui/build/FloorShop.tsx`) : 8 matières sobres (vinyle 300 €, moquette en dalles,
  béton ciré, carrelage grand format en Seed, parquet en lames, parquet en chevrons en Seed,
  terrazzo en Série A, marbre poli 7 000 € en Licorne) et 12 teintes (neutres, essences de bois),
  posées pièce par pièce (`FLOOR_ZONES` : open space, cuisine, réunion, détente, cantine, ailes,
  annexes) ou « Toutes les pièces », sans remboursement de l'ancien sol ; +moral par pièce, et
  +qualité ou +hype selon la matière. Motifs dessinés sur canvas (`view/floors.ts`), une dalle
  texturée par pièce qui rejoint la voisine sous la cloison (`render/floorFinishes.ts`). Commande
  `COVER_FLOOR`, état `floors` (vide par défaut = sol d'origine, le même partout), aucun tirage.
- Le plan cède la place aux meubles posés : quand le bureau grandit (nouvelle phase, aile de
  filiale), une cloison du plan qui tomberait sur un meuble s'efface (`yieldToItems` dans
  `view/layout.ts`, appliqué par `layoutOf`), et le décor offert des annexes que le joueur n'a
  pas déplacé évite le mobilier : il se décale vers la case libre la plus proche contre la
  cloison du fond, ou disparaît s'il n'y en a aucune (`settleFixtures`, appelé par
  `annexDecorViews` dans `view/adapter.ts`). Plus de banc dans un mur vitré. Aucun tirage, ni
  commande, ni champ d'état.
- Salle des serveurs et fibre (`shared/sim/serverRoom.ts`, `client/src/simulation/serverRoom.ts`,
  rayon « 🗄️ Serveurs » du mode construction, panneau « 🗄️ Serveurs », `ui/servers/ServerRoom.tsx`) :
  local serveur 2 x 2 (4 000 €, Seed, 4 emplacements) et salle des serveurs vitrée 4 x 3
  (12 000 €, Série A, 8 emplacements), 1 de chaque au plus. 10 équipements au choix posés dedans
  comme des accessoires (`serverGear`, erreur `noServerRoom` ailleurs ; une salle n'accueille que
  ça) : serveurs rack, lames (Série A) et GPU (Série A), switch, box fibre, climatisation de
  précision, onduleur, NAS de sauvegarde, pare-feu, extinction au gaz (Série A). Une salle tourne
  seulement avec un serveur, du réseau et du froid (sinon elle surchauffe, sans effet) : -6 à -12 %
  d'hébergement par serveur (`hostingSaving`, 40 % au plus, `hostingCost` dans `economy.ts`),
  +stabilité, et selon le matériel +productivité, +hype ou -dette. Abonnement fibre payé chaque
  semaine (`FIBRE_PLANS` : Essentielle 400 €, Pro 900 €, Dédiée 2 500 € en Série A ; +1 à +3 % de
  productivité, +stabilité par jour), première semaine payée à la souscription, box fibre posée
  dans une salle obligatoire ; trésorerie insuffisante à l'échéance : ligne coupée (`FIBRE_CUT`).
  Changement d'offre et résiliation sans remboursement, coût compté dans la trésorerie en mois.
  Commandes `SUBSCRIBE_FIBRE` / `CANCEL_FIBRE`, état `fibre` (null par défaut), `fibreSystem` en
  dernier système, rendu `render/serverRoom.ts` (12 formes des assets manquants). Aucun tirage.
- Daily et appli de tickets « Kanbanana » (`shared/sim/meetings.ts` : `DAILY_SYNC`,
  `MorningSyncSchema` ; `client/src/simulation/meetings.ts`, `view/ticketBoard.ts`,
  `render/dailyBoard.ts`, `ui/meetings/TicketApp.tsx`, `ui/meetings/DailyMoment.tsx`) : le Daily
  de 9h fait le point sur les tickets, chaque participant note l'avancement du sien (hier,
  aujourd'hui). Daily utile : +5 % de productivité aux participants jusqu'au soir. Sans Daily ce
  matin-là, ou pour les absents, dès la Seed : travail en double à 10h, une partie d'un ticket
  est à refaire (graine à part `seed#duplicate#tick`, stat `duplicateWork`, notification
  `DUPLICATE_WORK`). Dans la salle, écran déroulant et projecteur de plafond affichent Kanbanana
  (nom et logo inventés) : colonnes, clés OSS-42, type, points, avatars, point de chacun ; panneau
  « 📽️ » en grand, lecture seule. Le temps s'arrête 6 s au début du Daily (option « Pause pendant
  le Daily », active par défaut, jamais en Hardcore ni en replay). État `morningSync` (null par
  défaut). `pnpm balance` : aménager la salle rapporte plus (bot organizer 352 → 434 M€ médians).
- Placement à la demi-case (`GridPositionSchema` dans `shared/sim/components.ts`, `view/partitions.ts`) :
  tous les objets se posent et se déplacent d'une demi-case (souris, doigt, flèches du clavier) ;
  la demi-case libre de part et d'autre d'un mur fin (cloison du plan ou mur posé) se meuble tant
  que l'objet ne traverse pas le trait du mur, et un objet de 3 cases se centre dans une pièce de 4.
  Murs fins et fenêtres restent sur des cases entières. La grille de navigation bloque chaque case
  chevauchée ; chaise et dev assis au point exact devant un bureau décalé (`accessPoint`). Positions
  entières toujours valides : anciennes sauvegardes, replays, Daily et scores inchangés, aucun tirage.
- Internet et clim de la salle des serveurs (`shared/sim/serverRoom.ts`, `shared/sim/subscriptions.ts`,
  `client/src/simulation/serverRoom.ts`), remplace les 3 offres fibre ci-dessus : 6 offres du
  service `internet` des abonnements (`FIBRE_PLANS` : box 4G 39 €/mois 3 salariés, box 5G 59 € 6,
  Fibre Pro 49 € 10, Fibre Pro+ 119 € 25 en Seed, fibre dédiée 1 Gb/s 890 € 60 en Série A, 10 Gb/s
  2 600 € 200 en Licorne), prix mensuels HT prélevés chaque semaine (`weeklyPrice`), mise en
  service payée à la souscription (`setupFee`, `firstPayment`), box fibre exigée seulement pour la
  fibre dédiée. Salariés connectés = toute l'équipe (`serviceUsers`) ; au-delà de `maxUsers`,
  réseau saturé : plus d'effet et jusqu'à -12 % de productivité (`saturationPenalty`), alertes
  `INTERNET_SATURATED` / `INTERNET_OK`, champ `saturated` optionnel. Chaleur et froid en kW (`heat`,
  `cooling` du catalogue) : climatiseur mural 5 kW (Seed), clim de précision 15 kW, clim en rangée
  35 kW (Série A), sonde de supervision (Seed). Température 18 + 10 x chaleur / froid (+3 °C de
  juin à août) : au-delà de 27 °C la moitié des effets (75 % avec sonde), au-delà de 32 °C plus
  rien et -stabilité ; la sonde affiche la température et prévient quand le niveau change
  (`serverHeatSystem`, état `serverHeat` vide par défaut). Aucun tirage.
- Hall d'entrée (`shared/sim/lobby.ts`, `client/src/simulation/lobby.ts`, rayon « 🛎️ Accueil » du
  mode construction, panneau « Hall d'entrée », `ui/lobby/Lobby.tsx`) : dès la Seed, 18 000 €
  pour un hall au rez-de-chaussée devant toutes les pièces (pièce `lobby`, `LobbyPlan` dans
  `view/layout.ts`), cloison percée de deux portes à badge (portillons qui s'ouvrent au passage),
  entrée du bureau par le hall ; comptoir d'accueil, banquette et deux plantes offerts et
  déplaçables (clés `L-0` à `L-3`), comptoir aussi en vente (2 500 €). Jusqu'à 2 secrétaires
  (3 100 € par mois, +1 % de productivité, +moral, +hype), au comptoir en semaine de 8h à 19h.
  Sécurité en abonnement du modèle commun (service `security`, installation `lobby`) :
  télésurveillance (95 €/mois), agent en journée (5 600 €, visible de 8h à 20h), gardiennage
  24 h/24 (16 500 €, Série A), payés chaque semaine. Rendu `render/lobby.ts` et
  `render/lobbyFurniture.ts` (formes `receptionDesk` et `badgeGates` des assets manquants).
  Commandes `BUILD_LOBBY` / `SET_RECEPTIONISTS`, état `lobby` (null par défaut), aucun tirage.
- Poubelles : chacune retient 10 % des déchets, jusqu'à 3 (#171).
