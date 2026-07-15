import { prisma } from "@workspace/db";
import { OddsService } from "@workspace/txline";
import { processOddsUpdate } from "../workers/odds.processor";
import { logger } from "../utils/logger";

let isRunning = false;

export async function syncOdds() {
    if (isRunning) {
        logger.warn(
            "odds.cron",
            "Previous sync is still running. Skipping."
        );
        return;
    }

    isRunning = true;
    logger.info("odds.cron", "Starting odds sync...");

    try {
        const oddsService = new OddsService();
        const fixtures = await prisma.fixture.findMany();

        if (!fixtures || fixtures.length === 0) {
            logger.warn("odds.cron", "No fixtures found to sync odds for.");
            return;
        }

        let totalUpserted = 0;

        for (const fixture of fixtures) {
            const oddsSnapshots = await oddsService.getOddsSnapshots(Number(fixture.fixtureId));

            if (!oddsSnapshots || oddsSnapshots.length === 0) continue;

            // Same canonical persistence/dedup path used by the odds SSE worker —
            // one place decides how a TxLINE odds row is upserted into Odds/OddsHistory.
            for (const market of oddsSnapshots) {
                await processOddsUpdate(market);
            }

            totalUpserted += oddsSnapshots.length;
        }

        logger.success(
            "odds.cron",
            `Successfully synced ${totalUpserted} odds markets across ${fixtures.length} fixtures.`
        );
    } catch (error) {
        logger.error("odds.cron", "Odds sync failed", error);
    } finally {
        isRunning = false;
    }
}
