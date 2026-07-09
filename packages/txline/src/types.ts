/**
 * TxLINE API — Type Coverage Tracker
 * ====================================
 * Track which service methods have typed return values.
 *
 * FIXTURES (fixtures-service.ts)
 *   [x] getFixtureSnapshot        → TxLineFixture[]
 *   [ ] getFixtureUpdates         → untyped
 *   [ ] getFixtureValidation      → untyped
 *   [ ] getFixtureBatchValidation → untyped
 *
 * ODDS (odds-service.ts)
 *   [x] getOddsSnapshots          → OddsPayload[]
 *   [x] getLiveOddsUpdates        → OddsPayload[]
 *   [x] getOddsIntervalUpdates    → OddsPayload[]
 *   [x] streamOddsUpdates         → Readable (emits OddsStreamEvent)
 *   [x] getOddsValidation         → OddsValidation
 *
 * SCORES (scores-service.ts)
 *   [ ] getScoresSnapshot         → untyped
 *   [ ] getScoresUpdates          → untyped
 *   [ ] getLiveScoresUpdates      → untyped (raw SSE string)
 *   [ ] getHistoricalScores       → untyped
 *   [ ] getScoresStatValidation   → untyped
 */

// =============================================================================
// SHARED — Merkle Proof primitives (used by Odds and Scores validation)
// =============================================================================

export interface ProofNode {
    /** Raw bytes of the sibling hash. */
    hash: number[];
    isRightSibling: boolean;
}

/** List_ProofNode: either empty (Nil) or an array of ProofNode. */
export type ProofList = [] | ProofNode[];

// =============================================================================
// FIXTURES
// =============================================================================

export interface TxLineFixture {
    "Ts": number;
    "StartTime": number;
    "Competition": string;
    "CompetitionId": number;
    "FixtureGroupId": number;
    "Participant1Id": number;
    "Participant1": string;
    "Participant2Id": number;
    "Participant2": string;
    "FixtureId": number;
    "Participant1IsHome": boolean;
}

// =============================================================================
// ODDS
// =============================================================================

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

// =============================================================================
// SCORES  (types to be added as endpoints are typed)
// =============================================================================
