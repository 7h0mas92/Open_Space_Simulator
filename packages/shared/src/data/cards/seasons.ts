import type { EventCard } from '../../sim/cards.js';
import { card, LATER, t } from './helpers.js';

/**
 * Cartes de saison : elles ne tombent que pendant la période de leur thème (Halloween, Noël…,
 * voir `SEASONS` dans `sim/calendar.ts`). Ce sont des événements courts : une semaine par an,
 * d'où leur long cooldown (une seule sortie par année de jeu).
 */
const seasonal = (definition: Parameters<typeof card>[0]): EventCard =>
  card({ weight: 10, cooldownSprints: 20, ...definition });

export const SEASON_CARDS: EventCard[] = [
  // ─── Nouvel An ──────────────────────────────────────────────────────────────
  seasonal({
    id: 'new-year-resolutions',
    title: t('Les bonnes résolutions de l’équipe', 'The team’s New Year’s resolutions'),
    description: t(
      '« Cette année, on écrit des tests. » Tout le monde hoche la tête. Personne n’y croit.',
      '"This year, we write tests." Everyone nods. Nobody believes it.',
    ),
    conditions: { season: 'NEW_YEAR' },
    choices: [
      {
        label: t('Sprint 100 % tests et refacto', 'A 100% tests and refactoring sprint'),
        effects: { debt: -10, hype: -4, moral: -2 },
      },
      {
        label: t('Résolution : livrer plus vite', 'Resolution: ship faster'),
        effects: { hype: 5, debt: 6 },
      },
      { label: LATER, effects: { moral: -1 } },
    ],
  }),
  seasonal({
    id: 'new-year-party-hangover',
    title: t('Le 2 janvier, l’open space est vide', 'January 2nd, the open space is empty'),
    description: t(
      'La moitié de l’équipe a « pris un jour ». L’autre moitié boit du café en silence.',
      'Half the team "took a day off". The other half drinks coffee in silence.',
    ),
    conditions: { season: 'NEW_YEAR' },
    choices: [
      {
        label: t('Croissants et journée calme', 'Croissants and a quiet day'),
        effects: { treasury: -400, moral: 5, coffee: 5 },
      },
      {
        label: t('Réunion de rentrée à 8h', 'Back-to-work meeting at 8am'),
        effects: { moral: -6, hype: 2 },
      },
    ],
  }),

  // ─── Saint-Valentin ─────────────────────────────────────────────────────────
  seasonal({
    id: 'valentine-users-love',
    title: t('Les utilisateurs déclarent leur flamme', 'Users declare their love'),
    description: t(
      'Le marketing veut une fonctionnalité « Partager avec son crush ». Elle doit sortir le 14.',
      'Marketing wants a "Share with your crush" feature. It must ship on the 14th.',
    ),
    conditions: { season: 'VALENTINE' },
    choices: [
      {
        label: t('Livrer en catastrophe', 'Ship it in a rush'),
        effects: { hype: 6, users: 3, debt: 6, stability: -4 },
      },
      {
        label: t('Envoyer juste des cœurs par e-mail', 'Just email some hearts'),
        effects: { hype: 2, treasury: -500 },
      },
    ],
  }),
  seasonal({
    id: 'valentine-office-romance',
    title: t('Deux devs partagent le même écran', 'Two devs are sharing one screen'),
    description: t(
      'Ils font du pair programming. Depuis trois jours. Avec deux pailles dans le même café.',
      'They are pair programming. For three days now. With two straws in the same coffee.',
    ),
    conditions: { season: 'VALENTINE', minPhase: 'SEED' },
    choices: [
      { label: t('C’est mignon, on laisse', 'It’s cute, leave them be'), effects: { moral: 4 } },
      {
        label: t('Un écran chacun, c’est la règle', 'One screen each, those are the rules'),
        effects: { treasury: -800, moral: -2, stability: 2 },
      },
    ],
  }),

  // ─── Pâques ─────────────────────────────────────────────────────────────────
  seasonal({
    id: 'easter-egg-hunt',
    title: t('Chasse aux œufs dans le code', 'Easter egg hunt in the code'),
    description: t(
      'Un dev a caché des œufs de Pâques dans l’appli. Un utilisateur en a trouvé un en prod.',
      'A dev hid Easter eggs in the app. A user found one in production.',
    ),
    conditions: { season: 'EASTER' },
    choices: [
      {
        label: t('En faire une campagne', 'Turn it into a campaign'),
        effects: { hype: 6, users: 2, debt: 3 },
      },
      {
        label: t('Tout retirer avant le lundi', 'Remove them all before Monday'),
        effects: { debt: -3, moral: -3 },
      },
    ],
  }),
  seasonal({
    id: 'easter-chocolate-keyboard',
    title: t('Chocolat fondu dans un clavier', 'Melted chocolate in a keyboard'),
    description: t(
      'Les touches E, S et C ne se relèvent plus. C’est gênant pour sortir de Vim.',
      'The E, S and C keys stay down. Awkward when you want to exit Vim.',
    ),
    conditions: { season: 'EASTER' },
    choices: [
      {
        label: t('Clavier mécanique neuf', 'Brand-new mechanical keyboard'),
        effects: { treasury: -250, moral: 3 },
      },
      {
        label: t('Lave-vaisselle, programme doux', 'Dishwasher, gentle cycle'),
        effects: { moral: -2, stability: -2 },
      },
    ],
  }),

  // ─── Espace ─────────────────────────────────────────────────────────────────
  seasonal({
    id: 'space-launch-stream',
    title: t('Un lancement de fusée en direct', 'A live rocket launch'),
    description: t(
      'Toute l’équipe regarde le décollage sur le grand écran. Le compte à rebours dure 4 heures.',
      'The whole team watches the lift-off on the big screen. The countdown lasts 4 hours.',
    ),
    conditions: { season: 'SPACE' },
    choices: [
      {
        label: t('On regarde tous ensemble', 'We all watch together'),
        effects: { moral: 6, hype: -2 },
      },
      {
        label: t('Couper le stream, on a un sprint', 'Cut the stream, we have a sprint'),
        effects: { moral: -4, hype: 2 },
      },
    ],
  }),
  seasonal({
    id: 'space-moonshot',
    title: t('« Il nous faut un projet moonshot »', '"We need a moonshot project"'),
    description: t(
      'Un investisseur a vu un documentaire sur la Lune. Il veut une appli « qui marche dans l’espace ».',
      'An investor watched a Moon documentary. He wants an app "that works in space".',
    ),
    conditions: { season: 'SPACE', minPhase: 'SEED' },
    choices: [
      {
        label: t('Mode hors ligne « galactique »', '"Galactic" offline mode'),
        effects: { hype: 7, debt: 5, treasury: -2000 },
      },
      {
        label: t('Expliquer la latence Terre-Lune', 'Explain Earth-Moon latency'),
        effects: { hype: -3 },
      },
    ],
  }),

  // ─── Médiéval ───────────────────────────────────────────────────────────────
  seasonal({
    id: 'medieval-legacy-castle',
    title: t('On a trouvé un château fort dans le code', 'We found a castle in the code'),
    description: t(
      'Un module de 2009, entouré de douves et de commentaires en majuscules : « NE PAS TOUCHER ».',
      'A module from 2009, surrounded by a moat and all-caps comments: "DO NOT TOUCH".',
    ),
    conditions: { season: 'MEDIEVAL' },
    choices: [
      {
        label: t('Lancer l’assaut (refacto)', 'Storm the walls (refactor)'),
        effects: { debt: -9, stability: -4, 'moral.SENIOR_BEARD': 6 },
      },
      {
        label: t('Ériger un pont-levis (une API)', 'Build a drawbridge (an API)'),
        effects: { debt: 3, stability: 3 },
      },
      { label: LATER, effects: { debt: 2, requeue: {} } },
    ],
  }),
  seasonal({
    id: 'medieval-dragon-bug',
    title: t('Un dragon garde le bug', 'A dragon guards the bug'),
    description: t(
      'Le bug n’arrive que chez un seul client, le plus gros. Il crache des stack traces enflammées.',
      'The bug only happens for one client, the biggest one. It breathes fiery stack traces.',
    ),
    conditions: { season: 'MEDIEVAL' },
    choices: [
      {
        label: t('Envoyer un chevalier (le Senior)', 'Send a knight (the Senior)'),
        effects: { stability: 6, 'moral.SENIOR_BEARD': -4, treasury: -1000 },
      },
      {
        label: t('Offrir un trésor au client', 'Offer the client a treasure'),
        effects: { treasury: -4000, users: 1 },
      },
    ],
  }),

  // ─── Super-héros ────────────────────────────────────────────────────────────
  seasonal({
    id: 'superhero-capes-day',
    title: t('Journée « viens en cape »', '"Wear a cape" day'),
    description: t(
      'Quelqu’un a proposé de venir déguisé en super-héros. Les capes se coincent dans les chaises.',
      'Someone suggested dressing up as superheroes. Capes keep getting stuck in chairs.',
    ),
    conditions: { season: 'SUPERHEROES' },
    choices: [
      {
        label: t('Tout le monde en cape !', 'Capes for everyone!'),
        effects: { treasury: -600, moral: 6, hype: 2 },
      },
      { label: t('Une cape, c’est un risque', 'Capes are a safety risk'), effects: { moral: -2 } },
    ],
  }),
  seasonal({
    id: 'superhero-hero-dev',
    title: t('Un dev se prend pour un héros', 'A dev thinks they are a hero'),
    description: t(
      'Il corrige tous les incidents seul, la nuit, sans documenter. Il se fait appeler « Le Patch ».',
      'He fixes every incident alone, at night, without documenting. He calls himself "The Patch".',
    ),
    conditions: { season: 'SUPERHEROES', hasRole: 'TEN_X' },
    choices: [
      {
        label: t('Laisser faire le héros', 'Let the hero work'),
        effects: { stability: 5, debt: 6 },
      },
      {
        label: t('Lui imposer d’écrire la doc', 'Make him write the docs'),
        effects: { debt: -4, 'moral.TEN_X': -8 },
      },
    ],
  }),

  // ─── Rétro ──────────────────────────────────────────────────────────────────
  seasonal({
    id: 'retro-arcade-cabinet',
    title: t('Une borne d’arcade d’occasion', 'A second-hand arcade cabinet'),
    description: t(
      'Elle est à vendre en bas de la rue, avec 30 jeux pixelisés. Le meilleur score date de 1987.',
      'It’s for sale down the street, with 30 pixel games. The high score dates from 1987.',
    ),
    conditions: { season: 'RETRO_80S' },
    choices: [
      {
        label: t('L’acheter pour l’open space', 'Buy it for the open space'),
        effects: { treasury: -1500, moral: 7, stability: -1 },
      },
      {
        label: t('Juste battre le record', 'Just beat the high score'),
        effects: { moral: 2, hype: -1 },
      },
    ],
  }),
  seasonal({
    id: 'retro-floppy-backup',
    title: t('La sauvegarde est sur disquette', 'The backup is on a floppy disk'),
    description: t(
      'En cherchant la sauvegarde de la base, on trouve une disquette étiquetée « prod FINAL v2 ».',
      'Looking for the database backup, we find a floppy labelled "prod FINAL v2".',
    ),
    conditions: { season: 'RETRO_80S' },
    choices: [
      {
        label: t('Mettre en place de vraies sauvegardes', 'Set up real backups'),
        effects: { treasury: -2500, stability: 8 },
      },
      {
        label: t('L’encadrer au mur', 'Frame it on the wall'),
        effects: { moral: 3, stability: -3 },
      },
    ],
  }),

  // ─── Été ────────────────────────────────────────────────────────────────────
  seasonal({
    id: 'summer-heatwave',
    title: t('Canicule dans l’open space', 'Heatwave in the open space'),
    description: t(
      'Il fait 34 °C. Les serveurs ventilent plus fort que les devs. Quelqu’un travaille en tongs.',
      'It’s 34 °C. The servers blow harder than the devs. Someone is working in flip-flops.',
    ),
    conditions: { season: 'SUMMER' },
    choices: [
      {
        label: t('Installer la clim', 'Install air conditioning'),
        effects: { treasury: -5000, moral: 6 },
      },
      {
        label: t('Horaires d’été : 7h-14h', 'Summer hours: 7am-2pm'),
        effects: { moral: 4, hype: -3 },
      },
      {
        label: t('Glaces pour tout le monde', 'Ice cream for everyone'),
        effects: { treasury: -300, moral: 2, coffee: -5 },
      },
    ],
  }),
  seasonal({
    id: 'summer-out-of-office',
    title: t('Tout le monde part en vacances en même temps', 'Everyone goes on holiday at once'),
    description: t(
      'Le calendrier partagé est rempli de palmiers. Il reste un stagiaire et une plante.',
      'The shared calendar is full of palm trees. One intern and a plant remain.',
    ),
    conditions: { season: 'SUMMER', minPhase: 'SEED' },
    choices: [
      {
        label: t('Valider les congés', 'Approve the holidays'),
        effects: { moral: 8, hype: -4, stability: -2 },
      },
      {
        label: t('Une astreinte chacun', 'One on-call shift each'),
        effects: { moral: -6, stability: 4 },
      },
    ],
  }),

  // ─── Pirates ────────────────────────────────────────────────────────────────
  seasonal({
    id: 'pirate-talk-day',
    title: t(
      '« Moussaillon, ton ticket est à fond de cale ! »',
      '"Ahoy, yer ticket be in the bilge!"',
    ),
    description: t(
      'C’est la journée où l’on parle comme un pirate. Le daily dure 40 minutes de plus.',
      'It’s Talk Like a Pirate Day. The daily stand-up runs 40 minutes over.',
    ),
    conditions: { season: 'PIRATES' },
    choices: [
      {
        label: t('Hisser le drapeau noir', 'Raise the black flag'),
        effects: { moral: 5, hype: 1 },
      },
      { label: t('Réunion sérieuse, svp', 'A serious meeting, please'), effects: { moral: -3 } },
    ],
  }),
  seasonal({
    id: 'pirate-treasure-api',
    title: t('Un trésor dans une vieille API', 'Treasure in an old API'),
    description: t(
      'Un dev a trouvé un abonnement cloud oublié, payé chaque mois depuis 3 ans. Un butin à récupérer.',
      'A dev found a forgotten cloud subscription, paid every month for 3 years. Booty to recover.',
    ),
    conditions: { season: 'PIRATES' },
    choices: [
      {
        label: t('Résilier et récupérer le butin', 'Cancel it and recover the booty'),
        effects: { treasury: 3000, stability: -2 },
      },
      {
        label: t('Vérifier d’abord ce qu’il fait', 'Check what it does first'),
        effects: { stability: 2 },
      },
    ],
  }),

  // ─── Halloween ──────────────────────────────────────────────────────────────
  seasonal({
    id: 'halloween-zombie-process',
    title: t('Des processus zombies en prod', 'Zombie processes in production'),
    description: t(
      'Ils sont morts, mais ils consomment toujours de la mémoire. Et ils sont de plus en plus nombreux.',
      'They are dead, yet they still eat memory. And there are more of them every hour.',
    ),
    conditions: { season: 'HALLOWEEN' },
    choices: [
      {
        label: t('Tout redémarrer à minuit', 'Restart everything at midnight'),
        effects: { stability: 6, moral: -3 },
      },
      { label: t('Augmenter la RAM', 'Add more RAM'), effects: { treasury: -2000, debt: 3 } },
      { label: LATER, effects: { stability: -4, requeue: {} } },
    ],
  }),
  seasonal({
    id: 'halloween-costume-contest',
    title: t('Concours de déguisements', 'Costume contest'),
    description: t(
      'Le gagnant de l’an dernier était déguisé en « fuite de mémoire ». Personne n’a compris.',
      'Last year’s winner dressed up as a "memory leak". Nobody got it.',
    ),
    conditions: { season: 'HALLOWEEN' },
    choices: [
      {
        label: t('Bonbons et concours', 'Candy and a contest'),
        effects: { treasury: -500, moral: 6, coffee: -3 },
      },
      {
        label: t('Déguisement : « dev productif »', 'Costume: "productive dev"'),
        effects: { moral: -2, hype: 2 },
      },
    ],
  }),

  // ─── Cyber Monday ───────────────────────────────────────────────────────────
  seasonal({
    id: 'cyber-monday-traffic',
    title: t('Black Friday : le trafic explose', 'Black Friday: traffic explodes'),
    description: t(
      'Le marketing a lancé une promo sans prévenir. Les graphes ressemblent à une fusée.',
      'Marketing launched a sale without telling anyone. The graphs look like a rocket.',
    ),
    conditions: { season: 'CYBERPUNK' },
    choices: [
      {
        label: t('Augmenter les serveurs', 'Scale up the servers'),
        effects: { treasury: -4000, users: 6, stability: 2 },
      },
      { label: t('Prier', 'Pray'), effects: { users: 4, stability: -10 } },
    ],
  }),
  seasonal({
    id: 'cyber-neon-setup',
    title: t('Un dev a mis des néons partout', 'A dev put neon lights everywhere'),
    description: t(
      'Son bureau ressemble à une ville du futur. Il dit coder 30 % plus vite. Personne ne vérifie.',
      'Their desk looks like a futuristic city. They claim to code 30% faster. Nobody checks.',
    ),
    conditions: { season: 'CYBERPUNK' },
    choices: [
      {
        label: t('Néons pour tout le monde', 'Neon for everyone'),
        effects: { treasury: -1200, moral: 4, hype: 2 },
      },
      {
        label: t('Rallumer la lumière blanche', 'Turn the white lights back on'),
        effects: { moral: -2 },
      },
    ],
  }),

  // ─── Noël ───────────────────────────────────────────────────────────────────
  seasonal({
    id: 'christmas-code-freeze',
    title: t('Gel du code avant Noël', 'Pre-Christmas code freeze'),
    description: t(
      'Un client veut une nouvelle fonctionnalité pour le 24 décembre à 18h.',
      'A client wants a new feature by December 24 at 6pm.',
    ),
    conditions: { season: 'CHRISTMAS' },
    choices: [
      {
        label: t('Gel strict, joyeux Noël', 'Strict freeze, merry Christmas'),
        effects: { stability: 5, moral: 4, hype: -3 },
      },
      {
        label: t('Livrer le 24 au soir', 'Ship on the evening of the 24th'),
        effects: { hype: 5, users: 2, stability: -8, moral: -6 },
      },
    ],
  }),
  seasonal({
    id: 'christmas-secret-santa',
    title: t('Le Père Noël secret', 'Secret Santa'),
    description: t(
      'Budget : 10 €. Quelqu’un offre un livre sur Rust à tout le monde. Encore.',
      'Budget: €10. Someone gives everyone a book about Rust. Again.',
    ),
    conditions: { season: 'CHRISTMAS', minPhase: 'SEED' },
    choices: [
      {
        label: t('Cadeaux et vin chaud', 'Presents and mulled wine'),
        effects: { treasury: -800, moral: 7 },
      },
      { label: t('Juste des cartes de vœux', 'Just greeting cards'), effects: { moral: 1 } },
    ],
  }),
];
