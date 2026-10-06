-- Étape « Méta » : phase atteinte, statistiques et jeu de cartes des scores, versions de cartes,
-- un seul essai par jour au Daily.

-- CreateEnum
CREATE TYPE "Phase" AS ENUM ('GARAGE', 'SEED', 'SERIES_A', 'UNICORN', 'END');

-- AlterTable
ALTER TABLE "Save" ADD COLUMN     "cardsVersion" TEXT NOT NULL DEFAULT 'builtin',
ADD COLUMN     "commandsLog" JSONB NOT NULL DEFAULT '[]';

-- AlterTable
ALTER TABLE "Score" ADD COLUMN     "cardsVersion" TEXT NOT NULL,
ADD COLUMN     "phaseReached" "Phase" NOT NULL,
ADD COLUMN     "stats" JSONB NOT NULL;

-- CreateTable
CREATE TABLE "CardSet" (
    "version" TEXT NOT NULL,
    "cards" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CardSet_pkey" PRIMARY KEY ("version")
);

-- CreateIndex
CREATE UNIQUE INDEX "Score_userId_dailyDate_key" ON "Score"("userId", "dailyDate");

-- AddForeignKey
ALTER TABLE "Score" ADD CONSTRAINT "Score_cardsVersion_fkey" FOREIGN KEY ("cardsVersion") REFERENCES "CardSet"("version") ON DELETE RESTRICT ON UPDATE CASCADE;

