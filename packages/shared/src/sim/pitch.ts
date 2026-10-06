import { z } from 'zod';
import type { LocalizedText } from '../i18n.js';

/**
 * Mini-jeu de levée de fonds : face à un investisseur, le joueur choisit un argument
 * par manche. La force d'un argument dépend de l'état de la partie (utilisateurs,
 * dette, moral, hype) et des goûts de l'investisseur.
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
