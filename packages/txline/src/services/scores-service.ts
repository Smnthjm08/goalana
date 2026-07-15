// scores-service.ts
import { txlineClient } from "../client";
import type { Readable } from "stream";
import type { ScoresRecord, ScoresStatValidation, ScoresStatValidationV2 } from "../types/index";
import type { StreamOptions } from "../types/stream-options";
import { SSEParser } from "../utils/sse-parser";

const DEFAULT_STALE_TIMEOUT_MS = 30_000;

export class ScoresService {
    // 1. Get snapshots for each action in the latest score events for a fixture
    async getScoresSnapshot(fixtureId: number): Promise<ScoresRecord[]> {
        // scores/snapshot/{fixtureId}
        const { data } = await txlineClient.get<ScoresRecord[]>(`/scores/snapshot/${fixtureId}`);
        return data;
    }

    // 2. Get a json array of all score updates from a specific historical 5-minute interval (no live data is returned)
    async getScoresUpdates(epochDay: number, hourOfDay: number, interval: number, fixtureId?: number): Promise<ScoresRecord[]> {
        // scores/updates/{epochDay}/{hourOfDay}/{interval}
        const { data } = await txlineClient.get<ScoresRecord[]>(`/scores/updates/${epochDay}/${hourOfDay}/${interval}`, {
            params: {
                fixtureId
            }
        });
        return data;
    }

    // 3. Get the sequence of score updates for a single fixture within the current 5-min interval
    async getLiveScoresUpdates(fixtureId: number): Promise<ScoresRecord[]> {
        const { data } = await txlineClient.get<ScoresRecord[]>(`/scores/updates/${fixtureId}`);
        return data;
    }

    // 4. Get the full sequence of score updates for a single fixture
    async getHistoricalScores(fixtureId: number): Promise<ScoresRecord[]> {
        const { data } = await txlineClient.get<ScoresRecord[]>(`/scores/historical/${fixtureId}`);
        return data;
    }

    /**
     * 5. Get a real-time Server-Sent Events stream of scores updates.
     *
     * Returns an object-mode Transform stream that emits parsed `SSEEvent` objects.
     * Each event contains `{ id?, event?, data }` — callers should `JSON.parse(event.data)`
     * to get the `ScoresRecord` payload.
     *
     * **Error handling**: Throws on connection failure so reconnect loops can catch and retry.
     * **Stale timeout**: Aborts the connection if no data arrives within `staleTimeoutMs` (default 30s).
     * **Abort support**: Pass `signal` in options to cancel the connection externally.
     *
     * @throws {Error} On connection failure or stale timeout
     */
    async streamScoresUpdates(fixtureId?: number, options: StreamOptions = {}): Promise<SSEParser> {
        const { signal: externalSignal, staleTimeoutMs = DEFAULT_STALE_TIMEOUT_MS, lastEventId } = options;

        // Compose an internal AbortController that respects the caller's signal
        const controller = new AbortController();
        if (externalSignal) {
            if (externalSignal.aborted) {
                controller.abort(externalSignal.reason);
            } else {
                externalSignal.addEventListener("abort", () => controller.abort(externalSignal.reason), { once: true });
            }
        }

        const { data: rawStream } = await txlineClient.get<Readable>("/scores/stream", {
            params: {
                ...(fixtureId != null ? { fixtureId } : {})
            },
            headers: {
                Accept: "text/event-stream",
                "Cache-Control": "no-cache",
                ...(lastEventId ? { "Last-Event-ID": lastEventId } : {})
            },
            responseType: "stream",
            // Disable the default timeout for streaming — we manage our own stale timer
            timeout: 0,
            signal: controller.signal,
        });

        const parser = new SSEParser();

        // --- Stale-connection timer ---
        // Resets on every chunk. If it fires, the connection is dead/stale.
        let staleTimer: ReturnType<typeof setTimeout> | undefined;

        const resetStaleTimer = () => {
            if (staleTimer) clearTimeout(staleTimer);
            staleTimer = setTimeout(() => {
                const err = new Error(
                    `Scores SSE stream stale: no data received for ${staleTimeoutMs}ms`
                );
                controller.abort(err.message);
                parser.destroy(err);
            }, staleTimeoutMs);
        };

        // Start the timer immediately
        resetStaleTimer();

        // Reset the timer on every incoming chunk (before parsing)
        rawStream.on("data", () => resetStaleTimer());

        // Clean up timer when stream ends or errors
        const clearTimer = () => {
            if (staleTimer) {
                clearTimeout(staleTimer);
                staleTimer = undefined;
            }
        };
        rawStream.on("end", clearTimer);
        rawStream.on("error", clearTimer);
        parser.on("close", clearTimer);

        // Pipe raw bytes → SSE parser
        rawStream.pipe(parser);

        // Forward raw stream errors to the parser so consumers see them
        rawStream.on("error", (err) => {
            if (!parser.destroyed) {
                parser.destroy(err);
            }
        });

        return parser;
    }

    // 6. Get a Merkle proof for fixture statistics
    async getScoresStatValidation(params: {
        fixtureId: number;
        seq: number;
        statKey?: number;
        statKey2?: number;
        statKeys?: string;
    }): Promise<ScoresStatValidation | ScoresStatValidationV2> {
        const { data } = await txlineClient.get<ScoresStatValidation | ScoresStatValidationV2>("/scores/stat-validation", {
            params
        });
        return data;
    }
}