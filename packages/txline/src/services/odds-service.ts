// odds-service.ts
import { txlineClient } from "../client";
import type { OddsPayload, OddsValidation } from "../types/index";
import type { Readable } from "stream";

export class OddsService {
    // 1. Get snapshots of the latest odds for a fixture
    async getOddsSnapshots(fixtureId: number): Promise<OddsPayload[] | undefined> {
        try {
            const { data } = await txlineClient.get<OddsPayload[]>(`/odds/snapshot/${fixtureId}`);
            return data;
        } catch (error) {
            console.error("Error fetching odds snapshots", error);
        }
    }

    // 2. Get currently live odds updates for a single fixture
    async getLiveOddsUpdates(fixtureId: number): Promise<OddsPayload[] | undefined> {
        try {
            const { data } = await txlineClient.get<OddsPayload[]>(`/odds/updates/${fixtureId}`);
            return data;
        } catch (error) {
            console.error("Error fetching live Odds Update", error);
        }
    }

    // 3. Get a json array of all odd updates from a specific historical 5-minute interval
    async getOddsIntervalUpdates(epochDay: number, hourOfDay: number, interval: number, fixtureId?: number): Promise<OddsPayload[] | undefined> {
        try {
            const { data } = await txlineClient.get<OddsPayload[]>(`/odds/updates/${epochDay}/${hourOfDay}/${interval}`, {
                params: {
                    ...(fixtureId != null ? { fixtureId } : {})
                }
            });
            return data;
        } catch (error) {
            console.error("Error fetching historical odds interval updates", error);
        }
    }

    // 4. Get a real-time Server-Sent Events stream of odds updates
    // Stream emits OddsStreamEvent lines: data events with OddsPayload and heartbeat events.
    async streamOddsUpdates(fixtureId?: number, lastEventId?: string): Promise<Readable | undefined> {
        try {
            const { data } = await txlineClient.get<Readable>("/odds/stream", {
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
            console.error("Error fetching odds stream", error);
        }
    }

    // 5. Get a Merkle proof for a specific odds update
    async getOddsValidation(messageId: string, ts: number): Promise<OddsValidation | undefined> {
        try {
            const { data } = await txlineClient.get<OddsValidation>("/odds/validation", {
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