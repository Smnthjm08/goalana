import { describe, it, expect } from "bun:test";
import { OddsService } from "../services/odds-service";

describe("OddsService", () => {
    const service = new OddsService();
    const KNOWN_FIXTURE_ID = 18209181; // France vs Morocco
    const KNOWN_EPOCH_DAY = 20638; // 2026-07-04

    it("getOddsSnapshots(fixtureId) returns odds snapshot array", async () => {
        const result = await service.getOddsSnapshots(KNOWN_FIXTURE_ID);

        console.log("\n📌 Odds Snapshot sample:");
        console.log(JSON.stringify(result?.[0] || result, null, 2));

        if (result && Array.isArray(result)) {
            expect(result.length).toBeGreaterThanOrEqual(0);
            if (result.length > 0) {
                const first = result[0];
                expect(first).toHaveProperty("FixtureId");
                expect(first).toHaveProperty("Bookmaker");
                expect(first).toHaveProperty("Prices");
            }
        }
    }, 30_000);

    it("getLiveOddsUpdates(fixtureId) returns live odds updates array", async () => {
        const result = await service.getLiveOddsUpdates(KNOWN_FIXTURE_ID);

        console.log("\n📌 Live Odds Updates sample:");
        console.log(JSON.stringify(result?.[0] || result, null, 2));

        if (result && Array.isArray(result)) {
            expect(result.length).toBeGreaterThanOrEqual(0);
            if (result.length > 0) {
                const first = result[0];
                expect(first).toHaveProperty("FixtureId");
                expect(first).toHaveProperty("Bookmaker");
            }
        }
    }, 30_000);

    it("getOddsIntervalUpdates(epochDay, hourOfDay, interval, fixtureId) returns interval updates", async () => {
        // Try to query interval updates for the known day/hour
        // Sweep interval 0 to 11
        let totalFound = 0;
        for (let interval = 0; interval < 12; interval++) {
            const result = await service.getOddsIntervalUpdates(KNOWN_EPOCH_DAY, 23, interval, KNOWN_FIXTURE_ID);
            if (result && Array.isArray(result) && result.length > 0) {
                totalFound += result.length;
                console.log(`\n🕐 Interval ${interval} (Fixture ID: ${KNOWN_FIXTURE_ID}): ${result.length} update(s)`);
                console.log(JSON.stringify(result[0], null, 2));
                
                const first = result[0];
                expect(first.FixtureId).toBe(KNOWN_FIXTURE_ID);
                expect(first).toHaveProperty("Bookmaker");
                expect(first).toHaveProperty("Prices");
                expect(first).toHaveProperty("Pct");
            }
        }
        console.log(`\n✅ Total odds interval updates found for day ${KNOWN_EPOCH_DAY} hour 23: ${totalFound}`);
    }, 60_000);

    it("getOddsValidation(messageId, ts) returns Merkle proof for specific odds update", async () => {
        // Fetch historical interval updates to get a batched/committed messageId and ts
        const updates = await service.getOddsIntervalUpdates(KNOWN_EPOCH_DAY, 23, 5, KNOWN_FIXTURE_ID);
        if (updates && Array.isArray(updates) && updates.length > 0) {
            const first = updates[0];
            const messageId = first.MessageId;
            const ts = first.Ts;

            console.log(`\n🔍 Querying validation for historical messageId: ${messageId}, ts: ${ts}`);
            const result = await service.getOddsValidation(messageId, ts);

            console.log("\n📌 Odds Validation sample:");
            console.log(JSON.stringify(result, null, 2));

            if (result) {
                expect(result).toHaveProperty("odds");
                expect(result).toHaveProperty("summary");
                expect(result).toHaveProperty("subTreeProof");
                expect(result).toHaveProperty("mainTreeProof");
                expect(result.odds.MessageId).toBe(messageId);
                expect(result.odds.Ts).toBe(ts);
            }
        }
    }, 30_000);
});
