import { z } from 'zod';
import type { Outcome, Phase } from '../game.js';
import type { LocalizedText } from '../i18n.js';
import type { DevRole } from './components.js';

/**
 * Mode Carrière : refaire le parcours d'une startup devenue géante.
 *
 * Chaque « légende » s'inspire d'une entreprise réelle sans jamais la nommer : nom parodique,
 * histoire racontée par allusions (le garage, la chambre d'étudiant, les matelas gonflables…).
 * Le joueur part avec les mêmes contraintes qu'elle (peu d'argent, un premier profil précis…)
 * et doit tenir ses jalons : atteindre telle phase, tant d'utilisateurs ou telle levée avant un
 * sprint donné, puis finir comme elle (IPO, rachat…).
 *
 * La légende est écrite dans la graine (`career:<légende>:<graine>`) : une partie Carrière se
 * rejoue, se sauvegarde et se vérifie côté serveur exactement comme les autres, sans champ de
 * configuration de plus. Les jalons ne consomment aucun tirage : ils se contentent de lire l'état.
 */

export const CAREER_LEGEND_IDS = [
  'pepin',
  'matelas',
  'rembobine',
  'micromou',
  'trombi',
  'orenoque',
  'centillion',
  'ampere',
] as const;
export const CareerLegendIdSchema = z.enum(CAREER_LEGEND_IDS);
export type CareerLegendId = z.infer<typeof CareerLegendIdSchema>;

/** Jauges et compteurs qu'un jalon peut viser (valeur minimale à atteindre). */
export const CAREER_METRICS = [
  'users',
  'valuation',
  'raised',
  'rounds',
  'features',
  'team',
  'stability',
  'hype',
  'ownership',
] as const;
export type CareerMetric = (typeof CAREER_METRICS)[number];

/**
 * Un jalon de la légende.
 * - `phase` / `metric` avec `bySprint` : à atteindre à une démo, au plus tard à celle du sprint
 *   `bySprint` ; sinon il est manqué.
 * - `metric` sans `bySprint` : vérifié à la fin de la partie (« finir avec… »).
 * - `debtMax` : finir avec une dette technique au plus égale à `max`.
 * - `outcome` : finir par une de ces issues.
 */
export type CareerMilestone =
  | {
      readonly id: string;
      readonly kind: 'phase';
      readonly phase: Phase;
      readonly bySprint: number;
    }
  | {
      readonly id: string;
      readonly kind: 'metric';
      readonly metric: CareerMetric;
      readonly min: number;
      readonly bySprint?: number;
    }
  | { readonly id: string; readonly kind: 'debtMax'; readonly max: number }
  | { readonly id: string; readonly kind: 'outcome'; readonly outcomes: readonly Outcome[] };

export interface CareerLegend {
  readonly id: CareerLegendId;
  readonly icon: string;
  /** Nom parodique de la startup. */
  readonly name: LocalizedText;
  /** Année de création de l'entreprise réelle, pour le clin d'œil. */
  readonly year: number;
  /** De 1 (abordable) à 3 (légendaire). */
  readonly difficulty: 1 | 2 | 3;
  /** L'histoire, racontée par allusions. */
  readonly story: LocalizedText;
  /** Ce qui change au départ, en une phrase. */
  readonly twist: LocalizedText;
  readonly start: {
    /** Trésorerie de départ, en part de la mise de départ habituelle (2 M€). */
    readonly treasuryFactor: number;
    readonly hype?: number;
    readonly debt?: number;
    /** Profil du premier dev, tiré parmi ceux-ci. */
    readonly firstRoles: readonly DevRole[];
    /** Profil d'un second dev présent dès le garage (cofondateur). */
    readonly cofounder?: DevRole;
  };
  readonly milestones: readonly CareerMilestone[];
}

const t = (fr: string, en: string): LocalizedText => ({ fr, en });

