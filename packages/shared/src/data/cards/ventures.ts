import type { EventCard } from '../../sim/cards.js';
import { card, LATER, t } from './helpers.js';

/**
 * Cartes « filiales » : elles ne tombent que si la startup a au moins une filiale active.
 * `ventureValue` agit sur la dernière filiale créée encore en vie.
 */
export const VENTURE_CARDS: EventCard[] = [
  card({
    id: 'venture-bridge-round',
    title: t('Ta filiale réclame une rallonge', 'Your subsidiary asks for a bridge round'),
    description: t(
      '« On est à deux doigts du product-market fit. Il nous manque juste 300 k€. Et un produit. »',
      '"We\'re this close to product-market fit. We just need €300k. And a product."',
    ),
    conditions: { hasVenture: true },
    weight: 9,
    cooldownSprints: 5,
    choices: [
      {
        label: t('Remettre au pot', 'Chip in again'),
        effects: { treasury: -300_000, ventureValue: 25 },
      },
      {
        label: t('« Débrouillez-vous »', '"Figure it out"'),
        effects: { ventureValue: -20, hype: -2 },
      },
      {
        label: LATER,
        effects: { requeue: { delaySprints: 1 } },
      },
    ],
  }),
  card({
    id: 'venture-poaching',
    title: t('Ta filiale débauche ton meilleur dev', 'Your subsidiary poaches your best dev'),
    description: t(
      'Son CEO lui a promis des stock-options, un titre de « Head of Everything » et un babyfoot neuf.',
      'Its CEO promised stock options, a "Head of Everything" title and a brand-new foosball table.',
    ),
    conditions: { hasVenture: true },
    weight: 7,
    cooldownSprints: 6,
    choices: [
      {
        label: t('Le laisser partir, c’est pour la famille', "Let them go, it's all in the family"),
        effects: { fireDev: 'RANDOM', ventureValue: 30 },
      },
      {
        label: t('Contre-offre et augmentation', 'Counter-offer and a raise'),
        effects: { treasury: -60_000, moral: 3 },
      },
      {
        label: t('Interdire le débauchage entre filiales', 'Ban poaching between companies'),
        effects: { moral: -6, ventureValue: -5 },
      },
    ],
  }),
  card({
    id: 'venture-ai-pivot',
    title: t('Ta filiale veut pivoter vers l’IA', 'Your subsidiary wants to pivot to AI'),
    description: t(
      '« Même produit, mais on met “IA” dans le nom. Les investisseurs ont déjà dit oui. »',
      '"Same product, but we put \'AI\' in the name. Investors already said yes."',
    ),
    conditions: { hasVenture: true },
    weight: 8,
    cooldownSprints: 8,
    choices: [
      {
        label: t('Banco, renommez tout', 'Go for it, rename everything'),
        effects: { ventureValue: 35, hype: 4, stability: -4 },
      },
      {
        label: t('Rester sur le métier', 'Stick to the core business'),
        effects: { ventureValue: -5, 'moral.SENIOR_BEARD': 6 },
      },
    ],
  }),
  card({
    id: 'venture-synergies',
    title: t('Séminaire « synergies du groupe »', '"Group synergies" offsite'),
    description: t(
      'Deux jours dans un château pour aligner la vision des filiales. Il y a un atelier Lego.',
      "Two days in a castle to align the subsidiaries' vision. There's a Lego workshop.",
    ),
    conditions: { hasVenture: true },
    weight: 7,
    cooldownSprints: 6,
    choices: [
      {
        label: t('Réserver le château', 'Book the castle'),
        effects: { treasury: -80_000, moral: 8, ventureValue: 10 },
      },
      {
        label: t('Une visio d’une heure suffira', 'A one-hour video call will do'),
        effects: { moral: -3, ventureValue: 3 },
      },
    ],
  }),
  card({
    id: 'venture-press-scandal',
    title: t('Ta filiale fait la une', 'Your subsidiary makes headlines'),
    description: t(
      'Un journaliste découvre que son « IA » est en fait trois stagiaires dans un placard.',
      'A journalist finds out its "AI" is actually three interns in a closet.',
    ),
    conditions: { hasVenture: true, minPhase: 'SERIES_A' },
    weight: 6,
    cooldownSprints: 8,
    choices: [
      {
        label: t('Communiqué : « c’est de l’IA hybride »', 'Statement: "it\'s hybrid AI"'),
        effects: { hype: -6, ventureValue: -15 },
      },
      {
        label: t('Recruter les trois stagiaires', 'Hire the three interns'),
        effects: { spawnDev: 'INTERN', hype: 3, ventureValue: -30 },
      },
      {
        label: LATER,
        effects: { requeue: { delaySprints: 1 } },
      },
    ],
  }),
  card({
    id: 'venture-buyout-offer',
    title: t('Un fonds veut entrer dans ta filiale', 'A fund wants in on your subsidiary'),
    description: t(
      '« On adore l’équipe. Enfin, on ne l’a pas rencontrée, mais on adore le deck. »',
      '"We love the team. Well, we haven\'t met them, but we love the deck."',
    ),
    conditions: { hasVenture: true },
    weight: 6,
    cooldownSprints: 8,
    choices: [
      {
        label: t('Accepter : valorisation au plus haut', 'Accept: valuation at its peak'),
        effects: { ventureValue: 40, hype: 3 },
      },
      {
        label: t('Refuser, on garde le contrôle', 'Refuse, we keep control'),
        effects: { 'moral.PRODUCT_OWNER': 5 },
      },
    ],
  }),
];
