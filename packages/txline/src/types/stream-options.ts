/**
 * Options for SSE stream methods (`streamScoresUpdates`, `streamOddsUpdates`).
 */
export interface StreamOptions {
    /**
     * External signal to abort the SSE connection.
     * When aborted, the returned stream will emit an `error` event.
     */
    signal?: AbortSignal;

    /**
     * Maximum milliseconds to wait with no data received before
     * considering the connection stale and aborting.
     *
     * The timer resets on every chunk received from the server
     * (including heartbeats).
     *
     * @default 30_000
     */
    staleTimeoutMs?: number;

    /**
     * SSE `Last-Event-ID` header for stream resumption.
     * The server will replay events starting after this ID.
     */
    lastEventId?: string;
}
