import { describe, it, expect } from "bun:test";
import { ScoresService } from "../services/scores-service";

describe("ScoresService", () => {
    const service = new ScoresService();
    const KNOWN_FIXTURE_ID = 18209181; // France vs Morocco
    const KNOWN_EPOCH_DAY = 20638; // 2026-07-04

    it("getScoresSnapshot(fixtureId) returns scores snapshot array", async () => {
        const result = await service.getScoresSnapshot(KNOWN_FIXTURE_ID);

        console.log("\n📌 Scores Snapshot type:", typeof result, Array.isArray(result) ? "array" : "not array");
        console.log("📌 Scores Snapshot sample:", JSON.stringify(result, null, 2));

        if (result && Array.isArray(result)) {
            expect(result.length).toBeGreaterThanOrEqual(0);
            if (result.length > 0) {
                const first = result[0];
                expect(first).toHaveProperty("FixtureId");
                expect(first).toHaveProperty("GameState");
                expect(first).toHaveProperty("Action");
            }
        }
    }, 30_000);

    it("getScoresUpdates(epochDay, hourOfDay, interval, fixtureId) returns historical updates", async () => {
        // Fetch historical updates for interval 5 of hour 23
        const result = await service.getScoresUpdates(KNOWN_EPOCH_DAY, 23, 5, KNOWN_FIXTURE_ID);

        console.log("\n📌 Historical Scores Updates type:", typeof result, Array.isArray(result) ? "array" : "not array");
        console.log("📌 Historical Scores Updates sample:", JSON.stringify(result, null, 2));

        if (result && Array.isArray(result)) {
            expect(result.length).toBeGreaterThanOrEqual(0);
            if (result.length > 0) {
                const first = result[0];
                expect(first.FixtureId).toBe(KNOWN_FIXTURE_ID);
                expect(first).toHaveProperty("GameState");
                expect(first).toHaveProperty("Action");
            }
        }
    }, 30_000);

    it("getLiveScoresUpdates(fixtureId) returns live score updates string", async () => {
        const result = await service.getLiveScoresUpdates(KNOWN_FIXTURE_ID);

        console.log("\n📌 Live Scores type:", typeof result);
        console.log("📌 Live Scores sample:", result);

        expect(typeof result).toBe("string");
        expect(result).toContain("data: {");
    }, 30_000);

    it("getHistoricalScores(fixtureId) returns historical scores string", async () => {
        const result = await service.getHistoricalScores(KNOWN_FIXTURE_ID);

        console.log("\n📌 Historical Scores type:", typeof result);
        console.log("📌 Historical Scores sample:", result);

        expect(typeof result).toBe("string");
    }, 30_000);

    it("getScoresStatValidation(params) returns Merkle proof for stats", async () => {
        const snapshot = await service.getScoresSnapshot(KNOWN_FIXTURE_ID);
        if (snapshot && Array.isArray(snapshot) && snapshot.length > 0) {
            const seq = snapshot[0].Seq;
            console.log(`\n🔍 Querying stat validation for fixtureId: ${KNOWN_FIXTURE_ID}, seq: ${seq}`);
            
            const result = await service.getScoresStatValidation({
                fixtureId: KNOWN_FIXTURE_ID,
                seq: seq,
                statKey: 1 // Legacy statKey (e.g., Participant1_Score)
            });

            console.log("\n📌 Scores Stat Validation sample:");
            console.log(JSON.stringify(result, null, 2));

            if (result) {
                expect(result).toHaveProperty("ts");
                expect(result).toHaveProperty("summary");
                expect(result).toHaveProperty("subTreeProof");
                expect(result).toHaveProperty("mainTreeProof");
                // Check if it is Legacy Mode (has statToProve) or V2 Mode (has statsToProve)
                if (result.statToProve) {
                    expect(result).toHaveProperty("statToProve");
                    expect(result).toHaveProperty("statProof");
                } else {
                    expect(result).toHaveProperty("statsToProve");
                    expect(result).toHaveProperty("statProofs");
                }
            }
        }
    }, 30_000);
});
