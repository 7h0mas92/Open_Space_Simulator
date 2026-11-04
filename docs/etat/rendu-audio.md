# État d'avancement : Rendu 3D, personnages, ville et audio

> Fonctionnalités livrées dans `develop` (anciennement « ÉTAT D'AVANCEMENT » de `CLAUDE.md`). Ajouter une puce ici à chaque fusion. Index : [`CLAUDE.md`](../../CLAUDE.md).

- Personnages selon le profil (`render/officeCharacters.ts`) : les 10 Blocky Characters hors
  thème (pirate, ninja, zombies…) ne sont plus tirés ; looks Kenney avec accessoires Three.js et
  13 personnages construits en Three.js, animés par les clips Kenney.
- Packs de personnages (`render/characterPacks.ts`) activables dans l'onglet « Packs de
  personnages » du back-office : Base (looks habituels, actif par défaut), Noël, Halloween,
  Pâques, Super-héros (inventés), Été, Espace, Pirates, Moyen Âge, Années 80, Cyberpunk. Les
  packs actifs se mélangent dans l'équipe ; table `CharacterPack`, `GET /api/character-packs`.
- Ambiance du bureau : l'écran d'un dev s'allume quand il y travaille, avec un contenu lié à son
  métier (code, vim, Rust, maquettes, Kanban, terminal d'IA, forum ; erreur rouge quand il crie,
  économiseur quand il dort) : `render/screens.ts`. Éclairage de la salle : appliques Kenney et
  halos, plafonniers, fenêtres couleur du ciel, taches de soleil le jour (`render/officeLights.ts`) ;
  vraies lampes selon la qualité (0 bas, 3 moyen, 6 haut).
- Vue sur New York (`render/skyline.ts`) : le bureau est au dernier étage d'une tour, dans une ville low-poly façon
  Manhattan en formes Three.js (tours à gradins, réservoirs d'eau, parc, fleuve, taxis), sans
  bâtiment réel. Graine fixe, sans le RNG du jeu ; aucun toit proche ne cache la salle
  (`maxTop`) ; brume, fenêtres, lampadaires et balises qui suivent le jour et la nuit.
  Qualité basse par défaut quand WebGL tourne sans carte graphique (SwiftShader, llvmpipe).
- Vue sur New York réaliste (`render/skylineShaders.ts`, `render/cityLights.ts`) : 5 styles de
  façades dessinés par shader (verre, brique, pierre, bandeaux, brownstone ; vitrines au
  rez-de-chaussée, reflets du ciel, éclat du soleil), éclairage ciel + soleil + fond de rue plus
  sombre, brume à 75 %. Fenêtres allumées une à une selon l'heure du jeu (`litShare` : bureaux qui
  se vident de 18h à 22h, logements le soir), seuil par fenêtre, lampes qui changent toutes les 6
  à 20 s, télés qui scintillent. Toits à muret, climatiseurs, édicules, panneaux solaires,
  couronnes illuminées la nuit ; rues marquées, passages piétons, flaques des lampadaires ;
  arbres d'alignement, voitures à phares et feux arrière (90 à 220 selon la qualité), fleuve
  animé, 2 avions au loin. Graine fixe par pâté, hauteurs sur des étages entiers ; `update`
  reçoit la minute affichée, `setQuality` allège la qualité basse. Rendu seulement.
- Musiques du propriétaire (`client/public/assets/music/`, 7 MP3 non réencodés, noms d'origine sans
  espace ni accent) : tycoon au menu, tycoon 1 en planification et démo, les 4 Détente en playlist
  pendant le sprint, aria math en levée de fonds et à l'écran de fin (`audio/music.ts`,
  `musicMoodOf`, `ui/useMusic.ts`). Fondu de 1,5 s, reprise du morceau là où il était, lecture en
  flux par une balise `<audio>` branchée sur un gain Web Audio (`audio/musicTrack.ts`, le volume
  marche aussi sur iPhone et iPad, où Safari ignore celui de la balise), démarrage au premier clic,
  volume « Musique » des options ; sous « Effets », une mention dit qu'aucun effet n'est encore là. Hors précache de la PWA
  (25 Mo) : hors ligne, pas de musique. Crédits : « compositions originales de l'équipe du projet ».
- Canapé et bibliothèque détaillés (`render/furnitureDetail.ts`, formes `sofa` et `bookcase` des
  assets manquants) : canapé en tissu gris-bleu (pieds en bois, accoudoirs roulés, coussins
  séparés, coussins déco, plaid), bibliothèque à deux colonnes (placard, paniers, livres un par un,
  livres penchés et empilés, plante, cadre, trophée). Pièces fusionnées par matériau, tirages sur
  une graine fixe propre au fichier ; tissu repeignable (`fabric`, `fabricDark`), dessus de la
  bibliothèque à 1,58 et assise à 0,44 inchangés. Les modèles Kenney restent dans les salles de
  réunion.
