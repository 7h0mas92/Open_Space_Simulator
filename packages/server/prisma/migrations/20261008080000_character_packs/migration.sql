-- Packs de personnages thématiques activables depuis le back-office.

-- CreateTable
CREATE TABLE "CharacterPack" (
    "id" TEXT NOT NULL,
    "enabled" BOOLEAN NOT NULL DEFAULT false,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterPack_pkey" PRIMARY KEY ("id")
);
