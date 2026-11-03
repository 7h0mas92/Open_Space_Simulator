import type { EventCard } from '../sim/cards.js';
import type { LocalizedText } from '../i18n.js';
import type { StoryActId } from './acts.js';

/**
 * Cartes d'événements propres à l'histoire « Ctrl+Alt+Fonder » : deux par acte, écrites avec
 * ses personnages (Bastien Lemaître, Mamie Josette, Inès Kader, Gigacorp).
 *
 * Elles ne sont pas en base et ne tombent jamais au tirage (poids 0) : la longue partie les
 * impose à un sprint fixé de chaque acte (`STORY_CARD_SCHEDULE`), sans tirage. La bibliothèque
 * de cartes les ajoute toujours (`CardLibrary`), pour que le client et le rejeu du serveur
 * résolvent les mêmes choix. L'effet `rivals` agit sur les utilisateurs des startups rivales.
 */

const t = (fr: string, en: string): LocalizedText => ({ fr, en });

export const STORY_CARDS: readonly EventCard[] = [
  {
    id: 'story-stolen-slides',
    title: t('Tes slides chez Synergix', 'Your slides at Synergix'),
    description: t(
      'Synergix publie sa présentation aux investisseurs. Ce sont tes slides, avec une autre police. Hugo propose de tout poster sur Twitter.',
      'Synergix publishes its investor deck. It’s your slides, in a different font. Hugo wants to post everything on Twitter.',
    ),
    conditions: {},
    weight: 0,
    cooldownSprints: 0,
    choices: [
      {
        label: t('On poste tout, avec les dates', 'Post everything, with the dates'),
        effects: { hype: 8, rivals: -5, moral: -2 },
      },
      {
        label: t('On se tait et on code', 'Stay quiet and code'),
        effects: { moral: 4, debt: -2 },
      },
    ],
  },
  {
    id: 'story-josette-visit',
    title: t('Mamie Josette passe au garage', 'Granny Josette drops by the garage'),
    description: t(
      'Mamie Josette apporte un gâteau et demande « ce que fait vraiment l’application ». Toute l’équipe s’arrête pour lui faire une démo.',
      'Granny Josette brings a cake and asks “what the app really does”. The whole team stops to give her a demo.',
    ),
    conditions: {},
    weight: 0,
    cooldownSprints: 0,
    choices: [
      {
        label: t('Démo complète, avec le gâteau', 'Full demo, cake included'),
        effects: { moral: 8, coffee: 10, hype: 2 },
      },
      {
        label: t('« On a une mise en prod, Mamie »', '“We have a release, Granny”'),
        effects: { moral: -3, stability: 3 },
      },
    ],
  },
  {
    id: 'story-poach-offer',
    title: t('Bastien débauche ton meilleur dev', 'Bastien poaches your best dev'),
    description: t(
      'Bastien offre à ton meilleur dev le double de son salaire et une sieste-pod. Il hésite devant la machine à café.',
      'Bastien offers your best dev twice their salary and a nap pod. They hesitate by the coffee machine.',
    ),
    conditions: {},
    weight: 0,
    cooldownSprints: 0,
    choices: [
      {
        label: t('Contre-offre généreuse', 'Generous counter-offer'),
        effects: { treasury: -60_000, moral: 5 },
      },
      {
        label: t('Lui parler du projet', 'Talk to them about the mission'),
        effects: { moral: 2, sprintsLost: 0, hype: -1 },
      },
      {
        label: t('Le laisser partir', 'Let them go'),
        effects: { fireDev: 'RANDOM', moral: -8, rivals: 3 },
      },
    ],
  },
  {
    id: 'story-ines-interview',
    title: t('Interview chez TechMatin', 'Interview with TechMorning'),
    description: t(
      'Inès Kader te propose une interview face à Bastien. Elle prévient : « Je pose les questions qui fâchent. »',
      'Inès Kader offers you an interview opposite Bastien. She warns: “I ask the tough questions.”',
    ),
    conditions: {},
    weight: 0,
    cooldownSprints: 0,
    choices: [
      {
        label: t('Face à face, en direct', 'Head to head, live'),
        effects: { hype: 10, users: 4, rivals: -4, stability: -3 },
      },
      {
        label: t('Interview écrite, relue trois fois', 'Written interview, proofread three times'),
        effects: { hype: 4 },
      },
    ],
  },
  {
    id: 'story-data-leak',
    title: t('Fuite de données chez Synergix', 'Data leak at Synergix'),
    description: t(
      'Les mots de passe de Synergix traînent sur un forum. Leurs utilisateurs paniquent, et certains t’écrivent.',
      'Synergix passwords are floating around on a forum. Their users are panicking, and some are writing to you.',
    ),
    conditions: {},
    weight: 0,
    cooldownSprints: 0,
    choices: [
      {
        label: t('Campagne « Venez chez nous »', '“Come over to us” campaign'),
        effects: { users: 8, rivals: -10, hype: 3, moral: -3 },
      },
      {
        label: t('Aider leurs équipes à colmater', 'Help their team patch it'),
        effects: { hype: 6, moral: 5, sprintsLost: 0, stability: 2 },
      },
    ],
  },
  {
    id: 'story-pivotly-price',
    title: t('Pivotly passe à 0 €', 'Pivotly goes free'),
    description: t(
      'Pivotly devient gratuit « pour toujours, ou jusqu’au prochain pivot ». Le marketing veut suivre.',
      'Pivotly goes free “forever, or until the next pivot”. Marketing wants to follow.',
    ),
    conditions: {},
    weight: 0,
    cooldownSprints: 0,
    choices: [
      {
        label: t('Offre gratuite, nous aussi', 'Free plan for us too'),
        effects: { users: 10, treasury: -150_000, stability: -4 },
      },
      {
        label: t('Miser sur la qualité', 'Bet on quality'),
        effects: { users: -3, hype: 3, debt: -4 },
      },
    ],
  },
  {
    id: 'story-gigacorp-clone',
    title: t(
      'Gigacorp Teams+ copie ta feature phare',
      'Gigacorp Teams+ copies your flagship feature',
    ),
    description: t(
      'Gigacorp sort ta feature phare, intégrée gratuitement à sa suite. Même le bug du formulaire est là.',
      'Gigacorp ships your flagship feature, bundled for free in its suite. Even the form bug is there.',
    ),
    conditions: {},
    weight: 0,
    cooldownSprints: 0,
    choices: [
      {
        label: t('Livrer la v2 en urgence', 'Ship v2 in a rush'),
        effects: { users: 5, debt: 8, moral: -4 },
      },
      {
        label: t('Porter plainte', 'File a lawsuit'),
        effects: { treasury: -200_000, hype: 5, rivals: -3 },
      },
      {
        label: t('En rire sur les réseaux', 'Laugh about it online'),
        effects: { hype: 7, users: -2 },
      },
    ],
  },
  {
    id: 'story-ines-scoop',
    title: t('Le scoop d’Inès', 'Inès’s scoop'),
    description: t(
      'Inès a les preuves : Bastien a volé ton idée. Elle peut publier, mais te demande ton accord.',
      'Inès has the proof: Bastien stole your idea. She can publish, but asks for your go-ahead.',
    ),
    conditions: {},
    weight: 0,
    cooldownSprints: 0,
    choices: [
      {
        label: t('Publie', 'Publish it'),
        effects: { hype: 12, rivals: -6, moral: 4 },
      },
      {
        label: t('Laisse tomber, on a mieux à faire', 'Drop it, we have better things to do'),
        effects: { moral: 6, stability: 3 },
      },
    ],
  },
  {
    id: 'story-bell-roadshow',
    title: t('La tournée des investisseurs', 'The investor roadshow'),
    description: t(
      'Les banques veulent une tournée de présentations dans 12 villes en 10 jours avant l’entrée en Bourse.',
      'The banks want a roadshow in 12 cities in 10 days before the IPO.',
    ),
    conditions: {},
    weight: 0,
    cooldownSprints: 0,
    choices: [
      {
        label: t('Tout le comité de direction part', 'The whole leadership team goes'),
        effects: { hype: 10, stability: -5, moral: -3 },
      },
      {
        label: t('Visioconférence depuis le bureau', 'Video calls from the office'),
        effects: { hype: 3, stability: 2 },
      },
    ],
  },
  {
    id: 'story-josette-shares',
    title: t('Les parts de Mamie Josette', 'Granny Josette’s shares'),
    description: t(
      'Gigacorp propose à Mamie Josette de lui racheter ses parts. Elle t’appelle : « Je fais quoi, mon petit ? »',
      'Gigacorp offers to buy Granny Josette’s shares. She calls you: “What should I do, sweetie?”',
    ),
    conditions: {},
    weight: 0,
    cooldownSprints: 0,
    choices: [
      {
        label: t('« Garde-les, Mamie »', '“Keep them, Granny”'),
        effects: { moral: 6, hype: 4 },
      },
      {
        label: t('Les racheter toi-même', 'Buy them back yourself'),
        effects: { treasury: -300_000, moral: 8 },
      },
    ],
  },
];

