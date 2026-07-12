-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "displayName" TEXT,
    "totalWagered" BIGINT NOT NULL DEFAULT 0,
    "totalWon" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastActiveAt" TIMESTAMP(3),

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "fixtures" (
    "fixtureId" BIGINT NOT NULL,
    "ts" BIGINT NOT NULL,
    "startTime" BIGINT NOT NULL,
    "competition" TEXT NOT NULL,
    "competitionId" INTEGER NOT NULL,
    "fixtureGroupId" INTEGER NOT NULL,
    "participant1Id" INTEGER NOT NULL,
    "participant1" TEXT NOT NULL,
    "participant2Id" INTEGER NOT NULL,
    "participant2" TEXT NOT NULL,
    "participant1IsHome" BOOLEAN NOT NULL,
    "gameState" INTEGER,
    "finalSeq" INTEGER,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fixtures_pkey" PRIMARY KEY ("fixtureId")
);

-- CreateTable
CREATE TABLE "fixture_updates" (
    "id" TEXT NOT NULL,
    "fixtureId" BIGINT NOT NULL,
    "ts" BIGINT NOT NULL,
    "startTime" BIGINT NOT NULL,
    "competition" TEXT NOT NULL,
    "competitionId" INTEGER NOT NULL,
    "fixtureGroupId" INTEGER NOT NULL,
    "participant1Id" INTEGER NOT NULL,
    "participant1" TEXT NOT NULL,
    "participant2Id" INTEGER NOT NULL,
    "participant2" TEXT NOT NULL,
    "participant1IsHome" BOOLEAN NOT NULL,
    "gameState" INTEGER,
    "payload" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "fixture_updates_pkey" PRIMARY KEY ("id")
);

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

-- CreateTable
CREATE TABLE "fixture_batch_validations" (
    "id" TEXT NOT NULL,
    "epochDay" INTEGER NOT NULL,
    "hourOfDay" INTEGER NOT NULL,
    "validation" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fixture_batch_validations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_walletAddress_key" ON "users"("walletAddress");

-- CreateIndex
CREATE INDEX "fixture_updates_fixtureId_idx" ON "fixture_updates"("fixtureId");

-- CreateIndex
CREATE INDEX "fixture_updates_ts_idx" ON "fixture_updates"("ts");

-- CreateIndex
CREATE UNIQUE INDEX "fixture_updates_fixtureId_ts_key" ON "fixture_updates"("fixtureId", "ts");

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

-- CreateIndex
CREATE UNIQUE INDEX "fixture_batch_validations_epochDay_hourOfDay_key" ON "fixture_batch_validations"("epochDay", "hourOfDay");

-- AddForeignKey
ALTER TABLE "fixture_updates" ADD CONSTRAINT "fixture_updates_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixtures"("fixtureId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odds" ADD CONSTRAINT "odds_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixtures"("fixtureId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odds_history" ADD CONSTRAINT "odds_history_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixtures"("fixtureId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixtures"("fixtureId") ON DELETE RESTRICT ON UPDATE CASCADE;
