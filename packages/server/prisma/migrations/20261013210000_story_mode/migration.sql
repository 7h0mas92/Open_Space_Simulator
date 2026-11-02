-- Mode Histoire : missions réussies (vérifiées par rejeu) et récompenses utilisées par un score.

-- AlterEnum
ALTER TYPE "GameMode" ADD VALUE 'STORY';

-- AlterTable
ALTER TABLE "Score" ADD COLUMN "unlocks" JSONB NOT NULL DEFAULT '[]';

-- CreateTable
CREATE TABLE "StoryMission" (
    "userId" TEXT NOT NULL,
    "missionId" TEXT NOT NULL,
    "seed" TEXT NOT NULL,
    "commandsLog" JSONB NOT NULL,
    "cardsVersion" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "StoryMission_pkey" PRIMARY KEY ("userId","missionId")
);

-- AddForeignKey
ALTER TABLE "StoryMission" ADD CONSTRAINT "StoryMission_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
