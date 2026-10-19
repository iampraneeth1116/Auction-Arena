-- CreateTable
CREATE TABLE "PowerRanking" (
    "roomId" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "rankings" JSONB NOT NULL,
    "generatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PowerRanking_pkey" PRIMARY KEY ("roomId")
);

-- AddForeignKey
ALTER TABLE "PowerRanking" ADD CONSTRAINT "PowerRanking_roomId_fkey" FOREIGN KEY ("roomId") REFERENCES "Room"("id") ON DELETE CASCADE ON UPDATE CASCADE;
