import type { EventCard } from '../../sim/cards.js';
import { card, LATER, t } from './helpers.js';

/** Cartes « business » : investisseurs, concurrents, marché, utilisateurs. */
export const BUSINESS_CARDS: EventCard[] = [
  card({
    id: 'investor-blockchain',
    title: t(
      'Un investisseur veut ajouter de la blockchain',
      'An investor wants to add blockchain',
    ),
    description: t(
      '« Peu importe où. Mettez-en juste un peu. Les LP adorent. »',
      '"Doesn\'t matter where. Just add a little. LPs love it."',
    ),
    weight: 8,
    cooldownSprints: 6,
    choices: [
      {
        label: t('Ajouter un NFT sur la page de login', 'Add an NFT to the login page'),
        effects: { hype: 10, debt: 8, users: -3 },
      },
      {
        label: t('Refuser poliment', 'Politely refuse'),
        effects: { hype: -5, 'moral.SENIOR_BEARD': 5 },
      },
      {
        label: LATER,
        effects: { requeue: { cardId: 'investor-blockchain-ultimatum', delaySprints: 2 } },
      },
    ],
  }),
  card({
    id: 'investor-blockchain-ultimatum',
    title: t(
      'L’investisseur pose un ultimatum blockchain',
      'The investor issues a blockchain ultimatum',
    ),
    description: t(
      '« Soit vous lancez votre token avant vendredi, soit je le dis à tout Twitter. »',
      '"Either you launch your token by Friday, or I tell all of Twitter."',
    ),
    conditions: { requiresSeen: 'investor-blockchain' },
    weight: 0,
    cooldownSprints: 10,
    choices: [
      {
        label: t('Lancer le $OSS token', 'Launch the $OSS token'),
        effects: {
          hype: 15,
          debt: 12,
          stability: -8,
          treasury: 50000,
          unlockAchievement: 'web3-bro',
        },
      },
      { label: t('Le laisser tweeter', 'Let them tweet'), effects: { hype: -15, moral: 5 } },
    ],
  }),
  card({
    id: 'competitor-raised-50m',
    title: t('Ton concurrent vient de lever 50 M€', 'Your competitor just raised €50M'),
    description: t(
      'Ils ont copié ta landing page, ton pitch et ta couleur de bouton. Même le bleu « confiant ».',
      'They copied your landing page, your pitch and your button colour. Even the "confident" blue.',
    ),
    weight: 8,
    cooldownSprints: 8,
    choices: [
      {
        label: t('Sprint de features pour répondre', 'Feature sprint in response'),
        effects: { hype: 6, debt: 8, moral: -6 },
      },
      {
        label: t('Publier un thread « on reste focus »', 'Post a "we stay focused" thread'),
        effects: { hype: -3, moral: 3 },
      },
      { label: t('Baisser les prix', 'Cut prices'), effects: { users: 8, treasury: -20000 } },
    ],
  }),
  card({
    id: 'techcrunch-article',
    title: t('TechCrunch veut écrire sur vous', 'TechCrunch wants to write about you'),
    description: t(
      'Le journaliste demande une démo « qui marche ». Arrivée prévue dans une heure.',
      'The journalist wants a demo "that works". They arrive in an hour.',
    ),
    conditions: { minPhase: 'SEED' },
    weight: 6,
    cooldownSprints: 8,
    choices: [
      { label: t('Démo en direct', 'Live demo'), effects: { hype: 12, stability: -6 } },
      { label: t('Vidéo pré-enregistrée', 'Pre-recorded video'), effects: { hype: 6 } },
    ],
  }),
  card({
    id: 'viral-tweet',
    title: t('Un tweet sur vous devient viral', 'A tweet about you goes viral'),
    description: t(
      '« Cette app a supprimé tous mes rendez-vous et honnêtement je me sens libre. » 2M de vues.',
      '"This app deleted all my appointments and honestly I feel free." 2M views.',
    ),
    weight: 6,
    cooldownSprints: 6,
    choices: [
      {
        label: t('Surfer dessus : « c’est une feature »', 'Ride it: "it\'s a feature"'),
        effects: { hype: 10, users: 5, stability: -4 },
      },
      {
        label: t('S’excuser et corriger', 'Apologise and fix it'),
        effects: { hype: 3, stability: 5, moral: -2 },
      },
    ],
  }),
  card({
    id: 'gdpr-audit',
    title: t('Audit RGPD', 'GDPR audit'),
    description: t(
      'L’auditeur demande où sont stockées les données. Réponse honnête : « un peu partout ».',
      'The auditor asks where data is stored. Honest answer: "sort of everywhere".',
    ),
    conditions: { minPhase: 'SEED' },
    weight: 6,
    cooldownSprints: 10,
    choices: [
      {
        label: t('Mise en conformité complète', 'Full compliance'),
        effects: { sprintsLost: 1, debt: -6, treasury: -10000 },
      },
      {
        label: t('Ajouter une bannière cookies géante', 'Add a giant cookie banner'),
        effects: { users: -4, debt: 3 },
      },
      { label: LATER, effects: { requeue: { cardId: 'gdpr-fine', delaySprints: 3 } } },
    ],
  }),
  card({
    id: 'gdpr-fine',
    title: t('Amende de la CNIL', 'Data protection fine'),
    description: t(
      'L’audit reporté s’est transformé en amende. Le courrier est recommandé et très rouge.',
      'The postponed audit turned into a fine. The letter is registered and very red.',
    ),
    conditions: { requiresSeen: 'gdpr-audit' },
    weight: 0,
    cooldownSprints: 15,
    choices: [
      { label: t('Payer', 'Pay up'), effects: { treasury: -150000, hype: -5 } },
      {
        label: t('Contester (avocats)', 'Contest it (lawyers)'),
        effects: { treasury: -60000, moral: -4, hype: -8 },
      },
    ],
  }),
  card({
    id: 'big-client',
    title: t('Un grand compte veut signer', 'A big enterprise client wants to sign'),
    description: t(
      'Conditions : SSO, export Excel, on-premise, et une feature que personne n’a comprise.',
      'Conditions: SSO, Excel export, on-premise, and a feature nobody understood.',
    ),
    conditions: { minPhase: 'SEED' },
    weight: 7,
    cooldownSprints: 5,
    choices: [
      {
        label: t('Tout accepter', 'Accept everything'),
        effects: { treasury: 120000, debt: 12, moral: -5 },
      },
      {
        label: t('Négocier le périmètre', 'Negotiate the scope'),
        effects: { treasury: 50000, debt: 4 },
      },
      {
        label: t(
          'Refuser : on est un produit, pas une agence',
          'Decline: we are a product, not an agency',
        ),
        effects: { hype: 3, 'moral.SENIOR_BEARD': 5 },
      },
    ],
  }),
  card({
    id: 'app-store-rejected',
    title: t('L’app est rejetée par l’App Store', 'The app was rejected by the App Store'),
    description: t(
      'Motif : « Le bouton ressemble trop à un bouton. » Délai de réponse : 3 à 30 jours.',
      'Reason: "The button looks too much like a button." Response time: 3 to 30 days.',
    ),
    conditions: { minPhase: 'SEED' },
    weight: 6,
    choices: [
      {
        label: t('Changer le bouton', 'Change the button'),
        effects: { 'moral.DESIGNER': -8, users: 2 },
      },
      { label: t('Faire appel', 'Appeal'), effects: { users: -3, hype: 2 } },
    ],
  }),
  card({
    id: 'pivot-idea',
    title: t('« Et si on pivotait ? »', '"What if we pivoted?"'),
    description: t(
      'Nouvelle idée : la même app, mais pour les chiens. Le marché est « énorme ».',
      'New idea: the same app, but for dogs. The market is "huge".',
    ),
    conditions: { gauges: { users: { max: 5000 } } },
    weight: 6,
    cooldownSprints: 10,
    choices: [
      {
        label: t('Pivoter vers les chiens', 'Pivot to dogs'),
        effects: { users: -40, hype: 20, debt: -10 },
      },
      { label: t('Garder le cap', 'Stay the course'), effects: { moral: 2, hype: -4 } },
    ],
  }),
  card({
    id: 'price-increase',
    title: t('Augmenter les prix ?', 'Raise prices?'),
    description: t(
      'Le CFO (toi) a fait un tableau. Le tableau dit oui. Les utilisateurs diront non.',
      'The CFO (you) made a spreadsheet. The spreadsheet says yes. Users will say no.',
    ),
    conditions: { gauges: { users: { min: 2000 } } },
    weight: 7,
    cooldownSprints: 6,
    choices: [
      {
        label: t('+20 % pour tout le monde', '+20% for everyone'),
        effects: { treasury: 40000, users: -6, hype: -3 },
      },
      {
        label: t('Nouvelle offre « Pro Max Ultra »', 'New "Pro Max Ultra" plan'),
        effects: { treasury: 20000, hype: 2 },
      },
    ],
  }),
  card({
    id: 'hacker-news-front-page',
    title: t('Vous êtes en une de Hacker News', 'You made the Hacker News front page'),
    description: t(
      'Le premier commentaire : « J’aurais pu coder ça en un week-end. » Le serveur fond.',
      'Top comment: "I could have built this in a weekend." The server is melting.',
    ),
    weight: 5,
    cooldownSprints: 8,
    choices: [
      {
        label: t('Scaler en urgence', 'Emergency scale-up'),
        effects: { treasury: -15000, users: 6, hype: 6 },
      },
      {
        label: t('Laisser tomber le serveur', 'Let the server fall over'),
        effects: { users: 3, hype: 4, stability: -12 },
      },
      {
        label: t('Répondre aux commentaires (erreur)', 'Reply to the comments (mistake)'),
        effects: { moral: -6, hype: 6 },
      },
    ],
  }),
  card({
    id: 'product-hunt-launch',
    title: t('Lancement sur Product Hunt', 'Product Hunt launch'),
    description: t(
      'Il faut mobiliser tout le monde pour voter à 9h01 précises, heure de San Francisco.',
      'Everyone must vote at exactly 9:01am, San Francisco time.',
    ),
    weight: 6,
    cooldownSprints: 10,
    choices: [
      {
        label: t('Nuit blanche pour le lancement', 'All-nighter for the launch'),
        effects: { hype: 12, users: 6, moral: -8 },
      },
      { label: t('Lancer tranquillement', 'Launch casually'), effects: { hype: 4, users: 2 } },
    ],
  }),
  card({
    id: 'patent-troll',
    title: t('Un patent troll vous attaque', 'A patent troll is suing you'),
    description: t(
      'Ce troll possède le brevet du « bouton qu’on clique » et réclame 2 % de tout.',
      'They own the patent for "a button you click". They want 2% of everything.',
    ),
    conditions: { minPhase: 'SERIES_A' },
    weight: 5,
    cooldownSprints: 12,
    choices: [
      {
        label: t('Payer pour avoir la paix', 'Pay to be left alone'),
        effects: { treasury: -250000 },
      },
      {
        label: t('Se battre au tribunal', 'Fight in court'),
        effects: { treasury: -100000, hype: 6, moral: -3 },
      },
    ],
  }),
  card({
    id: 'investor-wants-ai',
    title: t('Le board veut « plus d’IA »', 'The board wants "more AI"'),
    description: t(
      '« Peu importe le problème, la solution est un LLM. » Le problème, c’est la facturation.',
      '"Whatever the problem, the answer is an LLM." The problem is invoicing.',
    ),
    conditions: { minPhase: 'SEED' },
    weight: 7,
    cooldownSprints: 6,
    choices: [
      {
        label: t('Ajouter un chatbot partout', 'Add a chatbot everywhere'),
        effects: { hype: 10, debt: 8, treasury: -10000 },
      },
      {
        label: t('Renommer le produit « …AI »', 'Rename the product "…AI"'),
        effects: { hype: 6, users: -1 },
      },
      { label: t('Expliquer patiemment', 'Explain patiently'), effects: { hype: -4 } },
    ],
  }),
  card({
    id: 'board-meeting',
    title: t('Conseil d’administration', 'Board meeting'),
    description: t(
      'Les administrateurs veulent voir « la courbe en crosse de hockey ». Vous avez une crosse de golf.',
      'Board members want to see "the hockey stick". You have a golf club.',
    ),
    conditions: { minPhase: 'SEED' },
    weight: 7,
    cooldownSprints: 4,
    choices: [
      {
        label: t('Changer l’échelle du graphique', 'Change the chart scale'),
        effects: { hype: 5, unlockAchievement: 'log-scale' },
      },
      { label: t('Être transparent', 'Be transparent'), effects: { hype: -4, moral: 3 } },
    ],
  }),
  card({
    id: 'conference-talk',
    title: t('Invitation à parler en conférence', 'Invited to speak at a conference'),
    description: t(
      'Le sujet : « Comment nous avons scalé ». Vous avez 12 utilisateurs et un serveur.',
      'Topic: "How we scaled". You have 12 users and one server.',
    ),
    weight: 6,
    cooldownSprints: 6,
    choices: [
      {
        label: t('Y aller avec le Senior', 'Go with the Senior'),
        effects: { hype: 6, 'moral.SENIOR_BEARD': 8, treasury: -2000 },
      },
      {
        label: t('Envoyer le stagiaire', 'Send the intern'),
        effects: { hype: 2, 'moral.INTERN': 15 },
      },
      { label: t('Décliner', 'Decline'), effects: { hype: -1 } },
    ],
  }),
  card({
    id: 'data-leak',
    title: t('Fuite de données', 'Data leak'),
    description: t(
      'Un chercheur en sécurité a trouvé un bucket public. Il contient « passwords_FINAL_v2.csv ».',
      'A security researcher found a public bucket. It contains "passwords_FINAL_v2.csv".',
    ),
    conditions: { minPhase: 'SEED', gauges: { debt: { min: 40 } } },
    weight: 6,
    cooldownSprints: 10,
    choices: [
      {
        label: t('Communiquer et corriger', 'Disclose and fix'),
        effects: { users: -8, hype: -6, debt: -5, stability: 5 },
      },
      {
        label: t('Corriger en silence', 'Fix it quietly'),
        effects: { debt: -3, requeue: { cardId: 'data-leak-press', delaySprints: 2 } },
      },
    ],
  }),
  card({
    id: 'data-leak-press',
    title: t('La fuite est dans la presse', 'The leak is in the press'),
    description: t(
      '« La startup qui stockait les mots de passe en clair » fait la une. Votre maman a appelé.',
      '"The startup that stored passwords in plain text" is front-page news. Your mum called.',
    ),
    conditions: { requiresSeen: 'data-leak' },
    weight: 0,
    cooldownSprints: 15,
    choices: [
      { label: t('Excuses publiques', 'Public apology'), effects: { users: -20, hype: -15 } },
      {
        label: t('Accuser un stagiaire', 'Blame an intern'),
        effects: { users: -15, hype: -10, moral: -10, 'moral.INTERN': -30 },
      },
    ],
  }),
  card({
    id: 'influencer-deal',
    title: t('Un influenceur propose un partenariat', 'An influencer offers a partnership'),
    description: t(
      '1,2M d’abonnés, dont 1,1M de bots. Tarif : 30 000 € pour « une story ».',
      '1.2M followers, 1.1M of them bots. They want €30,000 for "one story".',
    ),
    weight: 6,
    cooldownSprints: 6,
    choices: [
      { label: t('Accepter', 'Accept'), effects: { treasury: -30000, hype: 8, users: 2 } },
      { label: t('Refuser', 'Decline'), effects: {} },
    ],
  }),
];
