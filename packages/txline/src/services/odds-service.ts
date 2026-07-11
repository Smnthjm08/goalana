// odds-service.ts
import { txlineClient } from "../client";
import type { OddsPayload, OddsValidation } from "../types/index";
import type { Readable } from "stream";
import type { StreamOptions } from "../types/stream-options";
import { SSEParser } from "../utils/sse-parser";

const DEFAULT_STALE_TIMEOUT_MS = 30_000;

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

    /**
     * 4. Get a real-time Server-Sent Events stream of odds updates.
     *
     * Returns an object-mode Transform stream that emits parsed `SSEEvent` objects.
     * Each event contains `{ id?, event?, data }` — callers should `JSON.parse(event.data)`
     * to get the `OddsPayload`.
     *
     * **Error handling**: Throws on connection failure so reconnect loops can catch and retry.
     * **Stale timeout**: Aborts the connection if no data arrives within `staleTimeoutMs` (default 30s).
     * **Abort support**: Pass `signal` in options to cancel the connection externally.
     *
     * @throws {Error} On connection failure or stale timeout
     */
    async streamOddsUpdates(fixtureId?: number, options: StreamOptions = {}): Promise<SSEParser> {
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

        const { data: rawStream } = await txlineClient.get<Readable>("/odds/stream", {
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
                    `Odds SSE stream stale: no data received for ${staleTimeoutMs}ms`
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