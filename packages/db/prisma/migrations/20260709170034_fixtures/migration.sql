-- CreateTable
CREATE TABLE "fixtures" (
    "fixture_id" BIGINT NOT NULL,
    "ts" BIGINT NOT NULL,
    "start_time" BIGINT NOT NULL,
    "competition" TEXT NOT NULL,
    "competition_id" INTEGER NOT NULL,
    "fixture_group_id" INTEGER NOT NULL,
    "participant1_id" INTEGER NOT NULL,
    "participant1" TEXT NOT NULL,
    "participant2_id" INTEGER NOT NULL,
    "participant2" TEXT NOT NULL,
    "participant1_is_home" BOOLEAN NOT NULL,
    "game_state" INTEGER,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "fixtures_pkey" PRIMARY KEY ("fixture_id")
);
