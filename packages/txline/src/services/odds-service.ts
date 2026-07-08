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
    async getLiveOddsUpdates(fixtureId: Number) {
        try {
            const { data } = await txlineClient.get(`/odds/updates/${fixtureId}`);
            return data;
        } catch (error) {
            console.error("Error fetching live Odds Update", error);
        }
    }
}