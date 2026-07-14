-- CreateTable
CREATE TABLE "markets" (
    "id" TEXT NOT NULL,
    "fixtureId" BIGINT NOT NULL,
    "marketPda" TEXT NOT NULL,
    "predicateHash" TEXT NOT NULL,
    "marketType" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "locksAt" TIMESTAMP(3) NOT NULL,
    "settleAfter" TIMESTAMP(3) NOT NULL,
    "creationTx" TEXT,
    "sourceOddsMessageId" TEXT NOT NULL,
    "initialYesPct" DOUBLE PRECISION NOT NULL,
    "initialNoPct" DOUBLE PRECISION NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "markets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "markets_marketPda_key" ON "markets"("marketPda");

-- AddForeignKey
ALTER TABLE "markets" ADD CONSTRAINT "markets_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixtures"("fixtureId") ON DELETE RESTRICT ON UPDATE CASCADE;
