/*
  Warnings:

  - A unique constraint covering the columns `[fixtureId,bookmakerId,superOddsType,marketPeriod,marketParameters]` on the table `Odds` will be added. If there are existing duplicate values, this will fail.

*/
-- DropIndex
DROP INDEX "Odds_messageId_key";

-- CreateTable
CREATE TABLE "OddsHistory" (
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

    CONSTRAINT "OddsHistory_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "OddsHistory_messageId_key" ON "OddsHistory"("messageId");

-- CreateIndex
CREATE INDEX "OddsHistory_fixtureId_idx" ON "OddsHistory"("fixtureId");

-- CreateIndex
CREATE INDEX "OddsHistory_fixtureId_superOddsType_idx" ON "OddsHistory"("fixtureId", "superOddsType");

-- CreateIndex
CREATE INDEX "OddsHistory_ts_idx" ON "OddsHistory"("ts");

-- CreateIndex
CREATE UNIQUE INDEX "Odds_fixtureId_bookmakerId_superOddsType_marketPeriod_marke_key" ON "Odds"("fixtureId", "bookmakerId", "superOddsType", "marketPeriod", "marketParameters");

-- AddForeignKey
ALTER TABLE "OddsHistory" ADD CONSTRAINT "OddsHistory_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixtures"("fixture_id") ON DELETE RESTRICT ON UPDATE CASCADE;
