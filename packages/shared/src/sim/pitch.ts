import { z } from 'zod';
import type { LocalizedText } from '../i18n.js';

/**
 * Mini-jeu de levée de fonds : face à un investisseur, le joueur répond à une question
 * par manche en choisissant un argument. La force d'un argument dépend de l'état de la
 * partie (utilisateurs, dette, moral, hype), des goûts de l'investisseur et de la question
 * posée. Chaque tour de table (Seed, Série A, Série B…) est plus exigeant que le précédent.
 */

export const PITCH_CATEGORIES = ['TRACTION', 'TECH', 'TEAM', 'VISION', 'BUZZWORD'] as const;
export const PitchCategorySchema = z.enum(PITCH_CATEGORIES);
export type PitchCategory = z.infer<typeof PitchCategorySchema>;

export const INVESTOR_ARCHETYPES = [
  'VC_BRO',
  'BUSINESS_ANGEL',
  'GROWTH_FUND',
  'CORPORATE',
  'PARANOID',
  'SOVEREIGN',
  'CROSSOVER',
] as const;
export const InvestorArchetypeSchema = z.enum(INVESTOR_ARCHETYPES);
export type InvestorArchetype = z.infer<typeof InvestorArchetypeSchema>;

export interface InvestorDefinition {
  archetype: InvestorArchetype;
  name: LocalizedText;
  /** Ce que l'investisseur dit en ouvrant la réunion. */
  intro: LocalizedText;
  /** Multiplicateur appliqué à chaque catégorie d'argument (1 = neutre). */
  likes: Record<PitchCategory, number>;
}

export interface PitchArgumentDefinition {
  id: string;
  category: PitchCategory;
  label: LocalizedText;
  /** Tour de table à partir duquel l'argument peut être proposé (0 = dès le Seed). */
  minTier?: number;
  /**
   * Bluff : très convaincant s'il passe, désastreux si l'investisseur vérifie. Plus le tour
   * est avancé, plus les investisseurs vérifient (`FundingTier.bluffCaught`).
   */
  bluff?: boolean;
}

/** Une question de l'investisseur : elle attend une réponse d'une catégorie donnée. */
export interface PitchQuestionDefinition {
  category: PitchCategory;
  text: LocalizedText;
}

/**
 * Tour de table. L'indice est le nombre de levées déjà réussies : la 1re levée est le
 * Seed, la 2e la Série A, etc. Au-delà du dernier, on reste au niveau le plus dur.
 */
export interface FundingTier {
  name: LocalizedText;
  /** Nombre de questions (manches) de l'investisseur. */
  manches: number;
  /** Arguments proposés à chaque manche. */
  options: number;
  /** Intérêt à dépasser : retranché de l'intérêt final avant la décision. */
  bar: number;
  /** Pénalité d'une réponse hors sujet (catégorie différente de la question). */
  offTopicPenalty: number;
  /** Probabilité qu'un bluff soit démasqué. */
  bluffCaught: number;
  /**
   * Sous cet intérêt (barre déduite), à partir de la 2e réponse, l'investisseur quitte la
   * salle avant la fin (null : jamais).
   */
  walkOut: number | null;
}

const t = (fr: string, en: string): LocalizedText => ({ fr, en });