export const CAREER_LEGENDS: readonly CareerLegend[] = [
  {
    id: 'pepin',
    icon: '🍏',
    name: t('Pépin Computer', 'Pip Computer'),
    year: 1976,
    difficulty: 1,
    story: t(
      'Deux amis assemblent des ordinateurs dans le garage des parents de l’un d’eux. Le premier ne jure que par le design, le second soude tout lui-même. Leur logo : un fruit croqué.',
      'Two friends build computers in one of their parents’ garage. One swears only by design, the other solders everything himself. Their logo: a bitten fruit.',
    ),
    twist: t(
      'Moitié moins d’argent, mais une designeuse cofondatrice dès le garage.',
      'Half the money, but a designer co-founder from day one.',
    ),
    start: { treasuryFactor: 0.5, firstRoles: ['SENIOR_BEARD'], cofounder: 'DESIGNER' },
    milestones: [
      { id: 'seed', kind: 'phase', phase: 'SEED', bySprint: 6 },
      { id: 'users', kind: 'metric', metric: 'users', min: 150_000, bySprint: 16 },
      { id: 'seriesA', kind: 'phase', phase: 'SERIES_A', bySprint: 20 },
      { id: 'end', kind: 'outcome', outcomes: ['IPO', 'ACQUISITION'] },
    ],
  },
  {
    id: 'matelas',
    icon: '🛏️',
    name: t('Matelas & Céréales', 'Airbeds & Cereal'),
    year: 2008,
    difficulty: 1,
    story: t(
      'Deux colocataires fauchés louent trois matelas gonflables dans leur salon pendant un salon professionnel. Pour tenir, ils vendent des boîtes de céréales décorées. Aujourd’hui, on dort chez l’habitant dans le monde entier.',
      'Two broke roommates rent out three airbeds in their living room during a trade show. To survive, they sell decorated cereal boxes. Today, people sleep in strangers’ homes worldwide.',
    ),
    twist: t(
      'Seulement 600 000 € et une hype au plus bas : chaque euro compte.',
      'Only €600,000 and rock-bottom hype: every euro counts.',
    ),
    start: { treasuryFactor: 0.3, hype: 10, firstRoles: ['TEN_X', 'SENIOR_BEARD'] },
    milestones: [
      { id: 'seed', kind: 'phase', phase: 'SEED', bySprint: 12 },
      { id: 'users', kind: 'metric', metric: 'users', min: 200_000, bySprint: 26 },
      { id: 'valuation', kind: 'metric', metric: 'valuation', min: 150_000_000 },
      { id: 'end', kind: 'outcome', outcomes: ['IPO', 'ACQUISITION'] },
    ],
  },
  {
    id: 'rembobine',
    icon: '📼',
    name: t('Rembobine', 'Rewindr'),
    year: 1997,
    difficulty: 2,
    story: t(
      'Furieux d’une amende de retard au vidéoclub, un fondateur lance la location de DVD par la poste, sans pénalités. Dix ans plus tard, ses films passent directement par Internet, et les vidéoclubs ferment.',
      'Furious about a late fee at the video store, a founder starts renting DVDs by mail, with no penalties. Ten years later, his films stream straight over the Internet, and video stores close.',
    ),
    twist: t(
      'Départ classique, mais le streaming ne pardonne pas une prod instable.',
      'A classic start, but streaming never forgives an unstable prod.',
    ),
    start: { treasuryFactor: 1, firstRoles: ['SENIOR_BEARD', 'TEN_X'] },
    milestones: [
      { id: 'users', kind: 'metric', metric: 'users', min: 100_000, bySprint: 13 },
      { id: 'bigUsers', kind: 'metric', metric: 'users', min: 1_000_000, bySprint: 39 },
      { id: 'stability', kind: 'metric', metric: 'stability', min: 85 },
      { id: 'end', kind: 'outcome', outcomes: ['IPO', 'ACQUISITION'] },
    ],
  },
  {
    id: 'micromou',
    icon: '🪟',
    name: t('MicroMou', 'MicroSquishy'),
    year: 1975,
    difficulty: 2,
    story: t(
      'Deux copains de lycée vendent à un géant de l’informatique un logiciel qu’ils n’ont pas encore écrit… et gardent les droits. Ils le livrent à temps, puis le mettent sur presque tous les ordinateurs de la planète.',
      'Two high-school friends sell a giant computer maker some software they haven’t written yet… and keep the rights. They ship it on time, then put it on almost every computer on the planet.',
    ),
    twist: t(
      'Il faut livrer ce qui a été promis, et garder le contrôle de la boîte.',
      'You must ship what was promised, and keep control of the company.',
    ),
    start: { treasuryFactor: 1, firstRoles: ['TEN_X'] },
    milestones: [
      { id: 'features', kind: 'metric', metric: 'features', min: 25, bySprint: 12 },
      { id: 'users', kind: 'metric', metric: 'users', min: 500_000, bySprint: 30 },
      { id: 'ownership', kind: 'metric', metric: 'ownership', min: 0.4 },
      { id: 'end', kind: 'outcome', outcomes: ['IPO'] },
    ],
  },
  {
    id: 'trombi',
    icon: '📒',
    name: t('Trombinoscope', 'FaceRoll'),
    year: 2004,
    difficulty: 2,
    story: t(
      'Depuis sa chambre d’étudiant, un jeune développeur met en ligne l’annuaire photo de son campus. En quelques semaines, toutes les universités veulent le leur. Puis vos parents. Puis vos grands-parents.',
      'From his dorm room, a young developer puts his campus photo directory online. Within weeks, every university wants one. Then your parents. Then your grandparents.',
    ),
    twist: t(
      'Peu d’argent, mais une hype de départ énorme : il faut grandir très vite.',
      'Little money, but huge starting hype: you have to grow very fast.',
    ),
    start: { treasuryFactor: 0.6, hype: 55, firstRoles: ['TEN_X'] },
    milestones: [
      { id: 'early', kind: 'metric', metric: 'users', min: 30_000, bySprint: 6 },
      { id: 'users', kind: 'metric', metric: 'users', min: 1_000_000, bySprint: 30 },
      { id: 'hype', kind: 'metric', metric: 'hype', min: 40 },
      { id: 'end', kind: 'outcome', outcomes: ['IPO'] },
    ],
  },
  {
    id: 'orenoque',
    icon: '📦',
    name: t('Orénoque', 'Orinoco'),
    year: 1994,
    difficulty: 3,
    story: t(
      'Une librairie en ligne lancée dans un garage, avec des bureaux faits de vieilles portes posées sur des tréteaux. Elle perd de l’argent pendant des années, lève encore et encore, puis finit par tout vendre, à tout le monde.',
      'An online bookshop started in a garage, with desks made of old doors on trestles. It loses money for years, raises again and again, then ends up selling everything to everyone.',
    ),
    twist: t(
      'Le nombre d’utilisateurs avant tout : la rentabilité attendra.',
      'Users above all: profit can wait.',
    ),
    start: { treasuryFactor: 0.75, hype: 20, firstRoles: ['SENIOR_BEARD', 'TEN_X'] },
    milestones: [
      { id: 'users', kind: 'metric', metric: 'users', min: 300_000, bySprint: 20 },
      { id: 'raised', kind: 'metric', metric: 'raised', min: 10_000_000, bySprint: 30 },
      { id: 'bigUsers', kind: 'metric', metric: 'users', min: 1_500_000, bySprint: 39 },
      { id: 'end', kind: 'outcome', outcomes: ['IPO'] },
    ],
  },
  {
    id: 'centillion',
    icon: '🔎',
    name: t('Centillion', 'Centillion'),
    year: 1998,
    difficulty: 3,
    story: t(
      'Deux doctorants classent tout le Web depuis leur chambre d’université, sur des serveurs rangés dans des briques de jouets. Ils baptisent leur moteur d’après un nombre gigantesque, un 1 suivi de cent zéros.',
      'Two PhD students rank the whole Web from their university room, on servers stacked in toy bricks. They name their engine after a gigantic number, a 1 followed by a hundred zeros.',
    ),
    twist: t(
      'Pas de hype au départ : seule la qualité fera venir les utilisateurs.',
      'No hype at the start: only quality will bring users.',
    ),
    start: { treasuryFactor: 1, hype: 5, firstRoles: ['SENIOR_BEARD', 'RUSTACEAN'] },
    milestones: [
      { id: 'users', kind: 'metric', metric: 'users', min: 1_000_000, bySprint: 30 },
      { id: 'unicorn', kind: 'phase', phase: 'UNICORN', bySprint: 36 },
      { id: 'debt', kind: 'debtMax', max: 25 },
      { id: 'end', kind: 'outcome', outcomes: ['IPO'] },
    ],
  },
  {
    id: 'ampere',
    icon: '⚡',
    name: t('Ampère Motors', 'Ampère Motors'),
    year: 2003,
    difficulty: 3,
    story: t(
      'Des ingénieurs veulent rendre la voiture électrique désirable. Un fondateur fantasque y engloutit sa fortune, frôle la faillite plusieurs fois, promet tout pour l’année prochaine, puis devient le constructeur le plus valorisé du monde.',
      'Engineers want to make electric cars desirable. An eccentric founder sinks his fortune into it, nearly goes bankrupt several times, promises everything for next year, then becomes the most valuable carmaker in the world.',
    ),
    twist: t(
      '3 M€ au départ, mais une dette technique déjà lourde et une levée après l’autre à réussir.',
      '€3M to start, but heavy technical debt already and one funding round after another to land.',
    ),
    start: { treasuryFactor: 1.5, hype: 40, debt: 45, firstRoles: ['TEN_X', 'RUSTACEAN'] },
    milestones: [
      { id: 'team', kind: 'metric', metric: 'team', min: 12, bySprint: 26 },
      { id: 'rounds', kind: 'metric', metric: 'rounds', min: 3, bySprint: 30 },
      { id: 'unicorn', kind: 'phase', phase: 'UNICORN', bySprint: 37 },
      { id: 'end', kind: 'outcome', outcomes: ['IPO'] },
    ],
  },
];

