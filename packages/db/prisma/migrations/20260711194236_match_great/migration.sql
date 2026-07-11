/*
  Warnings:

  - The primary key for the `fixtures` table will be changed. If it partially fails, the table could be left without primary key constraint.
  - You are about to drop the column `competition_id` on the `fixtures` table. All the data in the column will be lost.
  - You are about to drop the column `final_seq` on the `fixtures` table. All the data in the column will be lost.
  - You are about to drop the column `fixture_group_id` on the `fixtures` table. All the data in the column will be lost.
  - You are about to drop the column `fixture_id` on the `fixtures` table. All the data in the column will be lost.
  - You are about to drop the column `game_state` on the `fixtures` table. All the data in the column will be lost.
  - You are about to drop the column `participant1_id` on the `fixtures` table. All the data in the column will be lost.
  - You are about to drop the column `participant1_is_home` on the `fixtures` table. All the data in the column will be lost.
  - You are about to drop the column `participant2_id` on the `fixtures` table. All the data in the column will be lost.
  - You are about to drop the column `start_time` on the `fixtures` table. All the data in the column will be lost.
  - You are about to drop the column `updated_at` on the `fixtures` table. All the data in the column will be lost.
  - Added the required column `competitionId` to the `fixtures` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fixtureGroupId` to the `fixtures` table without a default value. This is not possible if the table is not empty.
  - Added the required column `fixtureId` to the `fixtures` table without a default value. This is not possible if the table is not empty.
  - Added the required column `participant1Id` to the `fixtures` table without a default value. This is not possible if the table is not empty.
  - Added the required column `participant1IsHome` to the `fixtures` table without a default value. This is not possible if the table is not empty.
  - Added the required column `participant2Id` to the `fixtures` table without a default value. This is not possible if the table is not empty.
  - Added the required column `startTime` to the `fixtures` table without a default value. This is not possible if the table is not empty.
  - Added the required column `updatedAt` to the `fixtures` table without a default value. This is not possible if the table is not empty.

*/
-- DropForeignKey
ALTER TABLE "match_events" DROP CONSTRAINT "match_events_fixtureId_fkey";

-- DropForeignKey
ALTER TABLE "odds" DROP CONSTRAINT "odds_fixtureId_fkey";

-- DropForeignKey
ALTER TABLE "odds_history" DROP CONSTRAINT "odds_history_fixtureId_fkey";

-- AlterTable
ALTER TABLE "fixtures" DROP CONSTRAINT "fixtures_pkey",
DROP COLUMN "competition_id",
DROP COLUMN "final_seq",
DROP COLUMN "fixture_group_id",
DROP COLUMN "fixture_id",
DROP COLUMN "game_state",
DROP COLUMN "participant1_id",
DROP COLUMN "participant1_is_home",
DROP COLUMN "participant2_id",
DROP COLUMN "start_time",
DROP COLUMN "updated_at",
ADD COLUMN     "competitionId" INTEGER NOT NULL,
ADD COLUMN     "finalSeq" INTEGER,
ADD COLUMN     "fixtureGroupId" INTEGER NOT NULL,
ADD COLUMN     "fixtureId" BIGINT NOT NULL,
ADD COLUMN     "gameState" INTEGER,
ADD COLUMN     "participant1Id" INTEGER NOT NULL,
ADD COLUMN     "participant1IsHome" BOOLEAN NOT NULL,
ADD COLUMN     "participant2Id" INTEGER NOT NULL,
ADD COLUMN     "startTime" BIGINT NOT NULL,
ADD COLUMN     "updatedAt" TIMESTAMP(3) NOT NULL,
ADD CONSTRAINT "fixtures_pkey" PRIMARY KEY ("fixtureId");

-- AddForeignKey
ALTER TABLE "odds" ADD CONSTRAINT "odds_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixtures"("fixtureId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "odds_history" ADD CONSTRAINT "odds_history_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixtures"("fixtureId") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "match_events" ADD CONSTRAINT "match_events_fixtureId_fkey" FOREIGN KEY ("fixtureId") REFERENCES "fixtures"("fixtureId") ON DELETE RESTRICT ON UPDATE CASCADE;
