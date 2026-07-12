import { prisma } from "@workspace/db";
import { OddsService } from "@workspace/txline";


let isRunning = false;

export async function syncOdds() {
    if (isRunning) {
        console.warn(
            "[odds.cron] Previous sync is still running. Skipping."
        );
        return;
    }

    isRunning = true;
    console.log("[odds.cron] Starting odds sync...");

    try {
        const oddsService = new OddsService();
        const fixtures = await prisma.fixture.findMany();

        if (!fixtures || fixtures.length === 0) {
            console.warn("[odds.cron] No fixtures found to sync odds for.");
            return;
        }

        let totalUpserted = 0;

        for (const fixture of fixtures) {
            const oddsSnapshots = await oddsService.getOddsSnapshots(Number(fixture.fixtureId));

            if (!oddsSnapshots || oddsSnapshots.length === 0) continue;

            const operations = oddsSnapshots.flatMap((market) => {
                const baseData = {
                    messageId: market.MessageId,
                    ts: BigInt(market.Ts),
                    bookmaker: market.Bookmaker,
                    bookmakerId: market.BookmakerId,
                    superOddsType: market.SuperOddsType,
                    marketPeriod: market.MarketPeriod ?? "",
                    marketParameters: market.MarketParameters ?? "",
                    inRunning: market.InRunning,
                    gameState: market.GameState ?? null,
                    priceNames: market.PriceNames ?? [],
                    prices: market.Prices ?? [],
                    probabilities: market.Pct ?? [],
                };

                return [
                    prisma.odds.upsert({
                        where: {
                            fixtureId_bookmakerId_superOddsType_marketPeriod_marketParameters: {
                                fixtureId: BigInt(market.FixtureId),
                                bookmakerId: market.BookmakerId,
                                superOddsType: market.SuperOddsType,
                                marketPeriod: market.MarketPeriod ?? "",
                                marketParameters: market.MarketParameters ?? "",
                            },
                        },
                        update: baseData,
                        create: {
                            fixtureId: BigInt(market.FixtureId),
                            ...baseData,
                        },
                    }),
                    prisma.oddsHistory.upsert({
                        where: { messageId: market.MessageId },
                        update: {}, // No need to update historical records if they exist
                        create: {
                            fixtureId: BigInt(market.FixtureId),
                            ...baseData,
                        },
                    }),
                ];
            });

            await prisma.$transaction(operations);
            totalUpserted += oddsSnapshots.length;
        }

        console.log(
            `[odds.cron] Successfully synced ${totalUpserted} odds markets across ${fixtures.length} fixtures.`
        );
    } catch (error) {
        console.error("[odds.cron] Odds sync failed:", error);
    } finally {
        isRunning = false;
    }
}
