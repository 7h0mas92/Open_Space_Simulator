-- Thèmes de décoration de saison réglables depuis le back-office.

-- CreateTable
CREATE TABLE "DecorTheme" (
    "id" TEXT NOT NULL,
    "mode" TEXT NOT NULL DEFAULT 'SEASON',
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "DecorTheme_pkey" PRIMARY KEY ("id")
);
