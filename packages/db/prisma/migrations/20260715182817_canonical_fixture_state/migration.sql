-- AlterTable
ALTER TABLE "fixtures" ADD COLUMN     "homeScore" INTEGER,
ADD COLUMN     "awayScore" INTEGER,
ADD COLUMN     "liveStatusId" INTEGER,
ADD COLUMN     "livePeriodLabel" TEXT,
ADD COLUMN     "clockSeconds" INTEGER,
ADD COLUMN     "clockRunning" BOOLEAN,
ADD COLUMN     "lastEventSeq" INTEGER,
ADD COLUMN     "lastEventTs" BIGINT;
