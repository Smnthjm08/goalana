import { prisma } from "@workspace/db";
import { FixtureService } from "@workspace/txline";
import cron from "node-cron";

let isRunning = false;

export async function syncFixtures() {
    if (isRunning) {
        console.warn(
            "[fixture.cron] Previous sync is still running. Skipping."
        );
        return;
    }

    isRunning = true;
    console.log("[fixture.cron] Starting fixture sync...");

    try {
        const fixtureService = new FixtureService();
        const fixtures = await fixtureService.getFixtureSnapshot(undefined, 72);

        if (!fixtures || fixtures.length === 0) {
            console.warn("[fixture.cron] No fixtures returned from TxLINE.");
            return;
        }

        const operations = fixtures.map((fixture) => {
            const data = {
                ts: BigInt(fixture.Ts),
                startTime: BigInt(fixture.StartTime),
                competition: fixture.Competition,
                competitionId: fixture.CompetitionId,
                fixtureGroupId: fixture.FixtureGroupId,
                participant1Id: fixture.Participant1Id,
                participant1: fixture.Participant1,
                participant2Id: fixture.Participant2Id,
                participant2: fixture.Participant2,
                participant1IsHome: fixture.Participant1IsHome,
                gameState: fixture.GameState ?? null,
            };

            return prisma.fixture.upsert({
                where: {
                    fixtureId: BigInt(fixture.FixtureId),
                },
                update: data,
                create: {
                    fixtureId: BigInt(fixture.FixtureId),
                    ...data,
                },
            });
        });

        await prisma.$transaction(operations);

        console.log(
            `[fixture.cron] Successfully synced ${fixtures.length} fixtures.`
        );
    } catch (error) {
        console.error("[fixture.cron] Fixture sync failed:", error);
    } finally {
        isRunning = false;
    }
}

export function startFixtureCron() {
    // Sync immediately when the API starts
    void syncFixtures();

    // Then sync every 5 minutes
    return cron.schedule("*/5 * * * *", () => {
        void syncFixtures();
    });
}