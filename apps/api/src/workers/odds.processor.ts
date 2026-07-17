import { prisma } from "@workspace/db";
import type { OddsPayload } from "@workspace/txline";

export async function processOddsUpdate(event: OddsPayload) {
    const fixtureId = BigInt(event.FixtureId);
    const ts = BigInt(event.Ts);
    const marketIdentity = {
        fixtureId,
        bookmakerId: event.BookmakerId,
        superOddsType: event.SuperOddsType,
        marketPeriod: event.MarketPeriod ?? "",
        marketParameters: event.MarketParameters ?? "",
    };
    const baseData = {
        messageId: event.MessageId,
        ts,
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
    const marketKey = {
        fixtureId_bookmakerId_superOddsType_marketPeriod_marketParameters: marketIdentity,
    };

    try {
        await prisma.$transaction(async (tx) => {
            // Current-state row must only ever move forward in time. An SSE
            // reconnect resumes from `lastEventId` and can redeliver frames
            // already applied, and the hourly snapshot resync (fixtures.cron)
            // can race a fresher SSE update — either can otherwise clobber
            // newer odds with stale ones. `updateMany` + a `ts` guard makes
            // this a no-op if a newer row already exists; the upsert below
            // only creates when no row exists yet (first message for this
            // market) and is a genuine no-op update when the guard already
            // won't have applied newer data over stale.
            const advanced = await tx.odds.updateMany({
                where: { ...marketIdentity, ts: { lte: ts } },
                data: baseData,
            });
            if (advanced.count === 0) {
                await tx.odds.upsert({
                    where: marketKey,
                    update: {},
                    create: { fixtureId, ...baseData },
                });
            }

            // OddsHistory is immutable/append-only by messageId already.
            await tx.oddsHistory.upsert({
                where: { messageId: event.MessageId },
                update: {},
                create: { fixtureId, ...baseData },
            });
        });
    } catch (err) {
        console.error(`[odds.processor] Failed to process odds update for fixture ${event.FixtureId}:`, err);
    }
}