/**
 * Sprint de l'acte (1 = son premier sprint) où chaque carte d'histoire tombe, le mardi à 10h.
 * Une carte dont l'acte est déjà fini ne tombe plus.
 */
export const STORY_CARD_SCHEDULE: Readonly<
  Record<StoryActId, readonly { cardId: string; sprint: number }[]>
> = {
  prologue: [
    { cardId: 'story-stolen-slides', sprint: 2 },
    { cardId: 'story-josette-visit', sprint: 5 },
  ],
  race: [
    { cardId: 'story-poach-offer', sprint: 2 },
    { cardId: 'story-ines-interview', sprint: 5 },
  ],
  'price-war': [
    { cardId: 'story-data-leak', sprint: 2 },
    { cardId: 'story-pivotly-price', sprint: 5 },
  ],
  giant: [
    { cardId: 'story-gigacorp-clone', sprint: 1 },
    { cardId: 'story-ines-scoop', sprint: 4 },
  ],
  bell: [
    { cardId: 'story-bell-roadshow', sprint: 1 },
    { cardId: 'story-josette-shares', sprint: 3 },
  ],
};

/** Jour et heure où tombe une carte d'histoire (mardi, 10h). */
export const STORY_CARD_TIME = { dayOfWeek: 2, hour: 10 } as const;