export const INVESTORS: readonly InvestorDefinition[] = [
  {
    archetype: 'VC_BRO',
    name: t('Chad, associé chez Moonshot Ventures', 'Chad, partner at Moonshot Ventures'),
    intro: t(
      '« Je ne lis pas les slides. Vends-moi du rêve. »',
      '"I don\'t read slides. Sell me the dream."',
    ),
    likes: { TRACTION: 0.8, TECH: 0.5, TEAM: 0.8, VISION: 1.5, BUZZWORD: 1.6 },
  },
  {
    archetype: 'BUSINESS_ANGEL',
    name: t('Martine, ex-fondatrice à la retraite', 'Martine, retired ex-founder'),
    intro: t(
      '« J’investis dans des gens, pas dans des tableurs. »',
      '"I invest in people, not spreadsheets."',
    ),
    likes: { TRACTION: 0.9, TECH: 0.9, TEAM: 1.6, VISION: 1.2, BUZZWORD: 0.4 },
  },
  {
    archetype: 'GROWTH_FUND',
    name: t('Fonds Hypercroissance Capital', 'Hypergrowth Capital Fund'),
    intro: t('« Montrez-moi la courbe. Juste la courbe. »', '"Show me the curve. Just the curve."'),
    likes: { TRACTION: 1.8, TECH: 0.6, TEAM: 0.7, VISION: 0.9, BUZZWORD: 0.7 },
  },
  {
    archetype: 'CORPORATE',
    name: t('Division innovation de MegaCorp', 'MegaCorp innovation division'),
    intro: t(
      '« Nous cherchons des synergies disruptives à fort ROI. »',
      '"We are looking for high-ROI disruptive synergies."',
    ),
    likes: { TRACTION: 1.2, TECH: 1.4, TEAM: 0.8, VISION: 0.8, BUZZWORD: 1 },
  },
  {
    archetype: 'PARANOID',
    name: t('Gérard, investisseur paranoïaque', 'Gerard, paranoid investor'),
    intro: t(
      '« Votre prod tombe le vendredi ? On m’a prévenu. »',
      '"Your prod goes down on Fridays? I\'ve been warned."',
    ),
    likes: { TRACTION: 1.1, TECH: 1.7, TEAM: 1, VISION: 0.6, BUZZWORD: 0.2 },
  },
  {
    archetype: 'SOVEREIGN',
    name: t('Fonds souverain de l’émirat de Kloud', 'Sovereign fund of the Emirate of Kloud'),
    intro: t(
      '« Nous avons 300 milliards et dix minutes. Surtout dix minutes. »',
      '"We have 300 billion and ten minutes. Mostly ten minutes."',
    ),
    likes: { TRACTION: 1.4, TECH: 1.1, TEAM: 0.9, VISION: 1.3, BUZZWORD: 0.3 },
  },
  {
    archetype: 'CROSSOVER',
    name: t('Fonds crossover Pré-IPO Partners', 'Pre-IPO Partners crossover fund'),
    intro: t(
      '« On ne finance que ce qu’on pourra revendre en Bourse. Convaincs-moi. »',
      '"We only fund what we can sell on the stock market. Convince me."',
    ),
    likes: { TRACTION: 1.7, TECH: 1.1, TEAM: 0.8, VISION: 0.7, BUZZWORD: 0.2 },
  },
];

/** Investisseurs des premiers tours ; les fonds souverains et crossover arrivent ensuite. */
export const EARLY_INVESTORS: readonly InvestorArchetype[] = INVESTOR_ARCHETYPES.slice(0, 5);
/** Tour de table à partir duquel les gros fonds (souverain, crossover) s'invitent. */
export const LATE_INVESTOR_TIER = 2;

export const FUNDING_TIERS: readonly FundingTier[] = [
  {
    name: t('Seed', 'Seed'),
    manches: 3,
    options: 3,
    bar: 0,
    offTopicPenalty: 0.3,
    bluffCaught: 0.2,
    walkOut: null,
  },
  {
    name: t('Série A', 'Series A'),
    manches: 3,
    options: 3,
    bar: 0.3,
    offTopicPenalty: 0.5,
    bluffCaught: 0.3,
    walkOut: null,
  },
  {
    name: t('Série B', 'Series B'),
    manches: 4,
    options: 4,
    bar: 0.7,
    offTopicPenalty: 0.7,
    bluffCaught: 0.45,
    walkOut: -3,
  },
  {
    name: t('Série C', 'Series C'),
    manches: 4,
    options: 4,
    bar: 1.1,
    offTopicPenalty: 0.9,
    bluffCaught: 0.55,
    walkOut: -3,
  },
  {
    name: t('Série D', 'Series D'),
    manches: 5,
    options: 4,
    bar: 1.5,
    offTopicPenalty: 1.1,
    bluffCaught: 0.65,
    walkOut: -2.75,
  },
  {
    name: t('Tour pré-IPO', 'Pre-IPO round'),
    manches: 5,
    options: 4,
    bar: 2,
    offTopicPenalty: 1.3,
    bluffCaught: 0.75,
    walkOut: -2.5,
  },
];