const LEGEND_BY_ID = new Map(CAREER_LEGENDS.map((legend) => [legend.id, legend]));

export function careerLegend(id: CareerLegendId): CareerLegend {
  const legend = LEGEND_BY_ID.get(id);
  if (!legend) throw new Error(`Légende inconnue : ${id}`);
  return legend;
}

const CAREER_SEED = /^career:([a-z]+):/;

/** Graine d'une partie Carrière : la légende, puis la graine habituelle (date et hasard). */
export function careerSeed(legend: CareerLegendId, base: string): string {
  return `career:${legend}:${base}`;
}

/** Légende écrite dans la graine, ou null (graine d'un autre mode, ou légende inconnue). */
export function careerLegendOfSeed(seed: string): CareerLegendId | null {
  const match = CAREER_SEED.exec(seed);
  const parsed = CareerLegendIdSchema.safeParse(match?.[1]);
  return parsed.success ? parsed.data : null;
}

export const CAREER_MILESTONE_STATUSES = ['PENDING', 'DONE', 'FAILED'] as const;

export const CareerMilestoneStateSchema = z.object({
  status: z.enum(CAREER_MILESTONE_STATUSES),
  /** Sprint où le jalon a été tenu ou manqué. */
  sprint: z.number().int().nullable(),
});
export type CareerMilestoneState = z.infer<typeof CareerMilestoneStateSchema>;