- Poste de travail : clavier QWERTY à vraies touches sur le bureau de dev et le bureau debout
  (`render/keyboard.ts`, forme `qwertyKeyboard` des assets manquants) : 61 touches en relief,
  police maison 3 x 5 dessinée pixel par pixel, touches fusionnées en un seul appel de dessin.
  Souris Kenney à l'échelle du clavier (x0,7, `MOUSE_SCALE`) sur un tapis de souris sombre (forme
  `mousePad`), aux bureaux de dev et debout et à côté du portable du garage. Rendu seulement.
- Plantes d'intérieur (rayon « Déco », `render/plants.ts`) : 8 plantes en plus, modélisées en
  Three.js feuille par feuille (le Furniture Kit n'a que 4 petites plantes). Petites : sansevieria,
  pothos sur sellette, bonsaï. Grandes : figuier lyre, palmier kentia (Seed), olivier centenaire
  (Série A). Grosses : jardinière de séparation 3 x 1 (Seed), monstera géante 2 x 2 (Série A).
  Effet réel (moral, et qualité, hype, récupération ou productivité selon la plante), seul le pot
  se repeint, pièces fusionnées par couleur (`Pieces`), graine fixe propre à chaque plante. Pas de
  commande ni de champ d'état ; les petites sont masquées au dézoom comme le cactus.
- Meubles détaillés comme le canapé (assemblage commun `render/pieces.ts` : couleurs repeignables
  en matériaux nommés, le reste peint par sommet dans un matériau `trim`, voyants dans `lights`,
  2 à 4 maillages par meuble). Bureaux et sièges (`render/workFurniture.ts`) : bureau de dev,
  bureau du garage sur tréteaux, standing desk, chaise à roulettes, chaise ergonomique, meuble
  télé, baie de serveurs, station d'écouteurs. Cuisine (`render/kitchenFurniture.ts`) : 6 meubles
  de cuisine, 5 appareils, frigo à boissons, tablée de cantine. Détente
  (`render/loungeFurniture.ts`) : babyfoot, toboggan, capsule de sieste (dans le bon sens),
  enceinte, tapis rond repeignable, poubelle à pédale. 12 accessoires de bureau
  (`render/deskAccessories.ts`, lampe d'architecte au lieu de la lampe carrée). Équipement des
  chats (`render/petFurniture.ts`) : litières, gamelles et arbres à chat, places de l'IA des chats
  inchangées. Hauteurs et emplacements d'accessoires inchangés ; couleurs `birch`, `chairFabric`,
  `cabinet`, `cushion`, `rug`, `teddy` ajoutées à la palette. Les plantes passent par
  `new Pieces('all')` (un matériau par couleur). Rendu seulement.
- Bruits de bureau (`client/src/audio/deskSounds.ts`, option `onDeskActivity` de `GameRenderer`,
  branché dans `ui/game/Scene.tsx`) : un dev en pose « travail » à un bureau à écran (même règle
  que l'écran allumé, `screenMountOf` : écran choisi ou portable du garage) s'entend en zoomant
  (plus petit côté de la vue de 8,5 à 5,5 unités, `closeness`) : clavier et souris à la même
  distance, même poids dans `deskMix`, plus forts au centre, baisse linéaire jusqu'à 1,6 fois le
  plus petit côté de la vue, placés à gauche ou à droite (6 devs au plus) ; silence en vue
  d'ensemble.
  Frappes tirées de l'enregistrement fourni par Melvin (`public/assets/sounds/clavier-1-mrboubou13al.mp3`,
  précaché), découpé au chargement en 54 frappes (`sliceKeystrokes`) et joué bien plus bas que
  l'original ; frappes synthétisées en secours. Clic de souris synthétisé en Web Audio. Rythme
  `TypingRhythm` (rafales, relectures), `Math.random` seulement : le RNG du jeu n'est pas touché.
  Muet en pause, pendant une carte d'événement, la nuit ; volume « Ambiance » des options.
- Voitures et décorations refaites (`render/cars.ts`, `render/decorModels.ts`,
  `render/decorations.ts`) : 7 modèles de véhicules en formes Three.js dans les rues de la ville
  (taxi 30 %, berline, citadine, SUV, camionnette, pick-up, bus 4 %), vitres, roues à jantes,
  phares, feux, pare-chocs ; carrosserie teintée par instance et habillage peint par sommet, deux
  InstancedMesh par modèle, modèle et couleur figés par le numéro (`carLook`, hachage, aucun
  tirage). Décorations de saison : guirlandes à fil (ampoules à douille en 3 phases de
  scintillement, ou fanions triangles, cœurs ou queues d'aronde) tendues en festons entre des
  clous ; un ornement par emplacement, à mi-chemin entre deux appliques, hors fenêtres, cloisons
  et meubles hauts (`decorWalls`) ; 24 ornements et 12 objets de bureau redessinés (couronne,
  chaussette, sapin en pot, horloge de minuit, champagne, écu, bannière, vinyle, cassette, cube,
  chauves-souris, araignée…). Fusion par matériau (`Pieces`, 4 maillages au plus par mur), deux
  thèmes se partagent les murs (`shareWalls`). Rendu seulement.
