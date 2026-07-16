-- AlterTable
ALTER TABLE "markets" ADD COLUMN     "lockTx" TEXT,
ADD COLUMN     "lockedAt" TIMESTAMP(3),
ADD COLUMN     "settledAt" TIMESTAMP(3);
