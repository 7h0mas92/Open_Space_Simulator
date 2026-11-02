import { z } from 'zod';
import { EventCardListSchema, EventCardSchema } from '../sim/cards.js';
import { CommandLogSchema } from '../sim/commands.js';
import { GameStatsSchema, SaveDataSchema } from '../sim/state.js';
import { GAME, GameModeSchema, OutcomeSchema, PhaseSchema } from '../game.js';
import { LocaleSchema, LocalizedTextSchema } from '../i18n.js';
import { AchievementDtoSchema } from './achievements.js';
import { UserDtoSchema } from '../auth.js';
import { STORY_REWARD_IDS, StoryRewardIdSchema } from '../story/rewards.js';

/**
 * Récompenses du mode Histoire utilisées par une partie (son point de départ, avec la graine).
 * Le serveur vérifie qu'elles ont été gagnées sur le compte avant de rejouer la partie.
 */
export const UnlocksSchema = z.array(StoryRewardIdSchema).max(STORY_REWARD_IDS.length).default([]);

/**
 * Contrats de l'API du méta-jeu : sauvegardes, cartes, scores, classements, replays,
 * Daily, profil, Slack IA et back-office. Le serveur valide les entrées avec ces schémas,
 * le client valide les réponses avec les mêmes.
 */

// ── Cartes ────────────────────────────────────────────────────────────────────

/**
 * Version d'un jeu de cartes : empreinte du contenu, ou `builtin` pour les 100 cartes
 * intégrées au jeu (partie hors ligne sans jamais avoir contacté le serveur). Le serveur
 * garde chaque version servie, pour rejouer une partie avec les cartes qu'elle a connues.
 */
export const BUILTIN_CARDS_VERSION = 'builtin';
export const CardsVersionSchema = z.string().regex(/^(builtin|[a-f0-9]{16})$/);

export const CardSetResponseSchema = z.object({
  version: CardsVersionSchema,
  cards: EventCardListSchema,
});
export type CardSetResponse = z.infer<typeof CardSetResponseSchema>;

// ── Daily ─────────────────────────────────────────────────────────────────────

/** Date au format AAAA-MM-JJ (UTC). */
export const IsoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);

/** Date du jour (UTC), au format AAAA-MM-JJ. */
export function utcDate(date: Date): string {
  return date.toISOString().slice(0, 10);
}

/** Graine du Daily : la même pour tout le monde, comme la grille de Wordle. */
export function dailySeed(date: string): string {
  return `daily-${date}`;
}

export const DailyResponseSchema = z.object({ date: IsoDateSchema, seed: z.string() });
export type DailyResponse = z.infer<typeof DailyResponseSchema>;

// ── Sauvegardes ───────────────────────────────────────────────────────────────

export const SaveSlotSchema = z.coerce.number().int().min(1).max(GAME.saveSlots);

/** Résumé d'une sauvegarde, pour la liste des emplacements. */
export const SaveSummarySchema = z.object({
  slot: z.number().int(),
  mode: GameModeSchema,
  seed: z.string(),
  sprint: z.number().int(),
  phase: PhaseSchema,
  valuation: z.number(),
  cardsVersion: CardsVersionSchema,
  updatedAt: z.iso.datetime(),
});
export type SaveSummary = z.infer<typeof SaveSummarySchema>;

export const SaveListResponseSchema = z.object({ saves: z.array(SaveSummarySchema) });
export type SaveListResponse = z.infer<typeof SaveListResponseSchema>;

export const PutSaveBodySchema = z.object({
  data: SaveDataSchema,
  cardsVersion: CardsVersionSchema,
});
export type PutSaveBody = z.infer<typeof PutSaveBodySchema>;

export const SaveResponseSchema = z.object({
  summary: SaveSummarySchema,
  data: SaveDataSchema,
});
export type SaveResponse = z.infer<typeof SaveResponseSchema>;

// ── Scores, classements, replays ──────────────────────────────────────────────

/**
 * Envoi d'un score : le serveur ne croit que la graine et les commandes. Il rejoue la
 * partie et calcule lui-même l'issue et la valorisation (anti-triche). `claimed` permet
 * de détecter un client désynchronisé ou modifié.
 */
export const SubmitScoreBodySchema = z.object({
  mode: GameModeSchema,
  seed: z.string().min(1).max(64),
  commands: CommandLogSchema,
  cardsVersion: CardsVersionSchema,
  dailyDate: IsoDateSchema.optional(),
  unlocks: UnlocksSchema,
  claimed: z.object({ outcome: OutcomeSchema, valuation: z.number().nonnegative() }).optional(),
});
export type SubmitScoreBody = z.infer<typeof SubmitScoreBodySchema>;

export const ScoreDtoSchema = z.object({
  id: z.string(),
  pseudo: z.string(),
  mode: GameModeSchema,
  valuation: z.number(),
  outcome: OutcomeSchema,
  phaseReached: PhaseSchema,
  sprintsPlayed: z.number().int(),
  dailyDate: IsoDateSchema.nullable(),
  createdAt: z.iso.datetime(),
});
export type ScoreDto = z.infer<typeof ScoreDtoSchema>;

export const SubmitScoreResponseSchema = z.object({
  score: ScoreDtoSchema,
  /** Rang de ce score dans le classement correspondant (mode, ou Daily du jour). */
  rank: z.number().int().positive(),
  /** Succès débloqués pour la première fois par cette partie. */
  newAchievements: z.array(z.string()),
});
export type SubmitScoreResponse = z.infer<typeof SubmitScoreResponseSchema>;

