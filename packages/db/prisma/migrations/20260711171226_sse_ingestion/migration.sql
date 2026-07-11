/*
  Warnings:

  - You are about to drop the column `verified` on the `MatchEvent` table. All the data in the column will be lost.
  - Made the column `marketParameters` on table `Odds` required. This step will fail if there are existing NULL values in that column.
  - Made the column `marketPeriod` on table `Odds` required. This step will fail if there are existing NULL values in that column.
  - Made the column `marketParameters` on table `OddsHistory` required. This step will fail if there are existing NULL values in that column.
  - Made the column `marketPeriod` on table `OddsHistory` required. This step will fail if there are existing NULL values in that column.

*/
-- AlterTable
ALTER TABLE "MatchEvent" DROP COLUMN "verified",
ADD COLUMN     "confirmed" BOOLEAN,
ADD COLUMN     "statusId" INTEGER;

-- AlterTable
ALTER TABLE "Odds" ALTER COLUMN "marketParameters" SET NOT NULL,
ALTER COLUMN "marketParameters" SET DEFAULT '',
ALTER COLUMN "marketPeriod" SET NOT NULL,
ALTER COLUMN "marketPeriod" SET DEFAULT '';

-- AlterTable
ALTER TABLE "OddsHistory" ALTER COLUMN "marketParameters" SET NOT NULL,
ALTER COLUMN "marketParameters" SET DEFAULT '',
ALTER COLUMN "marketPeriod" SET NOT NULL,
ALTER COLUMN "marketPeriod" SET DEFAULT '';

-- CreateIndex
CREATE INDEX "MatchEvent_fixtureId_action_idx" ON "MatchEvent"("fixtureId", "action");

-- CreateIndex
CREATE INDEX "MatchEvent_statusId_idx" ON "MatchEvent"("statusId");
