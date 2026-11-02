import {
  STORY_MISSION_IDS,
  storyUnlocks,
  type StoryMissionId,
  type StoryProgressResponse,
  type StoryRewardId,
} from '@oss/shared';
import type { PrismaClient } from '../lib/prisma.js';

/** Missions réussies par un joueur, dans l'ordre de la campagne. */
export async function completedMissions(
  prisma: PrismaClient,
  userId: string,
): Promise<StoryMissionId[]> {
  const rows = await prisma.storyMission.findMany({
    where: { userId },
    select: { missionId: true },
  });
  const done = new Set(rows.map((row) => row.missionId));
  return STORY_MISSION_IDS.filter((id) => done.has(id));
}

/** Progression du mode Histoire : missions réussies et récompenses qu'elles débloquent. */
export async function storyProgressOf(
  prisma: PrismaClient,
  userId: string,
): Promise<StoryProgressResponse> {
  const completed = await completedMissions(prisma, userId);
  return { completed, unlocks: storyUnlocks(completed) };
}

/** Récompenses demandées par une partie mais pas gagnées sur le compte. */
export async function unearnedUnlocks(
  prisma: PrismaClient,
  userId: string,
  unlocks: readonly StoryRewardId[],
): Promise<StoryRewardId[]> {
  if (unlocks.length === 0) return [];
  const earned = new Set(storyUnlocks(await completedMissions(prisma, userId)));
  return unlocks.filter((id) => !earned.has(id));
}
