import type { EventCard } from '../../sim/cards.js';
import { card, LATER, t } from './helpers.js';

/** Cartes diverses : moments de la semaine, fin de partie, absurdités. */
export const MISC_CARDS: EventCard[] = [
  card({
    id: 'friday-deploy-request',
    title: t('« Je peux déployer ? C’est tout petit. »', '"Can I deploy? It\'s tiny."'),
    description: t(
      'Vendredi, 16h. Le diff fait 3 400 lignes. « Tout petit » est relatif.',
      'Friday, 4pm. The diff is 3,400 lines. "Tiny" is relative.',
    ),
    conditions: { dayOfWeek: 5, afterHour: 15 },
    weight: 12,
    cooldownSprints: 1,
    choices: [
      { label: t('Non. Lundi.', 'No. Monday.'), effects: { stability: 3, 'moral.TEN_X': -5 } },
      {
        label: t('Vas-y, je te fais confiance', 'Go ahead, I trust you'),
        effects: { hype: 3, stability: -12 },
      },
    ],
  }),
  card({
    id: 'monday-passwords',
    title: t(
      'Lundi matin, plus personne ne connaît son mot de passe',
      'Monday morning, nobody remembers their password',
    ),
    description: t(
      'La politique de rotation a frappé. Les post-its sous les claviers aussi.',
      'The rotation policy struck. So did the sticky notes under keyboards.',
    ),
    conditions: { dayOfWeek: 1 },
    weight: 6,
    cooldownSprints: 6,
    choices: [
      {
        label: t('Passer au SSO', 'Switch to SSO'),
        effects: { treasury: -3000, moral: 4, stability: 2 },
      },
      { label: t('Réinitialiser à la main', 'Reset them by hand'), effects: { moral: -3 } },
    ],
  }),
  card({
    id: 'late-night-idea',
    title: t('Idée géniale à 22h', 'Brilliant idea at 10pm'),
    description: t(
      'Un dev resté tard veut ajouter une IA qui prédit les bugs. Ce sont ses propres bugs.',
      'A dev staying late wants to add an AI that predicts bugs. Their own bugs.',
    ),
    conditions: { afterHour: 18 },
    weight: 6,
    choices: [
      { label: t('Laisser faire', 'Let it happen'), effects: { hype: 4, debt: 5 } },
      {
        label: t('Renvoyer tout le monde à la maison', 'Send everyone home'),
        effects: { moral: 4 },
      },
    ],
  }),
  card({
    id: 'stack-overflow-down',
    title: t('Stack Overflow est en panne', 'Stack Overflow is down'),
    description: t(
      'La productivité de l’équipe chute de 90 %. Le Senior est le seul à savoir encore coder.',
      'Team productivity drops 90%. The Senior is the only one who can still code.',
    ),
    weight: 6,
    choices: [
      { label: t('Demander à l’IA', 'Ask the AI'), effects: { debt: 5 } },
      {
        label: t('Lire la documentation officielle', 'Read the official documentation'),
        effects: { debt: -3, moral: -3, 'moral.SENIOR_BEARD': 8 },
      },
    ],
  }),
  card({
    id: 'office-dog',
    title: t('Un chien au bureau ?', 'A dog in the office?'),
    description: t(
      'Un dev demande s’il peut venir avec Biscotte, un corgi « très calme ». Biscotte n’est pas calme.',
      'A dev asks to bring Biscuit, a "very calm" corgi. Biscuit is not calm.',
    ),
    weight: 6,
    cooldownSprints: 12,
    choices: [
      {
        label: t('Bienvenue Biscotte !', 'Welcome, Biscuit!'),
        effects: { moral: 10, stability: -2, unlockAchievement: 'office-dog' },
      },
      { label: t('Pas d’animaux', 'No pets'), effects: { moral: -3 } },
    ],
  }),
  card({
    id: 'mascot',
    title: t('Il faut une mascotte', 'We need a mascot'),
    description: t(
      'La designeuse propose un poulpe minimaliste. Le PO veut une licorne. Le Rustacé, un crabe.',
      'The designer suggests a minimalist octopus. The PO wants a unicorn. The Rustacean, a crab.',
    ),
    weight: 5,
    cooldownSprints: 15,
    choices: [
      { label: t('Le poulpe', 'The octopus'), effects: { hype: 3, 'moral.DESIGNER': 10 } },
      { label: t('Le crabe', 'The crab'), effects: { hype: 2, 'moral.RUSTACEAN': 10 } },
      { label: t('Un canard en plastique', 'A rubber duck'), effects: { hype: 4, moral: 3 } },
    ],
  }),
  card({
    id: 'bug-bounty',
    title: t('Un hacker éthique a trouvé une faille', 'An ethical hacker found a vulnerability'),
    description: t(
      'On peut se connecter en tapant « admin » comme mot de passe. Récompense demandée : 5 000 €.',
      'You can log in by typing "admin" as the password. Requested bounty: €5,000.',
    ),
    weight: 6,
    cooldownSprints: 8,
    choices: [
      {
        label: t('Payer et corriger', 'Pay and fix'),
        effects: { treasury: -5000, stability: 6, debt: -2 },
      },
      {
        label: t('Offrir un t-shirt', 'Offer a t-shirt'),
        effects: {
          treasury: -20,
          hype: -6,
          requeue: { cardId: 'data-leak-press', delaySprints: 3 },
        },
      },
    ],
  }),
  card({
    id: 'leap-year-bug',
    title: t('Le bug du 29 février', 'The February 29th bug'),
    description: t(
      'Le calcul des abonnements suppose que février a 28 jours. Il en a 29 cette année.',
      'The billing code assumes February has 28 days. It has 29 this year.',
    ),
    weight: 4,
    cooldownSprints: 20,
    choices: [
      {
        label: t('Utiliser une vraie librairie de dates', 'Use a real date library'),
        effects: { debt: -3, treasury: -2000 },
      },
      {
        label: t('Offrir le jour aux clients', 'Give customers the day for free'),
        effects: { treasury: -5000, hype: 3 },
      },
    ],
  }),
  card({
    id: 'mom-investor',
    title: t('Ta mère veut investir', 'Your mum wants to invest'),
    description: t(
      '« Je ne comprends pas ce que tu fais, mais je suis fière. » Elle propose 20 000 €.',
      '"I don\'t understand what you do, but I\'m proud." She offers €20,000.',
    ),
    conditions: { maxPhase: 'SEED' },
    weight: 5,
    cooldownSprints: 39,
    choices: [
      { label: t('Accepter', 'Accept'), effects: { treasury: 20000, moral: -2 } },
      { label: t('Refuser (fierté)', 'Refuse (pride)'), effects: { moral: 2 } },
    ],
  }),
  card({
    id: 'garage-flood',
    title: t('Le garage est inondé', 'The garage is flooded'),
    description: t(
      'Le serveur est sur une palette. La palette flotte. Le serveur aussi, pour l’instant.',
      'The server sits on a pallet. The pallet floats. So does the server, for now.',
    ),
    conditions: { maxPhase: 'GARAGE' },
    weight: 7,
    cooldownSprints: 39,
    choices: [
      {
        label: t('Passer au cloud', 'Move to the cloud'),
        effects: { treasury: -3000, stability: 8 },
      },
      {
        label: t('Acheter des bottes', 'Buy boots'),
        effects: { treasury: -60, stability: -8, moral: 2 },
      },
    ],
  }),
  card({
    id: 'ramen-shortage',
    title: t('Pénurie de ramen', 'Ramen shortage'),
    description: t(
      'Le stock de nouilles instantanées du garage est épuisé. L’équipe envisage de manger un légume.',
      "The garage's instant noodle stash is gone. The team is considering eating a vegetable.",
    ),
    conditions: { maxPhase: 'GARAGE' },
    weight: 6,
    cooldownSprints: 6,
    choices: [
      {
        label: t('Commander 50 kg de ramen', 'Order 50 kg of ramen'),
        effects: { treasury: -200, moral: 5 },
      },
      { label: t('Essayer les légumes', 'Try vegetables'), effects: { moral: -2, coffee: 5 } },
    ],
  }),
  card({
    id: 'hiring-spree',
    title: t('« Il faut doubler l’équipe ce trimestre »', '"We must double the team this quarter"'),
    description: t(
      'Le board veut des embauches. Beaucoup. Tout de suite. Peu importe qui.',
      'The board wants hires. Lots. Now. Whoever.',
    ),
    conditions: { minPhase: 'SERIES_A' },
    weight: 7,
    cooldownSprints: 6,
    choices: [
      {
        label: t('Recruter n’importe qui', 'Hire anyone'),
        effects: { spawnDev: 'INTERN', hype: 5, debt: 4 },
      },
      {
        label: t('Prendre un Senior', 'Hire a Senior'),
        effects: { spawnDev: 'SENIOR_BEARD', treasury: -10000 },
      },
      { label: t('Résister au board', 'Push back on the board'), effects: { hype: -6, moral: 3 } },
    ],
  }),
  card({
    id: 'growth-hacker',
    title: t('Un growth hacker propose ses services', 'A growth hacker offers their services'),
    description: t(
      'Sa méthode : envoyer 3 millions d’emails « Re: ta facture ». Résultats garantis.',
      'Their method: send 3 million "Re: your invoice" emails. Results guaranteed.',
    ),
    conditions: { minPhase: 'SEED' },
    weight: 6,
    cooldownSprints: 8,
    choices: [
      {
        label: t('Tester', 'Try it'),
        effects: { treasury: -15000, users: 12, hype: -5, stability: -3 },
      },
      { label: t('Refuser', 'Decline'), effects: { 'moral.DESIGNER': 3 } },
    ],
  }),
  card({
    id: 'offsite-bali',
    title: t('Séminaire à Bali ?', 'Offsite in Bali?'),
    description: t(
      '« Pour la cohésion. » Le Dev Fantôme dit être déjà sur place.',
      '"For team cohesion." The Ghost Dev says they are already there.',
    ),
    conditions: { minPhase: 'SERIES_A' },
    weight: 5,
    cooldownSprints: 12,
    choices: [
      { label: t('Bali !', 'Bali!'), effects: { treasury: -120000, moral: 20, sprintsLost: 1 } },
      {
        label: t('Séminaire en Normandie', 'Offsite in Normandy'),
        effects: { treasury: -20000, moral: 8 },
      },
      { label: LATER, effects: { moral: -4, requeue: { delaySprints: 2 } } },
    ],
  }),
  card({
    id: 'unicorn-podcast',
    title: t('Invitation dans un podcast de licornes', 'Invited on a unicorn podcast'),
    description: t(
      'Il faut parler de « ta routine du matin ». Tu te lèves, tu regardes si la prod est up.',
      'You must talk about "your morning routine". You wake up and check if prod is up.',
    ),
    conditions: { minPhase: 'SERIES_A' },
    weight: 6,
    cooldownSprints: 8,
    choices: [
      {
        label: t('Parler de ton bain glacé à 5h', 'Talk about your 5am ice bath'),
        effects: { hype: 8, moral: -2 },
      },
      { label: t('Parler de l’équipe', 'Talk about the team'), effects: { hype: 4, moral: 6 } },
    ],
  }),
  card({
    id: 'slide-accident',
    title: t('Accident de toboggan', 'Slide accident'),
    description: t(
      'Quelqu’un est descendu avec un café. Le café est arrivé en premier. Sur le serveur.',
      'Someone went down with a coffee. The coffee arrived first. On the server.',
    ),
    conditions: { minPhase: 'UNICORN' },
    weight: 6,
    cooldownSprints: 8,
    choices: [
      {
        label: t('Interdire les boissons sur le toboggan', 'Ban drinks on the slide'),
        effects: { moral: -3, stability: 2 },
      },
      {
        label: t('En faire une vidéo virale', 'Turn it into a viral video'),
        effects: { hype: 8, stability: -5 },
      },
    ],
  }),
  card({
    id: 'ipo-lawyers',
    title: t('Les avocats préparent l’introduction en Bourse', 'Lawyers are preparing the IPO'),
    description: t(
      'Ils demandent la liste de tous les « risques ». La liste fait 300 pages. La page 1 : « le stagiaire ».',
      'They want a list of every "risk". It runs 300 pages. Page 1: "the intern".',
    ),
    conditions: { minPhase: 'UNICORN' },
    weight: 6,
    cooldownSprints: 6,
    choices: [
      {
        label: t('Tout documenter', 'Document everything'),
        effects: { treasury: -500000, debt: -8, stability: 6 },
      },
      {
        label: t('Minimiser les risques', 'Downplay the risks'),
        effects: { hype: 6, requeue: { cardId: 'gdpr-fine', delaySprints: 2 } },
      },
    ],
  }),
  card({
    id: 'big-tech-copies',
    title: t('Une big tech copie ta feature phare', 'A big tech copies your flagship feature'),
    description: t(
      'Elle l’annonce en keynote comme « une innovation révolutionnaire ». Avec ton bleu « confiant ».',
      'They announce it at a keynote as a "revolutionary innovation". With your "confident" blue.',
    ),
    conditions: { minPhase: 'SERIES_A' },
    weight: 6,
    cooldownSprints: 10,
    choices: [
      {
        label: t('Innover plus vite', 'Innovate faster'),
        effects: { hype: 4, debt: 8, moral: -4 },
      },
      {
        label: t('Se positionner sur une niche', 'Focus on a niche'),
        effects: { users: -5, hype: -2, moral: 3 },
      },
    ],
  }),
  card({
    id: 'carbon-audit',
    title: t('Bilan carbone', 'Carbon audit'),
    description: t(
      'Vos 64 GPU de test émettent autant qu’un petit pays. Le rapport sort demain.',
      'Your 64 test GPUs emit as much as a small country. The report is out tomorrow.',
    ),
    conditions: { minPhase: 'SERIES_A' },
    weight: 5,
    cooldownSprints: 12,
    choices: [
      {
        label: t('Optimiser l’infra', 'Optimise the infrastructure'),
        effects: { treasury: -40000, debt: -5, hype: 3 },
      },
      {
        label: t('Planter un arbre (un seul)', 'Plant a tree (just one)'),
        effects: { treasury: -30, hype: -5 },
      },
    ],
  }),
  card({
    id: 'crypto-winter',
    title: t('L’hiver crypto est arrivé', 'Crypto winter has arrived'),
    description: t(
      'Les investisseurs ferment leurs portefeuilles. Même ceux qui n’ont jamais touché à la crypto.',
      'Investors are closing their wallets. Even those who never touched crypto.',
    ),
    conditions: { minPhase: 'SEED' },
    weight: 5,
    cooldownSprints: 15,
    choices: [
      {
        label: t('Réduire les coûts', 'Cut costs'),
        effects: { treasury: 30000, moral: -8, hype: -3 },
      },
      {
        label: t('Afficher un optimisme inébranlable', 'Project unshakable optimism'),
        effects: { hype: -6 },
      },
    ],
  }),
];