/** Tour de table correspondant à un nombre de levées déjà réussies. */
export function fundingTierIndex(fundingRounds: number): number {
  return Math.max(0, Math.min(fundingRounds, FUNDING_TIERS.length - 1));
}

export function fundingTier(fundingRounds: number): FundingTier {
  return FUNDING_TIERS[fundingTierIndex(fundingRounds)] ?? (FUNDING_TIERS[0] as FundingTier);
}

/** Questions de l'investisseur, par catégorie de réponse attendue. */
export const PITCH_QUESTIONS: readonly PitchQuestionDefinition[] = [
  {
    category: 'TRACTION',
    text: t('« Combien d’utilisateurs actifs, vraiment ? »', '"How many active users, really?"'),
  },
  {
    category: 'TRACTION',
    text: t('« Et ça rapporte de l’argent, ce truc ? »', '"Does this thing make any money?"'),
  },
  {
    category: 'TRACTION',
    text: t(
      '« Pourquoi vos clients ne partiraient pas demain ? »',
      '"Why wouldn\'t your customers leave tomorrow?"',
    ),
  },
  {
    category: 'TECH',
    text: t(
      '« Que se passe-t-il si 10 fois plus de gens arrivent lundi ? »',
      '"What happens if 10 times more people show up on Monday?"',
    ),
  },
  {
    category: 'TECH',
    text: t(
      '« On m’a parlé d’une panne un vendredi à 17h… »',
      '"I heard about an outage on a Friday at 5pm…"',
    ),
  },
  {
    category: 'TECH',
    text: t(
      '« Qu’est-ce qui empêche Google de vous copier en un week-end ? »',
      '"What stops Google from copying you in a weekend?"',
    ),
  },
  {
    category: 'TEAM',
    text: t('« Qui fait quoi, dans cette équipe ? »', '"Who does what on this team?"'),
  },
  {
    category: 'TEAM',
    text: t(
      '« Vos devs seront encore là dans six mois ? »',
      '"Will your devs still be here in six months?"',
    ),
  },
  {
    category: 'VISION',
    text: t('« Où serez-vous dans cinq ans ? »', '"Where will you be in five years?"'),
  },
  {
    category: 'VISION',
    text: t(
      '« C’est quoi, le marché, exactement ? En milliards. »',
      '"What is the market, exactly? In billions."',
    ),
  },
  {
    category: 'BUZZWORD',
    text: t('« Et l’IA, dans tout ça ? »', '"And where is the AI in all this?"'),
  },
  {
    category: 'BUZZWORD',
    text: t(
      '« Mon associé veut savoir si c’est « web3 compatible ». »',
      '"My partner wants to know if it\'s "web3 compatible"."',
    ),
  },
];

