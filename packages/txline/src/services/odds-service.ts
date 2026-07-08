import { txlineClient } from "../client";

export class OddsService {
    // 1. Get snapshots of the latest odds for a fixture
    async getOddsSnapshots(fixtureId: number) {
        try {
            const { data } = await txlineClient.get(`/odds/snapshot/${fixtureId}`);
            return data;
        } catch (error) {
            console.error("Error fetching odds snapshots", error);
        }
    }

    // 2. Get currently live odds updates for a single fixture
    async getLiveOddsUpdates(fixtureId: number) {
        try {
            const { data } = await txlineClient.get(`/odds/updates/${fixtureId}`);
            return data;
        } catch (error) {
            console.error("Error fetching live Odds Update", error);
        }
    }

    // 3. Get a json array of all odd updates from a specific historical 5-minute interval
    async getOddsIntervalUpdates(epochDay: number, hourOfDay: number, interval: number, fixtureId?: number) {
        try {
            const { data } = await txlineClient.get(`/odds/updates/${epochDay}/${hourOfDay}/${interval}`, {
                params: {
                    ...(fixtureId != null ? { fixtureId } : {})
                }
            });
            return data;
        } catch (error) {
            console.error("Error fetching historical odds interval updates", error);
        }
    }

    // TODO 4. Get a real-time Server-Sent Events stream of odds updates

    // 5. Get a Merkle proof for a specific odds update
    async getOddsValidation(messageId: string, ts: number) {
        try {
            const { data } = await txlineClient.get("/odds/validation", {
                params: {
                    messageId,
                    ts
                }
            });
            return data;
        } catch (error) {
            console.error("Error fetching odds validation proof", error);
        }
    }
}