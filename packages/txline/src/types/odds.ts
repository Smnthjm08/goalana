import type { ProofList } from "./proofs";

/** Shared odds record — returned by snapshot, live, interval, and SSE stream. */
export interface OddsPayload {
    FixtureId: number;
    MessageId: string;
    Ts: number;
    Bookmaker: string;
    BookmakerId: number;
    SuperOddsType: string;
    InRunning: boolean;
    GameState?: string;
    MarketParameters?: string;
    MarketPeriod?: string;
    PriceNames?: string[];
    Prices?: number[];
    /** Strictly 3 decimal places, or "NA" for quarter handicap lines. */
    Pct?: string[];
}

/** A single event emitted by the SSE stream at GET /api/odds/stream. */
export interface OddsStreamEvent {
    /** Format: "{timestamp}:{index}" */
    id?: string;
    /** Set to "heartbeat" for heartbeat events; undefined for data events. */
    event?: string;
    data?: OddsPayload;
}

export interface OddsUpdateStats {
    updateCount: number;
    minTimestamp: number;
    maxTimestamp: number;
}

export interface OddsBatchSummary {
    fixtureId: number;
    updateStats: OddsUpdateStats;
    /** Raw bytes of the Merkle sub-tree root for this fixture's odds. */
    oddsSubTreeRoot: number[];
}

/** Response from GET /api/odds/validation — Merkle proof for a single odds update. */
export interface OddsValidation {
    odds: OddsPayload;
    summary: OddsBatchSummary;
    subTreeProof: ProofList;
    mainTreeProof: ProofList;
}