/** Progression d'une partie Carrière (null dans les autres modes). */
export const CareerStateSchema = z.object({
  legend: CareerLegendIdSchema,
  milestones: z.record(z.string(), CareerMilestoneStateSchema),
});
export type CareerState = z.infer<typeof CareerStateSchema>;

/** Bilan d'une carrière à la fin de la partie. */
export const CareerResultSchema = z.object({
  legend: CareerLegendIdSchema,
  done: z.number().int().nonnegative(),
  total: z.number().int().positive(),
  stars: z.number().int().min(0).max(3),
});
export type CareerResult = z.infer<typeof CareerResultSchema>;

/** Étoiles : 3 si tous les jalons sont tenus, 2 pour au moins la moitié, 1 pour au moins un. */
export function careerStars(done: number, total: number): 0 | 1 | 2 | 3 {
  if (total <= 0 || done <= 0) return 0;
  if (done >= total) return 3;
  if (done * 2 >= total) return 2;
  return 1;
}

const PHASE_NAMES: Record<Phase, LocalizedText> = {
  GARAGE: t('Garage', 'Garage'),
  SEED: t('Seed', 'Seed'),
  SERIES_A: t('Série A', 'Series A'),
  UNICORN: t('Licorne', 'Unicorn'),
  END: t('Fin', 'End'),
};

const OUTCOME_NAMES: Record<Outcome, LocalizedText> = {
  BANKRUPTCY: t('faillite', 'bankruptcy'),
  IPO: t('entrée en Bourse', 'IPO'),
  ACQUISITION: t('rachat', 'acquisition'),
  ZOMBIE: t('zombie', 'zombie'),
};

