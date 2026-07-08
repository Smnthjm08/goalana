import { txlineClient } from "../client";

export class ScoresService {
    // 1. Get snapshots for each action in the latest score events for a fixture
    async getScoresSnapshot(fixtureId: number) {
        try {
            // scores/snapshot/{fixtureId}
            const { data } = await txlineClient.get(`/scores/snapshot/${fixtureId}`);
            return data;
        } catch (error) {
            console.error("Error fetching scores snapshot", error);
        }
    }

    // 2. Get a json array of all score updates from a specific historical 5-minute interval (no live data is returned)
    async getScoresUpdates(epochDay: number, hourOfDay: number, interval: number, fixtureId?: number) {
        try {
            // scores/updates/{epochDay}/{hourOfDay}/{interval} \
            const { data } = await txlineClient.get(`/scores/updates/${epochDay}/${hourOfDay}/${interval}`, {
                params: {
                    fixtureId
                }
            });
            return data;
        } catch (error) {
            console.error("Error fetching scores historical", error);
        }
    }

    // 3. Get the sequence of score updates for a single fixture within the current 5-min interval
    async getLiveScoresUpdates(fixtureId: number) {
        try {
            const { data } = await txlineClient.get(`/scores/updates/${fixtureId}`);
            return data;
        } catch (error) {
            console.error("Error fetching live scores updates", error);
        }
    }

    // 4. Get the full sequence of score updates for a single fixture
    async getHistoricalScores(fixtureId: number) {
        try {
            const { data } = await txlineClient.get(`/scores/historical/${fixtureId}`);
            return data;
        } catch (error) {
            console.error("Error fetching historical scores", error);
        }
    }

    // TODO 5. Get a real-time Server-Sent Events stream of scores updates

    // 6. Get a Merkle proof for fixture statistics
    async getScoresStatValidation(params: {
        fixtureId: number;
        seq: number;
        statKey?: number;
        statKey2?: number;
        statKeys?: string;
    }) {
        try {
            const { data } = await txlineClient.get("/scores/stat-validation", {
                params
            });
            return data;
        } catch (error) {
            console.error("Error fetching scores stat validation", error);
        }
    }
}