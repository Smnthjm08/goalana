-- AlterTable
ALTER TABLE "markets" ADD COLUMN     "fixedStakeLamports" BIGINT,
ADD COLUMN     "proposedByWallet" TEXT,
ADD COLUMN     "slotsPerSide" INTEGER;

-- CreateTable
CREATE TABLE "market_requests" (
    "id" TEXT NOT NULL,
    "fixtureId" BIGINT NOT NULL,
    "requesterWallet" TEXT NOT NULL,
    "question" TEXT NOT NULL,
    "statAKey" INTEGER NOT NULL,
    "statBKey" INTEGER NOT NULL,
    "op" TEXT NOT NULL DEFAULT 'add',
    "comparison" TEXT NOT NULL DEFAULT 'greaterThan',
    "threshold" INTEGER NOT NULL,
    "fixedStakeLamports" BIGINT NOT NULL,
    "slotsPerSide" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "marketPda" TEXT,
    "reviewNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "market_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "market_requests_fixtureId_idx" ON "market_requests"("fixtureId");

-- CreateIndex
CREATE INDEX "market_requests_status_idx" ON "market_requests"("status");

-- AddForeignKey
ALTER TABLE "market_requests" ADD CONSTRAINT "market_requests_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixtures"("fixtureId") ON DELETE RESTRICT ON UPDATE CASCADE;