/** Nombre court : 30 k, 1,5 M, 150 M€, 1 Md€. */
export function careerAmount(value: number, locale: 'fr' | 'en', money = false): string {
  const units: [number, string, string][] = [
    [1e9, ' Md', 'B'],
    [1e6, ' M', 'M'],
    [1e3, ' k', 'k'],
  ];
  for (const [size, fr, en] of units) {
    if (value >= size) {
      const amount = Math.round((value / size) * 10) / 10;
      const digits = locale === 'fr' ? String(amount).replace('.', ',') : String(amount);
      return locale === 'fr'
        ? `${digits}${fr}${money ? ' €' : ''}`
        : `${money ? '€' : ''}${digits}${en}`;
    }
  }
  return locale === 'fr' ? `${value}${money ? ' €' : ''}` : `${money ? '€' : ''}${value}`;
}

function metricGoal(metric: CareerMetric, min: number, locale: 'fr' | 'en'): string {
  const fr = locale === 'fr';
  switch (metric) {
    case 'users':
      return fr
        ? `${careerAmount(min, locale)} utilisateurs`
        : `${careerAmount(min, locale)} users`;
    case 'valuation':
      return fr
        ? `une valorisation de ${careerAmount(min, locale, true)}`
        : `a ${careerAmount(min, locale, true)} valuation`;
    case 'raised':
      return fr
        ? `${careerAmount(min, locale, true)} levés au total`
        : `${careerAmount(min, locale, true)} raised in total`;
    case 'rounds':
      return fr ? `${min} tours de table réussis` : `${min} funding rounds closed`;
    case 'features':
      return fr ? `${min} features livrées` : `${min} features shipped`;
    case 'team':
      return fr ? `une équipe de ${min} personnes` : `a team of ${min} people`;
    case 'stability':
      return fr ? `une stabilité d’au moins ${min}` : `stability of at least ${min}`;
    case 'hype':
      return fr ? `une hype d’au moins ${min}` : `hype of at least ${min}`;
    case 'ownership':
      return fr
        ? `au moins ${Math.round(min * 100)} % du capital`
        : `at least ${Math.round(min * 100)}% of the shares`;
  }
}

function milestoneLabelIn(milestone: CareerMilestone, locale: 'fr' | 'en'): string {
  const fr = locale === 'fr';
  switch (milestone.kind) {
    case 'phase': {
      const phase = PHASE_NAMES[milestone.phase][locale];
      return fr
        ? `Atteindre la phase ${phase} avant la fin du sprint ${milestone.bySprint}`
        : `Reach the ${phase} phase by the end of sprint ${milestone.bySprint}`;
    }
    case 'metric': {
      const goal = metricGoal(milestone.metric, milestone.min, locale);
      if (milestone.bySprint === undefined)
        return fr ? `Finir avec ${goal}` : `Finish with ${goal}`;
      return fr
        ? `Avoir ${goal} avant la fin du sprint ${milestone.bySprint}`
        : `Have ${goal} by the end of sprint ${milestone.bySprint}`;
    }
    case 'debtMax':
      return fr
        ? `Finir avec une dette technique d’au plus ${milestone.max}`
        : `Finish with technical debt of at most ${milestone.max}`;
    case 'outcome': {
      const names = milestone.outcomes.map((outcome) => OUTCOME_NAMES[outcome][locale]);
      return fr ? `Finir par : ${names.join(' ou ')}` : `End with: ${names.join(' or ')}`;
    }
  }
}

/** Intitulé d'un jalon (« Avoir 100 k utilisateurs avant la fin du sprint 20 »). */
export function careerMilestoneLabel(milestone: CareerMilestone): LocalizedText {
  return { fr: milestoneLabelIn(milestone, 'fr'), en: milestoneLabelIn(milestone, 'en') };
}

/** Le jalon se vérifie-t-il seulement à la fin de la partie ? */
export function isEndMilestone(milestone: CareerMilestone): boolean {
  return (
    milestone.kind === 'debtMax' ||
    milestone.kind === 'outcome' ||
    (milestone.kind === 'metric' && milestone.bySprint === undefined)
  );
}