export const LeaderboardQuerySchema = z.object({
  mode: GameModeSchema.optional(),
  /** `today` ou une date AAAA-MM-JJ : classement du Daily de ce jour. */
  daily: z.union([z.literal('today'), IsoDateSchema]).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type LeaderboardQuery = z.input<typeof LeaderboardQuerySchema>;

export const LeaderboardEntrySchema = ScoreDtoSchema.extend({ rank: z.number().int() });
export type LeaderboardEntry = z.infer<typeof LeaderboardEntrySchema>;

export const LeaderboardResponseSchema = z.object({ entries: z.array(LeaderboardEntrySchema) });
export type LeaderboardResponse = z.infer<typeof LeaderboardResponseSchema>;

export const ReplayResponseSchema = z.object({
  score: ScoreDtoSchema,
  seed: z.string(),
  commands: CommandLogSchema,
  cardsVersion: CardsVersionSchema,
  cards: EventCardListSchema,
  unlocks: UnlocksSchema,
});
export type ReplayResponse = z.infer<typeof ReplayResponseSchema>;

// ── Profil ────────────────────────────────────────────────────────────────────

export const ProfileResponseSchema = z.object({
  user: UserDtoSchema,
  totals: z.object({
    gamesPlayed: z.number().int(),
    bestValuation: z.number(),
    outcomes: z.record(OutcomeSchema, z.number().int()),
    /** Statistiques cumulées de toutes les parties publiées. */
    stats: GameStatsSchema.pick({
      featuresShipped: true,
      prodOutages: true,
      burnouts: true,
      resignations: true,
      hired: true,
      fired: true,
      meetings: true,
      cardsResolved: true,
    }),
  }),
  bestGames: z.array(ScoreDtoSchema),
  achievements: z.array(AchievementDtoSchema),
});
export type ProfileResponse = z.infer<typeof ProfileResponseSchema>;

// ── Slack IA ──────────────────────────────────────────────────────────────────

export const SLACK_CHANNEL_IDS = ['general', 'random', 'incidents'] as const;
export const SlackChannelSchema = z.enum(SLACK_CHANNEL_IDS);

/**
 * Ce que le client envoie : un résumé de la partie (jamais l'état complet) et ce qui
 * vient de se passer. L'IA ne fait qu'écrire des messages : elle ne modifie rien.
 */
export const SlackAiRequestSchema = z.object({
  locale: LocaleSchema,
  event: z.object({ kind: z.string().max(40), text: z.string().max(300) }),
  game: z.object({
    phase: PhaseSchema,
    sprint: z.number().int().min(1).max(GAME.totalSprints),
    gauges: z.object({
      treasury: z.number(),
      coffee: z.number(),
      debt: z.number(),
      stability: z.number(),
      hype: z.number(),
      users: z.number(),
    }),
  }),
  devs: z
    .array(
      z.object({
        name: z.string().max(40),
        role: z.string().max(20),
        trait: z.string().max(20),
        morale: z.number(),
      }),
    )
    .min(1)
    .max(8),
});
export type SlackAiRequest = z.infer<typeof SlackAiRequestSchema>;

export const SlackAiMessageSchema = z.object({
  channel: SlackChannelSchema,
  author: z.string().max(40),
  text: z.string().min(1).max(280),
});
export type SlackAiMessage = z.infer<typeof SlackAiMessageSchema>;

export const SlackAiResponseSchema = z.object({
  messages: z.array(SlackAiMessageSchema).max(3),
  /** Vrai si la réponse vient du cache du serveur (pas d'appel à l'API Claude). */
  cached: z.boolean(),
  /** Appels restants aujourd'hui pour ce joueur. */
  remaining: z.number().int().nonnegative(),
});
export type SlackAiResponse = z.infer<typeof SlackAiResponseSchema>;

// ── Back-office ───────────────────────────────────────────────────────────────

export const AdminCardSchema = EventCardSchema.extend({
  active: z.boolean(),
  updatedAt: z.iso.datetime(),
});
export type AdminCard = z.infer<typeof AdminCardSchema>;

/** Ligne de la liste du back-office : la carte et le nombre de fois où elle a été tirée. */
export const AdminCardListItemSchema = AdminCardSchema.extend({
  draws: z.number().int().nonnegative(),
});
export type AdminCardListItem = z.infer<typeof AdminCardListItemSchema>;

export const AdminCardListResponseSchema = z.object({ cards: z.array(AdminCardListItemSchema) });
export type AdminCardListResponse = z.infer<typeof AdminCardListResponseSchema>;

export const AdminCardBodySchema = EventCardSchema.extend({ active: z.boolean().default(true) });
export type AdminCardBody = z.input<typeof AdminCardBodySchema>;

export const AdminStatsResponseSchema = z.object({
  totals: z.object({ users: z.number().int(), games: z.number().int(), cards: z.number().int() }),
  topCards: z.array(
    z.object({ cardId: z.string(), title: LocalizedTextSchema, count: z.number() }),
  ),
  topChoices: z.array(
    z.object({
      cardId: z.string(),
      choiceIndex: z.number().int(),
      title: LocalizedTextSchema,
      label: LocalizedTextSchema,
      count: z.number(),
      /** Part de ce choix parmi tous les choix faits sur cette carte (0 à 1). */
      share: z.number(),
    }),
  ),
  bankruptcyByPhase: z.array(
    z.object({
      phase: PhaseSchema,
      games: z.number().int(),
      bankruptcies: z.number().int(),
      rate: z.number(),
    }),
  ),
  outcomes: z.record(OutcomeSchema, z.number().int()),
});
export type AdminStatsResponse = z.infer<typeof AdminStatsResponseSchema>;
