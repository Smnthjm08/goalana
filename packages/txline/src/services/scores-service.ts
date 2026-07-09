import { txlineClient } from "../client";
import type { Readable } from "stream";
import type { ScoresRecord, ScoresStatValidation, ScoresStatValidationV2 } from "../types/index";

export class ScoresService {
    // 1. Get snapshots for each action in the latest score events for a fixture
    async getScoresSnapshot(fixtureId: number): Promise<ScoresRecord[] | undefined> {
        try {
            // scores/snapshot/{fixtureId}
            const { data } = await txlineClient.get<ScoresRecord[]>(`/scores/snapshot/${fixtureId}`);
            return data;
        } catch (error) {
            console.error("Error fetching scores snapshot", error);
        }
    }

    // 2. Get a json array of all score updates from a specific historical 5-minute interval (no live data is returned)
    async getScoresUpdates(epochDay: number, hourOfDay: number, interval: number, fixtureId?: number): Promise<ScoresRecord[] | undefined> {
        try {
            // scores/updates/{epochDay}/{hourOfDay}/{interval}
            const { data } = await txlineClient.get<ScoresRecord[]>(`/scores/updates/${epochDay}/${hourOfDay}/${interval}`, {
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
    async getLiveScoresUpdates(fixtureId: number): Promise<ScoresRecord[] | undefined> {
        try {
            const { data } = await txlineClient.get<ScoresRecord[]>(`/scores/updates/${fixtureId}`);
            return data;
        } catch (error) {
            console.error("Error fetching live scores updates", error);
        }
    }

    // 4. Get the full sequence of score updates for a single fixture
    async getHistoricalScores(fixtureId: number): Promise<ScoresRecord[] | undefined> {
        try {
            const { data } = await txlineClient.get<ScoresRecord[]>(`/scores/historical/${fixtureId}`);
            return data;
        } catch (error) {
            console.error("Error fetching historical scores", error);
        }
    }

    // 5. Get a real-time Server-Sent Events stream of scores updates
    // Stream emits ScoresStreamEvent lines: data events with ScoresRecord and heartbeat events.
    async streamScoresUpdates(fixtureId?: number, lastEventId?: string): Promise<Readable | undefined> {
        try {
            const { data } = await txlineClient.get<Readable>("/scores/stream", {
                params: {
                    ...(fixtureId != null ? { fixtureId } : {})
                },
                headers: {
                    ...(lastEventId ? { "Last-Event-ID": lastEventId } : {})
                },
                responseType: "stream"
            });
            return data;
        } catch (error) {
            console.error("Error fetching scores stream", error);
        }
    }

    // 6. Get a Merkle proof for fixture statistics
    async getScoresStatValidation(params: {
        fixtureId: number;
        seq: number;
        statKey?: number;
        statKey2?: number;
        statKeys?: string;
    }): Promise<ScoresStatValidation | ScoresStatValidationV2 | undefined> {
        try {
            const { data } = await txlineClient.get<ScoresStatValidation | ScoresStatValidationV2>("/scores/stat-validation", {
                params
            });
            return data;
        } catch (error) {
            console.error("Error fetching scores stat validation", error);
        }
    }
}