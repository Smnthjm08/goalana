/*
  Warnings:

  - You are about to drop the column `sequence` on the `MatchEvent` table. All the data in the column will be lost.
  - You are about to drop the column `lastLoggedInAt` on the `users` table. All the data in the column will be lost.
  - You are about to drop the `txline_tokens` table. If the table is not empty, all the data it contains will be lost.
  - A unique constraint covering the columns `[fixtureId,seq]` on the table `MatchEvent` will be added. If there are existing duplicate values, this will fail.
  - Added the required column `seq` to the `MatchEvent` table without a default value. This is not possible if the table is not empty.

*/
-- DropIndex
DROP INDEX "MatchEvent_fixtureId_sequence_key";

-- AlterTable
ALTER TABLE "MatchEvent" DROP COLUMN "sequence",
ADD COLUMN     "seq" INTEGER NOT NULL;

-- AlterTable
ALTER TABLE "fixtures" ADD COLUMN     "final_seq" INTEGER;

-- AlterTable
ALTER TABLE "users" DROP COLUMN "lastLoggedInAt",
ADD COLUMN     "lastActiveAt" TIMESTAMP(3);

-- DropTable
DROP TABLE "txline_tokens";

-- CreateIndex
CREATE UNIQUE INDEX "MatchEvent_fixtureId_seq_key" ON "MatchEvent"("fixtureId", "seq");
