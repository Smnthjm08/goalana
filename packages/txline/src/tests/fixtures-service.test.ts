import { describe, it, expect } from "bun:test";
import { FixtureService } from "../services/fixtures-service";

describe("FixtureService", () => {
    const service = new FixtureService();

    it("getFixtureSnapshot() returns an array of fixtures", async () => {
        const result = await service.getFixtureSnapshot();

        expect(Array.isArray(result)).toBe(true);

        const fixtures = result as any[];
        console.log(`\n✅ Total fixtures returned: ${fixtures.length}`);

        if (fixtures.length > 0) {
            const first = fixtures[0];
            console.log("\n📌 First fixture sample:");
            console.log(JSON.stringify(first, null, 2));

            for (const fixture of fixtures) {
                expect(typeof fixture.Ts).toBe("number");
                expect(typeof fixture.StartTime).toBe("number");
                expect(typeof fixture.Competition).toBe("string");
                expect(typeof fixture.CompetitionId).toBe("number");
                expect(typeof fixture.FixtureGroupId).toBe("number");
                expect(typeof fixture.Participant1Id).toBe("number");
                expect(typeof fixture.Participant1).toBe("string");
                expect(typeof fixture.Participant2Id).toBe("number");
                expect(typeof fixture.Participant2).toBe("string");
                expect(typeof fixture.FixtureId).toBe("number");
                expect(typeof fixture.Participant1IsHome).toBe("boolean");
            }
        }
    }, 30_000);

    it("getFixtureUpdates(epochDay, hourOfDay) returns fixtures or empty array", async () => {
        // Ts from snapshot: 1783206000000 ms → epoch day 20638 (2026-07-04)
        // Try each hour until we find updates, then validate shape
        const KNOWN_EPOCH_DAY = Math.floor(1783206000000 / 86_400_000); // 20638

        console.log(`\n🔍 Querying fixture updates for epoch day: ${KNOWN_EPOCH_DAY}`);

        let totalFound = 0;

        for (let hour = 0; hour < 24; hour++) {
            const result = await service.getFixtureUpdates(KNOWN_EPOCH_DAY, hour);

            expect(Array.isArray(result)).toBe(true);

            const fixtures = result as any[];
            if (fixtures.length > 0) {
                totalFound += fixtures.length;
                console.log(`\n🕐 Hour ${hour}: ${fixtures.length} update(s)`);
                console.log(JSON.stringify(fixtures[0], null, 2));

                for (const fixture of fixtures) {
                    expect(typeof fixture.Ts).toBe("number");
                    expect(typeof fixture.StartTime).toBe("number");
                    expect(typeof fixture.Competition).toBe("string");
                    expect(typeof fixture.CompetitionId).toBe("number");
                    expect(typeof fixture.FixtureGroupId).toBe("number");
                    expect(typeof fixture.Participant1Id).toBe("number");
                    expect(typeof fixture.Participant1).toBe("string");
                    expect(typeof fixture.Participant2Id).toBe("number");
                    expect(typeof fixture.Participant2).toBe("string");
                    expect(typeof fixture.FixtureId).toBe("number");
                    expect(typeof fixture.Participant1IsHome).toBe("boolean");
                }
            }
        }

        console.log(`\n✅ Total fixture updates found across all hours: ${totalFound}`);
    }, 120_000); // 2min — 24 sequential requests

    it("getFixtureValidation(fixtureId) returns Merkle proof validation data", async () => {
        const fixtureId = 18209181; // France vs Morocco
        const result = await service.getFixtureValidation(fixtureId);

        console.log("\n📌 Fixture Validation sample:");
        console.log(JSON.stringify(result, null, 2));

        if (result) {
            expect(result).toHaveProperty("snapshot");
            expect(result).toHaveProperty("summary");
            expect(result).toHaveProperty("subTreeProof");
            expect(result).toHaveProperty("mainTreeProof");
            expect(result.summary.fixtureId).toBe(fixtureId);
            // Snapshot FixtureId might have category/sport bits (e.g. 1 << 48) prefixed.
            const baseSnapshotFixtureId = Number(BigInt(result.snapshot.FixtureId) % (1n << 48n));
            expect(baseSnapshotFixtureId).toBe(fixtureId);
        }
    }, 30_000);

    it("getFixtureBatchValidation(epochDay, hourOfDay) returns batch Merkle proof", async () => {
        const epochDay = 20638;
        const hourOfDay = 23;
        const result = await service.getFixtureBatchValidation(epochDay, hourOfDay);

        console.log("\n📌 Fixture Batch Validation sample:");
        console.log(JSON.stringify(result, null, 2));

        if (result) {
            expect(result).toHaveProperty("metadata");
            expect(result).toHaveProperty("proof");
            expect(result.metadata).toHaveProperty("totalUpdateCount");
            expect(result.metadata).toHaveProperty("numUniqueFixtures");
            expect(result.metadata).toHaveProperty("overallBatchStartTs");
            expect(result.metadata).toHaveProperty("overallBatchEndTs");
            expect(Array.isArray(result.proof)).toBe(true);
        }
    }, 30_000);
});
