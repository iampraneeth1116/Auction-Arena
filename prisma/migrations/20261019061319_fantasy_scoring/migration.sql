-- CreateTable
CREATE TABLE "PlayerMatchPoint" (
    "id" TEXT NOT NULL,
    "playerId" TEXT NOT NULL,
    "playerName" TEXT NOT NULL,
    "matchId" TEXT NOT NULL,
    "matchName" TEXT NOT NULL,
    "points" DOUBLE PRECISION NOT NULL,
    "details" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "PlayerMatchPoint_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ProcessedMatch" (
    "matchId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "processedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ProcessedMatch_pkey" PRIMARY KEY ("matchId")
);

-- CreateTable
CREATE TABLE "AppConfig" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "AppConfig_pkey" PRIMARY KEY ("key")
);

-- CreateIndex
CREATE UNIQUE INDEX "PlayerMatchPoint_playerId_matchId_key" ON "PlayerMatchPoint"("playerId", "matchId");
