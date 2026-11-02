import {
  AchievementsResponseSchema,
  AdminCardListResponseSchema,
  AdminCardSchema,
  AdminStatsResponseSchema,
  CardSetResponseSchema,
  CharacterPackSchema,
  CharacterPacksResponseSchema,
  DecorThemeSettingSchema,
  DecorThemesResponseSchema,
  DailyResponseSchema,
  LeaderboardResponseSchema,
  OkResponseSchema,
  ProfileResponseSchema,
  ReplayResponseSchema,
  SaveListResponseSchema,
  SaveResponseSchema,
  SlackAiResponseSchema,
  StoryProgressResponseSchema,
  SubmitScoreResponseSchema,
  UnlockAchievementsResponseSchema,
  type MissionCompletion,
  type StoryProgressResponse,
  type AdminCard,
  type AdminCardListItem,
  type AdminCardBody,
  type AdminStatsResponse,
  type AchievementDto,
  type CardSetResponse,
  type CharacterPack,
  type CharacterPackId,
  type DecorMode,
  type DecorTheme,
  type DecorThemeSetting,
  type DailyResponse,
  type GameMode,
  type LeaderboardResponse,
  type ProfileResponse,
  type PutSaveBody,
  type ReplayResponse,
  type SaveListResponse,
  type SaveResponse,
  type SlackAiRequest,
  type SlackAiResponse,
  type SubmitScoreBody,
  type SubmitScoreResponse,
} from '@oss/shared';
import { z } from 'zod';
import { apiRequest } from './client';

/** Construit une chaîne de requête en ignorant les paramètres vides. */
function query(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(([, value]) => value !== undefined);
  return entries.length === 0
    ? ''
    : `?${new URLSearchParams(entries.map(([key, value]) => [key, String(value)])).toString()}`;
}

/** Appels du méta-jeu : cartes, packs de personnages, décorations, sauvegardes, scores, classements, succès, Slack IA, admin. */
export const metaApi = {
  cards: (version?: string): Promise<CardSetResponse> =>
    apiRequest(`/events${query({ version })}`, {
      schema: CardSetResponseSchema,
      retryOnUnauthorized: false,
    }),

  characterPacks: async (): Promise<CharacterPack[]> =>
    (
      await apiRequest('/character-packs', {
        schema: CharacterPacksResponseSchema,
        retryOnUnauthorized: false,
      })
    ).packs,

  decorThemes: async (): Promise<DecorThemeSetting[]> =>
    (
      await apiRequest('/decor-themes', {
        schema: DecorThemesResponseSchema,
        retryOnUnauthorized: false,
      })
    ).themes,

  daily: (): Promise<DailyResponse> =>
    apiRequest('/daily', { schema: DailyResponseSchema, retryOnUnauthorized: false }),

  saves: {
    list: (): Promise<SaveListResponse> => apiRequest('/saves', { schema: SaveListResponseSchema }),
    load: (slot: number): Promise<SaveResponse> =>
      apiRequest(`/saves/${slot}`, { schema: SaveResponseSchema }),
    write: (slot: number, body: PutSaveBody): Promise<SaveResponse> =>
      apiRequest(`/saves/${slot}`, { method: 'PUT', body, schema: SaveResponseSchema }),
    remove: async (slot: number): Promise<void> => {
      await apiRequest(`/saves/${slot}`, { method: 'DELETE', schema: OkResponseSchema });
    },
  },

  submitScore: (body: SubmitScoreBody): Promise<SubmitScoreResponse> =>
    apiRequest('/scores', { method: 'POST', body, schema: SubmitScoreResponseSchema }),

  leaderboard: (
    params: { mode?: GameMode; daily?: string; limit?: number } = {},
  ): Promise<LeaderboardResponse> =>
    apiRequest(`/scores/top${query(params)}`, {
      schema: LeaderboardResponseSchema,
      retryOnUnauthorized: false,
    }),

  replay: (scoreId: string): Promise<ReplayResponse> =>
    apiRequest(`/scores/${encodeURIComponent(scoreId)}/replay`, {
      schema: ReplayResponseSchema,
      retryOnUnauthorized: false,
    }),

  achievements: async (): Promise<AchievementDto[]> =>
    (await apiRequest('/achievements', { schema: AchievementsResponseSchema })).achievements,

  storyProgress: (): Promise<StoryProgressResponse> =>
    apiRequest('/story', { schema: StoryProgressResponseSchema }),

  /** Envoie une mission réussie : le serveur la rejoue avant de la garder sur le compte. */
  completeMission: (body: MissionCompletion): Promise<StoryProgressResponse> =>
    apiRequest('/story/complete', { method: 'POST', body, schema: StoryProgressResponseSchema }),

  unlockAchievements: async (ids: string[]): Promise<string[]> =>
    (
      await apiRequest('/achievements/unlock', {
        method: 'POST',
        body: { ids },
        schema: UnlockAchievementsResponseSchema,
      })
    ).unlocked,

  profile: (): Promise<ProfileResponse> =>
    apiRequest('/me/profile', { schema: ProfileResponseSchema }),

  slackAi: {
    status: (): Promise<{ enabled: boolean; dailyQuota: number }> =>
      apiRequest('/slack-ai/status', {
        schema: z.object({ enabled: z.boolean(), dailyQuota: z.number() }),
        retryOnUnauthorized: false,
      }),
    message: (body: SlackAiRequest): Promise<SlackAiResponse> =>
      apiRequest('/slack-ai/message', { method: 'POST', body, schema: SlackAiResponseSchema }),
  },

  admin: {
    cards: async (): Promise<AdminCardListItem[]> =>
      (await apiRequest('/admin/events', { schema: AdminCardListResponseSchema })).cards,
    create: (card: AdminCardBody): Promise<AdminCard> =>
      apiRequest('/admin/events', { method: 'POST', body: card, schema: AdminCardSchema }),
    update: (card: AdminCardBody): Promise<AdminCard> =>
      apiRequest(`/admin/events/${card.id}`, {
        method: 'PUT',
        body: card,
        schema: AdminCardSchema,
      }),
    disable: (id: string): Promise<AdminCard> =>
      apiRequest(`/admin/events/${id}`, { method: 'DELETE', schema: AdminCardSchema }),
    characterPacks: async (): Promise<CharacterPack[]> =>
      (await apiRequest('/admin/character-packs', { schema: CharacterPacksResponseSchema })).packs,
    setCharacterPack: (id: CharacterPackId, enabled: boolean): Promise<CharacterPack> =>
      apiRequest(`/admin/character-packs/${id}`, {
        method: 'PUT',
        body: { enabled },
        schema: CharacterPackSchema,
      }),
    decorThemes: async (): Promise<DecorThemeSetting[]> =>
      (await apiRequest('/admin/decor-themes', { schema: DecorThemesResponseSchema })).themes,
    setDecorTheme: (id: DecorTheme, mode: DecorMode): Promise<DecorThemeSetting> =>
      apiRequest(`/admin/decor-themes/${id}`, {
        method: 'PUT',
        body: { mode },
        schema: DecorThemeSettingSchema,
      }),
    stats: (): Promise<AdminStatsResponse> =>
      apiRequest('/admin/stats', { schema: AdminStatsResponseSchema }),
  },
};
