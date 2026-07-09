import { txlineClient } from "../client"

const WORLD_CUP_COMPETITION_ID = 72;

export class FixtureService {
    // 1. Get the latest snapshot of fixtures, optionally starting at or within 30 days after a given epoch day
    async getFixtureSnapshot(startEpochDay?: number, CompetitionId?: number) {
        try {
            const query = new URLSearchParams();
            query.append("competitionId", (CompetitionId || WORLD_CUP_COMPETITION_ID).toString());
            if (startEpochDay != null) query.append("startEpochDay", startEpochDay.toString());
            const { data } = await txlineClient.get(`/fixtures/snapshot?${query.toString()}`);
            return data;
        } catch (error) {
            console.error("Error fetching fixture snapshot", error)
        }
    }

    // 2. Get all fixture updates for a given epoch day and hour of day (0-23)
    async getFixtureUpdates(epochDay: number, hourOfDay: number) {
        try {
            const { data } = await txlineClient.get(`/fixtures/updates/${epochDay}/${hourOfDay}`);
            return data;
        } catch (error) {
            console.error("Error fetching fixture updates", error);
        }
    }

    // 3. Get a Merkle proof for a specific fixture update
    async getFixtureValidation(fixtureId: number, timestamp?: number) {
        try {
            const { data } = await txlineClient.get("/fixtures/validation", {
                params: {
                    fixtureId,
                    ...(timestamp != null ? { timestamp } : {})
                }
            });
            return data;
        } catch (error) {
            console.error("Error fetching fixture validation", error);
        }
    }

    // 4. Get a Merkle proof for an entire hourly batch of fixtures
    async getFixtureBatchValidation(epochDay: number, hourOfDay: number) {
        try {
            const { data } = await txlineClient.get("/fixtures/batch-validation", {
                params: {
                    epochDay,
                    hourOfDay
                }
            });
            return data;
        } catch (error) {
            console.error("Error fetching fixture batch validation", error);
        }
    }
}