-- CreateTable
CREATE TABLE "Odds" (
    "id" TEXT NOT NULL,
    "fixtureId" BIGINT NOT NULL,
    "messageId" TEXT NOT NULL,
    "ts" BIGINT NOT NULL,
    "bookmaker" TEXT NOT NULL,
    "bookmakerId" INTEGER NOT NULL,
    "superOddsType" TEXT NOT NULL,
    "marketParameters" TEXT,
    "marketPeriod" TEXT,
    "inRunning" BOOLEAN NOT NULL,
    "gameState" TEXT,
    "priceNames" JSONB NOT NULL,
    "prices" JSONB NOT NULL,
    "probabilities" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Odds_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Odds_messageId_key" ON "Odds"("messageId");

-- CreateIndex
CREATE INDEX "Odds_fixtureId_idx" ON "Odds"("fixtureId");

-- CreateIndex
CREATE INDEX "Odds_superOddsType_idx" ON "Odds"("superOddsType");

-- AddForeignKey
ALTER TABLE "Odds" ADD CONSTRAINT "Odds_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixtures"("fixture_id") ON DELETE RESTRICT ON UPDATE CASCADE;
