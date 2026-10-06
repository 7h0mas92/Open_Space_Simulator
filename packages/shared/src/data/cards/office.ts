import type { EventCard } from '../../sim/cards.js';
import { card, LATER, t } from './helpers.js';

/** Cartes « vie de bureau » : café, réunions, open space. */
export const OFFICE_CARDS: EventCard[] = [
  card({
    id: 'coffee-machine-broken',
    title: t('La machine à café est en panne', 'The coffee machine is broken'),
    description: t(
      'Un silence de mort règne sur l’open space. Quelqu’un a sorti une bouilloire et du Nescafé.',
      'A deathly silence falls over the open space. Someone brought out a kettle and instant coffee.',
    ),
    weight: 10,
    cooldownSprints: 4,
    choices: [
      {
        label: t('Réparation express (cher)', 'Express repair (expensive)'),
        effects: { treasury: -1500, coffee: 20 },
      },
      {
        label: t('Tout le monde au café d’en bas', 'Everyone to the café downstairs'),
        effects: { treasury: -600, coffee: 10, moral: 3, stability: -2 },
      },
      {
        label: LATER,
        effects: { coffee: -30, requeue: { cardId: 'coffee-machine-dead', delaySprints: 1 } },
      },
    ],
  }),
  card({
    id: 'coffee-machine-dead',
    title: t('La machine à café est morte', 'The coffee machine is dead'),
    description: t(
      'Elle a pris feu pendant la nuit. Une minute de silence a été observée. Puis une émeute.',
      'It caught fire overnight. A minute of silence was observed. Then a riot.',
    ),
    conditions: { requiresSeen: 'coffee-machine-broken' },
    weight: 0,
    cooldownSprints: 6,
    choices: [
      {
        label: t('Acheter la plus chère du marché', 'Buy the most expensive one available'),
        effects: { treasury: -30000, coffee: 40, moral: 3 },
      },
      {
        label: t('Passer au thé', 'Switch to tea'),
        effects: { coffee: -35, moral: -8, 'moral.DESIGNER': 10, treasury: 2000 },
      },
    ],
  }),
  card({
    id: 'button-color-meeting',
    title: t(
      'Réunion de 2h pour choisir la couleur d’un bouton',
      '2-hour meeting to pick a button colour',
    ),
    description: t(
      'Bleu ? Bleu clair ? « Bleu, mais plus confiant » ? 14 personnes sont invitées.',
      'Blue? Light blue? "Blue, but more confident"? 14 people are invited.',
    ),
    weight: 10,
    cooldownSprints: 3,
    choices: [
      {
        label: t('Y aller, c’est important', 'Attend, it matters'),
        effects: { moral: -6, hype: 2, 'moral.PRODUCT_OWNER': 10 },
      },
      { label: t('Faire un A/B test', 'Run an A/B test'), effects: { users: 1, debt: 2 } },
      {
        label: t('Décider seul : vert', 'Decide alone: green'),
        effects: { moral: 3, 'moral.DESIGNER': -15 },
      },
    ],
  }),
  card({
    id: 'wifi-down',
    title: t('Le wifi est tombé', 'The wifi is down'),
    description: t(
      'Tout le monde fait semblant de travailler en local. Trois devs sont partis « en télétravail ».',
      'Everyone pretends to work offline. Three devs left to "work from home".',
    ),
    weight: 8,
    choices: [
      {
        label: t('Partage de connexion depuis ton téléphone', 'Hotspot from your phone'),
        effects: { treasury: -200, moral: -2 },
      },
      {
        label: t('Journée télétravail pour tous', 'Remote day for everyone'),
        effects: { moral: 5, stability: -3 },
      },
    ],
  }),
  card({
    id: 'aircon-war',
    title: t('Guerre de la climatisation', 'Air conditioning war'),
    description: t(
      'Le thermostat oscille entre 17 °C et 28 °C toutes les 10 minutes. Des alliances se forment.',
      'The thermostat swings between 17°C and 28°C every 10 minutes. Alliances are forming.',
    ),
    weight: 7,
    choices: [
      { label: t('Verrouiller à 22 °C', 'Lock it at 22°C'), effects: { moral: -3 } },
      {
        label: t('Acheter des plaids et des ventilateurs', 'Buy blankets and fans'),
        effects: { treasury: -500, moral: 4 },
      },
    ],
  }),
  card({
    id: 'fridge-smell',
    title: t('Quelque chose vit dans le frigo', 'Something lives in the fridge'),
    description: t(
      'Un Tupperware de mars dernier a développé une conscience. Il a ouvert un compte LinkedIn.',
      'A Tupperware from last March has developed consciousness. It opened a LinkedIn account.',
    ),
    weight: 6,
    choices: [
      {
        label: t('Grand nettoyage obligatoire', 'Mandatory deep clean'),
        effects: { moral: -3, coffee: 5 },
      },
      {
        label: t('Appeler une entreprise spécialisée', 'Call a specialist company'),
        effects: { treasury: -800, moral: 3 },
      },
    ],
  }),
  card({
    id: 'standup-one-hour',
    title: t('Le stand-up dure 1h', 'The stand-up lasts an hour'),
    description: t(
      'Il a commencé debout. Maintenant tout le monde est assis. Quelqu’un a commandé des croissants.',
      'It started standing. Now everyone is sitting. Someone ordered croissants.',
    ),
    weight: 9,
    cooldownSprints: 2,
    choices: [
      {
        label: t('Stand-up chronométré à 15 min', 'Time-box it to 15 min'),
        effects: { moral: -2, 'moral.PRODUCT_OWNER': -8, debt: -1 },
      },
      {
        label: t('Stand-up asynchrone sur Slack', 'Async stand-up on Slack'),
        effects: { moral: 4, hype: -1 },
      },
      {
        label: t('Apprécier les croissants', 'Enjoy the croissants'),
        effects: { treasury: -60, moral: 5, hype: -2 },
      },
    ],
  }),
  card({
    id: 'meeting-about-meetings',
    title: t('Une réunion pour réduire les réunions', 'A meeting to reduce meetings'),
    description: t(
      'Elle est planifiée tous les jours à 10h. Durée : 1h30.',
      'It is scheduled every day at 10am. Duration: 1h30.',
    ),
    conditions: { hasRole: 'PRODUCT_OWNER' },
    weight: 8,
    choices: [
      {
        label: t('Annuler toutes les réunions récurrentes', 'Cancel all recurring meetings'),
        effects: {
          moral: 8,
          'moral.PRODUCT_OWNER': -15,
          hype: -3,
          unlockAchievement: 'zero-meeting',
        },
      },
      {
        label: t('Y participer (ironie)', 'Attend it (irony)'),
        effects: { moral: -5, 'moral.PRODUCT_OWNER': 5 },
      },
    ],
  }),
  card({
    id: 'slack-outage',
    title: t('Slack est en panne', 'Slack is down'),
    description: t(
      'L’équipe découvre qu’elle peut se parler. À voix haute. C’est déroutant.',
      'The team discovers it can talk. Out loud. It is unsettling.',
    ),
    weight: 6,
    choices: [
      {
        label: t('Profiter du calme pour coder', 'Use the calm to code'),
        effects: { debt: -3, moral: 2, hype: -2 },
      },
      {
        label: t('Migrer vers un autre outil', 'Migrate to another tool'),
        effects: { treasury: -2000, moral: -4, stability: 4 },
      },
    ],
  }),
  card({
    id: 'jira-migration',
    title: t('Migration vers un nouvel outil de tickets', 'Migrating to a new ticketing tool'),
    description: t(
      'L’ancien avait 4 000 tickets ouverts. Le nouveau en a 0. Problème résolu ?',
      'The old one had 4,000 open tickets. The new one has 0. Problem solved?',
    ),
    conditions: { minPhase: 'SEED' },
    weight: 6,
    cooldownSprints: 10,
    choices: [
      {
        label: t('Migrer tous les tickets', 'Migrate every ticket'),
        effects: { sprintsLost: 1, debt: -4 },
      },
      {
        label: t('Repartir de zéro', 'Start from scratch'),
        effects: { debt: 6, moral: 6, hype: 2 },
      },
    ],
  }),
  card({
    id: 'retro-post-its',
    title: t('Rétrospective : 200 post-its', 'Retrospective: 200 sticky notes'),
    description: t(
      'Thème principal : « trop de réunions ». Action décidée : une réunion de suivi.',
      'Main theme: "too many meetings". Action item: a follow-up meeting.',
    ),
    weight: 7,
    choices: [
      {
        label: t('Appliquer vraiment les actions', 'Actually apply the action items'),
        effects: { moral: 6, debt: -2, hype: -2 },
      },
      {
        label: t('Photographier le mur et oublier', 'Take a photo of the wall and forget it'),
        effects: { moral: -4 },
      },
    ],
  }),
  card({
    id: 'okr-season',
    title: t('C’est la saison des OKR', "It's OKR season"),
    description: t(
      'Objectif : « Être la référence ». Résultat clé : « Être encore plus la référence ».',
      'Objective: "Be the reference". Key result: "Be even more the reference".',
    ),
    conditions: { minPhase: 'SEED' },
    weight: 6,
    choices: [
      { label: t('Des OKR ambitieux', 'Ambitious OKRs'), effects: { hype: 6, moral: -5 } },
      { label: t('Des OKR réalistes', 'Realistic OKRs'), effects: { moral: 4, hype: -3 } },
    ],
  }),
  card({
    id: 'return-to-office',
    title: t('Retour au bureau obligatoire ?', 'Mandatory return to office?'),
    description: t(
      'Un investisseur trouve que l’open space « manque d’énergie ». Il est vide.',
      'An investor feels the open space "lacks energy". It is empty.',
    ),
    conditions: { minPhase: 'SEED' },
    weight: 6,
    cooldownSprints: 8,
    choices: [
      {
        label: t('5 jours sur 5 au bureau', '5 days a week in the office'),
        effects: { hype: 4, moral: -12 },
      },
      {
        label: t('Garder le télétravail', 'Keep remote work'),
        effects: { moral: 6, hype: -3, 'moral.GHOST': 10 },
      },
    ],
  }),
  card({
    id: 'birthday-cake',
    title: t('Gâteau d’anniversaire surprise', 'Surprise birthday cake'),
    description: t(
      'C’est l’anniversaire de quelqu’un. Personne ne sait de qui. On chante quand même.',
      "It's someone's birthday. Nobody knows whose. Singing happens anyway.",
    ),
    weight: 7,
    cooldownSprints: 2,
    choices: [
      {
        label: t('Gâteau pour tout le monde', 'Cake for everyone'),
        effects: { treasury: -80, moral: 5, coffee: -5 },
      },
      {
        label: t('Rappeler qu’on a une deadline', 'Remind everyone of the deadline'),
        effects: { moral: -6 },
      },
    ],
  }),
  card({
    id: 'fire-drill',
    title: t('Exercice incendie', 'Fire drill'),
    description: t(
      'L’alarme sonne en pleine démo client. Le 10x continue de coder dans l’escalier.',
      'The alarm goes off mid-client demo. The 10x keeps coding on the stairs.',
    ),
    weight: 5,
    choices: [
      { label: t('Évacuer sérieusement', 'Evacuate properly'), effects: { moral: 2, hype: -2 } },
      {
        label: t('« C’est sûrement un test »', '"It\'s probably a test"'),
        effects: { moral: -4, hype: 2 },
      },
    ],
  }),
  card({
    id: 'plant-died',
    title: t('La plante de l’open space est morte', 'The office plant died'),
    description: t(
      'Personne ne l’arrosait. Une enquête interne est ouverte. Le coupable : tout le monde.',
      'Nobody watered it. An internal investigation is open. The culprit: everyone.',
    ),
    weight: 5,
    cooldownSprints: 6,
    choices: [
      {
        label: t('Acheter une plante en plastique', 'Buy a plastic plant'),
        effects: { treasury: -40, moral: 1 },
      },
      {
        label: t('Nommer un « Chief Plant Officer »', 'Appoint a "Chief Plant Officer"'),
        effects: { treasury: -2000, moral: 4, hype: 1 },
      },
    ],
  }),
  card({
    id: 'open-space-noise',
    title: t('L’open space est trop bruyant', 'The open space is too noisy'),
    description: t(
      'Entre les appels commerciaux et le babyfoot, les devs codent avec des bouchons d’oreille.',
      'Between sales calls and foosball, devs code with earplugs.',
    ),
    conditions: { minPhase: 'SEED' },
    weight: 7,
    choices: [
      {
        label: t('Créer une zone silence', 'Create a quiet zone'),
        effects: { treasury: -3000, moral: 5, debt: -2 },
      },
      {
        label: t('Distribuer des bouchons d’oreille', 'Hand out earplugs'),
        effects: { treasury: -30, moral: -2 },
      },
    ],
  }),
  card({
    id: 'all-hands',
    title: t('All-hands trimestriel', 'Quarterly all-hands'),
    description: t(
      'Tu dois faire un discours inspirant. Tu n’as que des chiffres déprimants.',
      'You must give an inspiring speech. All you have are depressing numbers.',
    ),
    conditions: { minPhase: 'SEED' },
    weight: 6,
    cooldownSprints: 6,
    choices: [
      { label: t('Dire la vérité', 'Tell the truth'), effects: { moral: 4, hype: -3 } },
      {
        label: t('Annoncer la conquête de Mars', 'Announce the conquest of Mars'),
        effects: { hype: 8, moral: -3 },
      },
    ],
  }),
  card({
    id: 'printer-jam',
    title: t('L’imprimante a des sentiments', 'The printer has feelings'),
    description: t(
      'Elle n’imprime que les documents qu’elle aime. Elle n’aime pas les contrats.',
      'It only prints documents it likes. It does not like contracts.',
    ),
    weight: 4,
    choices: [
      { label: t('La remplacer', 'Replace it'), effects: { treasury: -300 } },
      {
        label: t('Passer au zéro papier', 'Go paperless'),
        effects: { treasury: -1000, hype: 2, moral: 2 },
      },
    ],
  }),
  card({
    id: 'keyboard-war',
    title: t('Clavier mécanique dans l’open space', 'Mechanical keyboard in the open space'),
    description: t(
      'Switchs bleus. Clac clac clac. Toute la journée. Les voisins ont des cernes.',
      'Blue switches. Clack clack clack. All day. The neighbours have dark circles.',
    ),
    weight: 6,
    choices: [
      {
        label: t('Interdire les switchs bleus', 'Ban blue switches'),
        effects: { moral: 2, 'moral.TEN_X': -8 },
      },
      {
        label: t('Offrir des claviers silencieux à tous', 'Buy silent keyboards for everyone'),
        effects: { treasury: -1500, moral: 4 },
      },
      { label: LATER, effects: { moral: -3, requeue: { delaySprints: 1 } } },
    ],
  }),
];
