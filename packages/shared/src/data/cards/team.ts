import type { EventCard } from '../../sim/cards.js';
import { card, LATER, t } from './helpers.js';

/** Cartes « équipe » : profils, moral, relations, RH. */
export const TEAM_CARDS: EventCard[] = [
  card({
    id: 'weekend-hackathon',
    title: t('Un dev propose un hackathon le week-end', 'A dev suggests a weekend hackathon'),
    description: t(
      '« Ce sera fun ! Pizza offerte ! » Le mot « offerte » fait beaucoup de travail dans cette phrase.',
      '"It\'ll be fun! Free pizza!" The word "free" is doing a lot of work in that sentence.',
    ),
    weight: 8,
    cooldownSprints: 5,
    choices: [
      {
        label: t('Oui, pizza pour tout le monde', 'Yes, pizza for everyone'),
        effects: { treasury: -800, hype: 6, debt: 6, moral: -4 },
      },
      {
        label: t('Non, le week-end c’est sacré', 'No, weekends are sacred'),
        effects: { moral: 6, 'moral.TEN_X': -5 },
      },
      {
        label: t('Oui, mais payé double', 'Yes, but double pay'),
        effects: { treasury: -6000, hype: 5, debt: 4, moral: 3 },
      },
    ],
  }),
  card({
    id: 'ten-x-rewrite-weekend',
    title: t('Le 10x a tout réécrit ce week-end', 'The 10x rewrote everything this weekend'),
    description: t(
      'Tout est plus rapide. Plus personne ne comprend rien. Il ne répond plus aux messages.',
      'Everything is faster. Nobody understands anything anymore. They no longer reply to messages.',
    ),
    conditions: { hasRole: 'TEN_X' },
    weight: 9,
    choices: [
      {
        label: t('Merger, on verra bien', "Merge it, we'll see"),
        effects: { hype: 5, debt: 12, stability: -5 },
      },
      {
        label: t('Exiger une documentation', 'Demand documentation'),
        effects: { debt: -2, 'moral.TEN_X': -15 },
      },
      {
        label: t('Revert, avec des félicitations quand même', 'Revert it and praise them anyway'),
        effects: { 'moral.TEN_X': 5, moral: -2 },
      },
    ],
  }),
  card({
    id: 'senior-refuses-framework',
    title: t('Le Senior refuse le nouveau framework', 'The Senior refuses the new framework'),
    description: t(
      '« Il a 2 ans. J’ai des chaussettes plus vieilles que ça. »',
      '"It\'s 2 years old. I have socks older than that."',
    ),
    conditions: { hasRole: 'SENIOR_BEARD' },
    weight: 8,
    choices: [
      {
        label: t('Bonne remarque, on garde l’existant', "They're right, keep what we have"),
        effects: { 'moral.SENIOR_BEARD': 10, debt: -2, hype: -3 },
      },
      {
        label: t('On migre quand même', 'Migrate anyway'),
        effects: { 'moral.SENIOR_BEARD': -20, hype: 4, debt: 5 },
      },
    ],
  }),
  card({
    id: 'designer-padding',
    title: t('La designeuse bloque la release', 'The designer blocks the release'),
    description: t(
      'Le padding du bouton fait 15 px au lieu de 16. C’est « visiblement amateur ».',
      'The button padding is 15px instead of 16. It looks "visibly amateurish".',
    ),
    conditions: { hasRole: 'DESIGNER' },
    weight: 9,
    choices: [
      {
        label: t('Corriger le padding', 'Fix the padding'),
        effects: { 'moral.DESIGNER': 10, hype: 2, moral: -2 },
      },
      {
        label: t('Livrer quand même', 'Ship anyway'),
        effects: { 'moral.DESIGNER': -20, users: 1 },
      },
      {
        label: t('Créer un design system', 'Create a design system'),
        effects: { sprintsLost: 1, 'moral.DESIGNER': 20, debt: -6, hype: 4 },
      },
    ],
  }),
  card({
    id: 'po-roadmap',
    title: t('Le PO a une nouvelle roadmap', 'The PO has a new roadmap'),
    description: t(
      'Elle tient sur 3 écrans, contient 47 epics et le mot « synergie » 12 fois.',
      'It spans 3 screens, has 47 epics and the word "synergy" 12 times.',
    ),
    conditions: { hasRole: 'PRODUCT_OWNER' },
    weight: 8,
    choices: [
      {
        label: t('La suivre à la lettre', 'Follow it to the letter'),
        effects: { hype: 8, moral: -6 },
      },
      {
        label: t('Garder 3 epics', 'Keep 3 epics'),
        effects: { 'moral.PRODUCT_OWNER': -10, moral: 5 },
      },
    ],
  }),
  card({
    id: 'ai-agent-hallucination',
    title: t('L’IA Agent a inventé une API', 'The AI Agent invented an API'),
    description: t(
      'Elle appelle `stripe.makeMoney()` avec beaucoup d’assurance. Ça n’existe pas.',
      'It confidently calls `stripe.makeMoney()`. That does not exist.',
    ),
    conditions: { hasRole: 'AI_AGENT' },
    weight: 9,
    choices: [
      { label: t('Relire tout son code', 'Review all its code'), effects: { debt: -5, moral: -5 } },
      {
        label: t('Lui demander de « réfléchir étape par étape »', 'Ask it to "think step by step"'),
        effects: { debt: 3, hype: 2 },
      },
      {
        label: t('L’implémenter pour de vrai', 'Actually implement it'),
        effects: { treasury: 5000, debt: 6, hype: 4 },
      },
    ],
  }),
  card({
    id: 'ghost-dev-seen',
    title: t('Quelqu’un dit avoir vu le Dev Fantôme', 'Someone claims to have seen the Ghost Dev'),
    description: t(
      'À la boulangerie, ou c’était peut-être un reflet. Ses tickets se ferment toujours.',
      'They were at the bakery, or maybe it was a reflection. Their tickets still close.',
    ),
    conditions: { hasRole: 'GHOST' },
    weight: 6,
    cooldownSprints: 8,
    choices: [
      {
        label: t('Organiser une visio caméra allumée', 'Schedule a camera-on call'),
        effects: { 'moral.GHOST': -15, moral: 3 },
      },
      {
        label: t('Ne surtout rien changer', 'Change nothing at all'),
        effects: { 'moral.GHOST': 5, hype: 1 },
      },
    ],
  }),
  card({
    id: 'linkedin-recruiter',
    title: t('Un recruteur harcèle ton meilleur dev', 'A recruiter is hounding your best dev'),
    description: t(
      'L’offre : +40 %, une trottinette et « une vraie culture du feedback ».',
      'They offer +40%, a scooter and "a real feedback culture".',
    ),
    conditions: { minPhase: 'SEED' },
    weight: 8,
    choices: [
      {
        label: t('Augmenter tout le monde de 10 %', 'Give everyone a 10% raise'),
        effects: { treasury: -20000, moral: 12 },
      },
      { label: t('Laisser faire', 'Let it happen'), effects: { fireDev: 'RANDOM', moral: -5 } },
      {
        label: t('Offrir des stock-options', 'Offer stock options'),
        effects: { moral: 6, hype: 2 },
      },
    ],
  }),
  card({
    id: 'team-building',
    title: t('Proposition de team building', 'Team building proposal'),
    description: t(
      'Au programme : escape game, karaoké et « atelier de co-construction de valeurs ».',
      'On the agenda: escape room, karaoke and a "values co-creation workshop".',
    ),
    weight: 7,
    choices: [
      { label: t('Escape game', 'Escape room'), effects: { treasury: -3000, moral: 8 } },
      {
        label: t('Atelier valeurs (obligatoire)', 'Values workshop (mandatory)'),
        effects: { treasury: -1500, moral: -6, hype: 3 },
      },
      {
        label: t('Un apéro, c’est bien aussi', "Just drinks, that's fine too"),
        effects: { treasury: -400, moral: 4 },
      },
    ],
  }),
  card({
    id: 'dev-wants-raise',
    title: t('Un dev demande une augmentation', 'A dev asks for a raise'),
    description: t(
      'Tableau Excel des commits à l’appui. Le graphique est en 3D.',
      'They prepared an Excel sheet of their commits. The chart is in 3D.',
    ),
    weight: 8,
    cooldownSprints: 3,
    choices: [
      { label: t('Accepter', 'Accept'), effects: { treasury: -12000, moral: 4 } },
      { label: t('Refuser poliment', 'Politely refuse'), effects: { moral: -6 } },
      { label: LATER, effects: { moral: -2, requeue: { delaySprints: 1 } } },
    ],
  }),
  card({
    id: 'office-romance',
    title: t('Deux devs se sont mis en couple', 'Two devs started dating'),
    description: t(
      'Pair programming permanent. Tout le temps. Même aux toilettes.',
      'They now pair-program. All the time. Even in the bathroom.',
    ),
    weight: 5,
    cooldownSprints: 10,
    choices: [
      { label: t('Féliciter le couple', 'Congratulate them'), effects: { moral: 4 } },
      {
        label: t('Changer l’un des deux d’équipe', 'Split them into different teams'),
        effects: { moral: -5, debt: -2 },
      },
    ],
  }),
  card({
    id: 'code-review-war',
    title: t('Guerre de code review', 'Code review war'),
    description: t(
      'Une PR a 312 commentaires. Le débat porte sur tabs contre espaces. Ça dure depuis mardi.',
      'A PR has 312 comments. The debate is tabs vs spaces. It has been going since Tuesday.',
    ),
    weight: 8,
    choices: [
      {
        label: t('Imposer Prettier, fin du débat', 'Enforce Prettier, end of debate'),
        effects: { moral: 2, debt: -3 },
      },
      { label: t('Organiser un vote', 'Hold a vote'), effects: { moral: -4, hype: 1 } },
      {
        label: t('Tabs. Évidemment.', 'Tabs. Obviously.'),
        effects: { moral: -8, 'moral.SENIOR_BEARD': 10 },
      },
    ],
  }),
  card({
    id: 'burnout-warning',
    title: t('L’équipe est épuisée', 'The team is exhausted'),
    description: t(
      'Quelqu’un pleure dans la salle de réunion. Quelqu’un d’autre l’a réservée pour pleurer après.',
      'Someone is crying in the meeting room. Someone else booked it to cry next.',
    ),
    conditions: { gauges: { moral: { max: 40 } } },
    weight: 10,
    cooldownSprints: 3,
    choices: [
      {
        label: t('Une semaine off pour tout le monde', 'A week off for everyone'),
        effects: { sprintsLost: 1, moral: 25 },
      },
      {
        label: t('Un abonnement à une app de méditation', 'A meditation app subscription'),
        effects: { treasury: -1000, moral: 3 },
      },
      {
        label: t('« On est une famille »', '"We are a family"'),
        effects: { moral: -10, fireDev: 'RANDOM' },
      },
    ],
  }),
  card({
    id: 'intern-coffee-order',
    title: t('Le stagiaire a commandé le café', 'The intern ordered the coffee'),
    description: t(
      '400 kg de décaféiné. Remboursement impossible.',
      'They ordered 400 kg of decaf. No refunds.',
    ),
    conditions: { hasRole: 'INTERN' },
    weight: 6,
    choices: [
      {
        label: t('Boire le décaféiné quand même', 'Drink it anyway'),
        effects: { coffee: -25, moral: -3, 'moral.INTERN': 5 },
      },
      {
        label: t('Racheter du vrai café', 'Buy real coffee'),
        effects: { treasury: -15000, coffee: 20 },
      },
    ],
  }),
  card({
    id: 'intern-fixes-bug',
    title: t('Le stagiaire a corrigé un bug vieux de 3 ans', 'The intern fixed a 3-year-old bug'),
    description: t(
      'Personne n’y arrivait. La solution : lire le message d’erreur.',
      'Nobody could do it. They just read the error message.',
    ),
    conditions: { hasRole: 'INTERN' },
    weight: 6,
    cooldownSprints: 6,
    choices: [
      {
        label: t('Féliciter en public', 'Praise them publicly'),
        effects: { 'moral.INTERN': 20, stability: 5, 'moral.SENIOR_BEARD': -5 },
      },
      {
        label: t('Proposer un CDI', 'Offer them a permanent job'),
        effects: { 'moral.INTERN': 25, treasury: -5000, stability: 5 },
      },
    ],
  }),
  card({
    id: 'rustacean-converts-po',
    title: t('Le PO apprend Rust', 'The PO is learning Rust'),
    description: t(
      'Les user stories ont maintenant des lifetimes. Personne ne comprend les specs.',
      'They now write user stories with lifetimes. Nobody understands the specs.',
    ),
    conditions: { hasRole: 'RUSTACEAN', minPhase: 'SEED' },
    weight: 5,
    cooldownSprints: 10,
    choices: [
      {
        label: t('Encourager', 'Encourage it'),
        effects: { 'moral.RUSTACEAN': 10, hype: -2, debt: -3 },
      },
      {
        label: t('Interdire Rust en réunion', 'Ban Rust in meetings'),
        effects: { 'moral.RUSTACEAN': -10, moral: 3 },
      },
    ],
  }),
  card({
    id: 'referral-bonus',
    title: t('Un dev recommande un ami', 'A dev refers a friend'),
    description: t(
      '« C’est un génie, on était en école ensemble. » Abandon en première année.',
      '"They\'re a genius, we were at school together." They dropped out in first year.',
    ),
    conditions: { minPhase: 'SEED' },
    weight: 6,
    choices: [
      { label: t('Embaucher', 'Hire them'), effects: { spawnDev: 'TEN_X', treasury: -2000 } },
      {
        label: t('Prendre un stagiaire à la place', 'Take an intern instead'),
        effects: { spawnDev: 'INTERN' },
      },
      { label: t('Décliner', 'Decline'), effects: { moral: -2 } },
    ],
  }),
  card({
    id: 'free-ai-agent',
    title: t('Un éditeur offre un IA Agent en essai', 'A vendor offers a free AI Agent trial'),
    description: t(
      '« Il remplace 10 devs ! » Les 10 devs en question lisent l’email par-dessus ton épaule.',
      '"It replaces 10 devs!" The 10 devs in question are reading the email over your shoulder.',
    ),
    weight: 6,
    cooldownSprints: 8,
    choices: [
      { label: t('L’essayer', 'Try it'), effects: { spawnDev: 'AI_AGENT', moral: -6 } },
      { label: t('Refuser fièrement', 'Proudly refuse'), effects: { moral: 4, hype: -2 } },
    ],
  }),
  card({
    id: 'dev-side-project',
    title: t('Un dev a un side project', 'A dev has a side project'),
    description: t(
      'Une app de recettes codée pendant les heures de travail. Elle a plus d’utilisateurs que la vôtre.',
      'They build their recipe app during work hours. It has more users than yours.',
    ),
    weight: 6,
    choices: [
      {
        label: t('Racheter l’app', 'Acquire it'),
        effects: { treasury: -30000, users: 10, hype: 4 },
      },
      { label: t('Interdire les side projects', 'Ban side projects'), effects: { moral: -8 } },
      {
        label: t('Faire semblant de ne rien voir', 'Pretend not to see'),
        effects: { moral: 3, hype: -1 },
      },
    ],
  }),
  card({
    id: 'yelling-at-screen',
    title: t('Quelqu’un crie sur son écran', 'Someone is yelling at their screen'),
    description: t(
      '« POURQUOI ÇA MARCHE ?? » Ce n’est pas une question rhétorique.',
      '"WHY DOES IT WORK??" It is not a rhetorical question.',
    ),
    conditions: { gauges: { debt: { min: 40 } } },
    weight: 7,
    choices: [
      {
        label: t('Organiser un pair programming', 'Set up pair programming'),
        effects: { debt: -4, moral: 2 },
      },
      {
        label: t(
          'Offrir des écouteurs à réduction de bruit aux autres',
          'Buy noise-cancelling earbuds for everyone else',
        ),
        effects: { treasury: -1200, moral: 3 },
      },
    ],
  }),
];
