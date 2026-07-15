// fixturs-service.ts
import { txlineClient } from "../client";
import type { TxLineFixture, FixtureValidation, FixtureBatchValidation } from "../types/index";

const WORLD_CUP_COMPETITION_ID = 72;

export class FixtureService {
    // 1. Get the latest snapshot of fixtures, optionally starting at or within 30 days after a given epoch day
    async getFixtureSnapshot(startEpochDay?: number, CompetitionId?: number): Promise<TxLineFixture[]> {
        const query = new URLSearchParams();
        query.append("competitionId", (CompetitionId || WORLD_CUP_COMPETITION_ID).toString());
        if (startEpochDay != null) query.append("startEpochDay", startEpochDay.toString());
        const { data } = await txlineClient.get<TxLineFixture[]>(`/fixtures/snapshot?${query.toString()}`);
        return data;
    }

    // 2. Get all fixture updates for a given epoch day and hour of day (0-23)
    async getFixtureUpdates(epochDay: number, hourOfDay: number): Promise<TxLineFixture[]> {
        const { data } = await txlineClient.get<TxLineFixture[]>(`/fixtures/updates/${epochDay}/${hourOfDay}`);
        return data;
    }

    // 3. Get a Merkle proof for a specific fixture update
    async getFixtureValidation(fixtureId: number, timestamp?: number): Promise<FixtureValidation> {
        const { data } = await txlineClient.get<FixtureValidation>("/fixtures/validation", {
            params: {
                fixtureId,
                ...(timestamp != null ? { timestamp } : {})
            }
        });
        return data;
    }

    // 4. Get a Merkle proof for an entire hourly batch of fixtures
    async getFixtureBatchValidation(epochDay: number, hourOfDay: number): Promise<FixtureBatchValidation> {
        const { data } = await txlineClient.get<FixtureBatchValidation>("/fixtures/batch-validation", {
            params: {
                epochDay,
                hourOfDay
            }
        });
        return data;
    }
}