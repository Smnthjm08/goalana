/*
  Warnings:

  - You are about to drop the `MatchEvent` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `Odds` table. If the table is not empty, all the data it contains will be lost.
  - You are about to drop the `OddsHistory` table. If the table is not empty, all the data it contains will be lost.

*/
-- DropForeignKey
ALTER TABLE "MatchEvent" DROP CONSTRAINT "MatchEvent_fixtureId_fkey";

-- DropForeignKey
ALTER TABLE "Odds" DROP CONSTRAINT "Odds_fixtureId_fkey";

-- DropForeignKey
ALTER TABLE "OddsHistory" DROP CONSTRAINT "OddsHistory_fixtureId_fkey";

-- DropTable
DROP TABLE "MatchEvent";

-- DropTable
DROP TABLE "Odds";

-- DropTable
DROP TABLE "OddsHistory";

-- DropEnum
DROP TYPE "Network";

-- CreateTable
CREATE TABLE "odds" (
    "id" TEXT NOT NULL,
    "fixtureId" BIGINT NOT NULL,
    "messageId" TEXT NOT NULL,
    "ts" BIGINT NOT NULL,
    "bookmaker" TEXT NOT NULL,
    "bookmakerId" INTEGER NOT NULL,
    "superOddsType" TEXT NOT NULL,
    "marketParameters" TEXT NOT NULL DEFAULT '',
    "marketPeriod" TEXT NOT NULL DEFAULT '',
    "inRunning" BOOLEAN NOT NULL,
    "gameState" TEXT,
    "priceNames" JSONB NOT NULL,
    "prices" JSONB NOT NULL,
    "probabilities" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "odds_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "odds_history" (
    "id" TEXT NOT NULL,
    "fixtureId" BIGINT NOT NULL,
    "messageId" TEXT NOT NULL,
    "ts" BIGINT NOT NULL,
    "bookmaker" TEXT NOT NULL,
    "bookmakerId" INTEGER NOT NULL,
    "superOddsType" TEXT NOT NULL,
    "marketParameters" TEXT NOT NULL DEFAULT '',
    "marketPeriod" TEXT NOT NULL DEFAULT '',
    "inRunning" BOOLEAN NOT NULL,
    "gameState" TEXT,
    "priceNames" JSONB NOT NULL,
    "prices" JSONB NOT NULL,
    "probabilities" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "odds_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "match_events" (
    "id" BIGSERIAL NOT NULL,
    "fixtureId" BIGINT NOT NULL,
    "seq" INTEGER NOT NULL,
    "action" TEXT NOT NULL,
    "timestamp" BIGINT NOT NULL,
    "statusId" INTEGER,
    "confirmed" BOOLEAN,
    "payload" JSONB NOT NULL,
    "processed" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "match_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "odds_fixtureId_idx" ON "odds"("fixtureId");

-- CreateIndex
CREATE INDEX "odds_superOddsType_idx" ON "odds"("superOddsType");

-- CreateIndex
CREATE UNIQUE INDEX "odds_fixtureId_bookmakerId_superOddsType_marketPeriod_marke_key" ON "odds"("fixtureId", "bookmakerId", "superOddsType", "marketPeriod", "marketParameters");

-- CreateIndex
CREATE UNIQUE INDEX "odds_history_messageId_key" ON "odds_history"("messageId");

-- CreateIndex
CREATE INDEX "odds_history_fixtureId_idx" ON "odds_history"("fixtureId");

-- CreateIndex
CREATE INDEX "odds_history_fixtureId_superOddsType_idx" ON "odds_history"("fixtureId", "superOddsType");

-- CreateIndex
CREATE INDEX "odds_history_ts_idx" ON "odds_history"("ts");

-- CreateIndex
CREATE INDEX "match_events_fixtureId_idx" ON "match_events"("fixtureId");

-- CreateIndex
CREATE INDEX "match_events_fixtureId_action_idx" ON "match_events"("fixtureId", "action");

-- CreateIndex
CREATE INDEX "match_events_statusId_idx" ON "match_events"("statusId");

-- CreateIndex
CREATE UNIQUE INDEX "match_events_fixtureId_seq_key" ON "match_events"("fixtureId", "seq");

-- AddForeignKey
ALTER TABLE "odds" ADD CONSTRAINT "odds_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixtures"("fixture_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odds_history" ADD CONSTRAINT "odds_history_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixtures"("fixture_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixtures"("fixture_id") ON DELETE RESTRICT ON UPDATE CASCADE;