export const PITCH_ARGUMENTS: readonly PitchArgumentDefinition[] = [
  {
    id: 'users-curve',
    category: 'TRACTION',
    label: t('Montrer la courbe d’utilisateurs (en log)', 'Show the user curve (log scale)'),
  },
  {
    id: 'revenue',
    category: 'TRACTION',
    label: t('Parler du chiffre d’affaires récurrent', 'Talk about recurring revenue'),
  },
  {
    id: 'retention',
    category: 'TRACTION',
    label: t('Insister sur la rétention', 'Insist on retention'),
  },
  {
    id: 'clean-code',
    category: 'TECH',
    label: t('Vanter la qualité du code', 'Brag about code quality'),
  },
  {
    id: 'uptime',
    category: 'TECH',
    label: t('Afficher le 99,9 % de disponibilité', 'Show off 99.9% uptime'),
  },
  {
    id: 'live-demo',
    category: 'TECH',
    label: t('Faire une démo en direct (risqué)', 'Do a live demo (risky)'),
  },
  {
    id: 'dream-team',
    category: 'TEAM',
    label: t('Présenter la dream team', 'Introduce the dream team'),
  },
  {
    id: 'culture',
    category: 'TEAM',
    label: t('Parler de la culture d’entreprise', 'Talk about company culture'),
  },
  {
    id: 'world-domination',
    category: 'VISION',
    label: t('Annoncer la conquête du monde', 'Announce world domination'),
  },
  {
    id: 'next-uber',
    category: 'VISION',
    label: t('« Nous sommes l’Uber du secteur »', '"We are the Uber of the industry"'),
  },
  {
    id: 'ai-powered',
    category: 'BUZZWORD',
    label: t('Dire « IA générative » 14 fois', 'Say "generative AI" 14 times'),
  },
  {
    id: 'blockchain',
    category: 'BUZZWORD',
    label: t('Glisser le mot « blockchain »', 'Drop the word "blockchain"'),
  },
  // Bluffs, dès la Série A : ils rapportent gros… tant que personne ne vérifie.
  {
    id: 'bluff-users',
    category: 'TRACTION',
    label: t(
      'Arrondir les utilisateurs au million supérieur',
      'Round users up to the next million',
    ),
    minTier: 1,
    bluff: true,
  },
  {
    id: 'bluff-contract',
    category: 'VISION',
    label: t(
      'Évoquer un contrat « quasi signé » avec un géant',
      'Mention an "almost signed" deal with a giant',
    ),
    minTier: 1,
    bluff: true,
  },
  {
    id: 'bluff-ai',
    category: 'BUZZWORD',
    label: t(
      'Présenter le stagiaire comme « notre IA propriétaire »',
      'Present the intern as "our proprietary AI"',
    ),
    minTier: 1,
    bluff: true,
  },
  {
    id: 'bluff-hire',
    category: 'TEAM',
    label: t(
      'Annoncer l’arrivée d’une star de la tech qui n’a pas dit oui',
      "Announce a tech star who hasn't said yes yet",
    ),
    minTier: 2,
    bluff: true,
  },
  // Arguments des grands tours : ils demandent de vrais chiffres.
  {
    id: 'unit-economics',
    category: 'TRACTION',
    label: t(
      'Détailler les unit economics (revenus contre dépenses)',
      'Walk through unit economics (revenue vs. expenses)',
    ),
    minTier: 2,
  },
  {
    id: 'path-to-profit',
    category: 'TRACTION',
    label: t('Montrer le chemin vers la rentabilité', 'Show the path to profitability'),
    minTier: 3,
  },
  {
    id: 'tech-moat',
    category: 'TECH',
    label: t(
      'Décrire l’avance technique (et la dette qu’on n’a pas)',
      "Describe the tech moat (and the debt we don't have)",
    ),
    minTier: 2,
  },
  {
    id: 'leadership',
    category: 'TEAM',
    label: t('Présenter l’équipe de direction', 'Introduce the leadership team'),
    minTier: 2,
  },
  {
    id: 'market-share',
    category: 'VISION',
    label: t('Chiffrer la part de marché', 'Put a number on market share'),
    minTier: 2,
  },
];

const ARGUMENTS_BY_ID = new Map(PITCH_ARGUMENTS.map((argument) => [argument.id, argument]));

export function getPitchArgument(id: string): PitchArgumentDefinition | undefined {
  return ARGUMENTS_BY_ID.get(id);
}

export function getInvestor(archetype: InvestorArchetype): InvestorDefinition {
  const investor = INVESTORS.find((candidate) => candidate.archetype === archetype);
  if (!investor) throw new Error(`Investisseur inconnu : ${archetype}`);
  return investor;
}
