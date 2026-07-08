import { txlineClient } from "../client"

export class FixtureService {
    // 1. Get the latest snapshot of fixtures, optionally starting at or within 30 days after a given epoch day
    async getFixtureSnapshot(startEpochDay?: number) {
        try {
            const CompetitionId = 72;
            const query = new URLSearchParams();
            query.append("competitionId", CompetitionId.toString());
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

    // TODO 3. Get a Merkle proof for a specific fixture update



    // TODO 4. Get a Merkle proof for an entire hourly batch of fixtures



}