import { prisma } from "@workspace/db";
import type { OddsPayload } from "@workspace/txline";

export async function processOddsUpdate(event: OddsPayload) {
    const baseData = {
        messageId: event.MessageId,
        ts: BigInt(event.Ts),
        bookmaker: event.Bookmaker,
        bookmakerId: event.BookmakerId,
        superOddsType: event.SuperOddsType,
        marketPeriod: event.MarketPeriod ?? "",
        marketParameters: event.MarketParameters ?? "",
        inRunning: event.InRunning,
        gameState: event.GameState ?? null,
        priceNames: event.PriceNames ?? [],
        prices: event.Prices ?? [],
        probabilities: event.Pct ?? [],
    };

    try {
        await prisma.$transaction([
            prisma.odds.upsert({
                where: {
                    fixtureId_bookmakerId_superOddsType_marketPeriod_marketParameters: {
                        fixtureId: BigInt(event.FixtureId),
                        bookmakerId: event.BookmakerId,
                        superOddsType: event.SuperOddsType,
                        marketPeriod: event.MarketPeriod ?? "",
                        marketParameters: event.MarketParameters ?? "",
                    },
                },
                update: baseData,
                create: {
                    fixtureId: BigInt(event.FixtureId),
                    ...baseData,
                },
            }),
            prisma.oddsHistory.upsert({
                where: { messageId: event.MessageId },
                update: {}, // immutable history
                create: {
                    fixtureId: BigInt(event.FixtureId),
                    ...baseData,
                }
            })
        ]);
    } catch (err) {
        console.error(`[odds.processor] Failed to process odds update for fixture ${event.FixtureId}:`, err);
    }
}
