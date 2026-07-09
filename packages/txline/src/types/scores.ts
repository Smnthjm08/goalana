import type { ProofList } from "./proofs";

/**
 * A single scores event record returned by snapshot, interval updates,
 * live updates, and historical endpoints.
 * All fields use camelCase, matching the actual API JSON response.
 * Sport-specific nested objects are typed as `unknown` — assert the type
 * at the call site based on the `sportId` value.
 */
export interface ScoresRecord {
    // Required core fields
    fixtureId: number;
    gameState: string;
    startTime: number;
    isTeam: boolean;
    fixtureGroupId: number;
    competitionId: number;
    countryId: number;
    sportId: number;
    participant1IsHome: boolean;
    participant2Id: number;
    participant1Id: number;
    action: string;
    id: number;
    ts: number;
    connectionId: number;
    seq: number;
    // Optional shared
    coverageSecondaryData?: boolean;
    coverageType?: string;
    confirmed?: boolean;
    participant?: number;
    possession?: number;
    possessionType?: unknown;
    type?: unknown;
    stats?: Record<string, number>;
    kickoff?: unknown;
    lineups?: unknown[];
    // Optional sport-specific status (union tags)
    statusId?: unknown;           // US Football status
    statusBasketballId?: unknown; // Basketball status
    statusSoccerId?: unknown;     // Soccer status
    // Optional US Football
    score?: unknown;
    data?: unknown;
    clock?: unknown;
    down?: unknown;
    inPlayInfo?: unknown;
    kickoffInfo?: unknown;
    parti1StateUsFootball?: unknown;
    parti2StateUsFootball?: unknown;
    possibleEventUsFootball?: unknown;
    playerStatsUsFootball?: unknown;
    // Optional Soccer
    scoreSoccer?: unknown;
    dataSoccer?: unknown;
    parti1StateSoccer?: unknown;
    parti2StateSoccer?: unknown;
    possibleEventSoccer?: unknown;
    playerStatsSoccer?: unknown;
    // Optional Basketball
    scoreBasketball?: unknown;
    dataBasketball?: unknown;
    parti1StateBasketball?: unknown;
    parti2StateBasketball?: unknown;
}

/** A single event emitted by the SSE stream at GET /api/scores/stream. */
export interface ScoresStreamEvent {
    /** Format: "{timestamp}:{index}" */
    id?: string;
    /** Set to "heartbeat" for heartbeat events; undefined for data events. */
    event?: string;
    data?: ScoresRecord;
}

/** A single stat key-value pair within a scores update. */
export interface ScoreStat {
    /** Integer key identifying the statistic (e.g. 1 = Participant1_Score). */
    key: number;
    value: number;
    period: number;
}

export interface ScoresUpdateStats {
    updateCount: number;
    minTimestamp: number;
    maxTimestamp: number;
}

export interface ScoresBatchSummary {
    fixtureId: number;
    updateStats: ScoresUpdateStats;
    /** Raw bytes of the Merkle sub-tree root for this fixture's stat events. */
    eventStatsSubTreeRoot: number[];
}

/**
 * Legacy Mode response from GET /api/scores/stat-validation.
 * Returned when statKey (and optionally statKey2) is supplied.
 */
export interface ScoresStatValidation {
    ts: number;
    statToProve: ScoreStat;
    /** Raw bytes of the event-level stat Merkle root. */
    eventStatRoot: number[];
    summary: ScoresBatchSummary;
    statProof: ProofList;
    subTreeProof: ProofList;
    mainTreeProof: ProofList;
    // Optional second stat (two-stat predicate mode)
    statToProve2?: ScoreStat;
    statProof2?: ProofList;
}

/**
 * V2 Mode response from GET /api/scores/stat-validation.
 * Returned when statKeys (comma-separated) is supplied — supports N-stat proofs.
 */
export interface ScoresStatValidationV2 {
    ts: number;
    statsToProve?: ScoreStat[];
    /** Raw bytes of the event-level stat Merkle root. */
    eventStatRoot: number[];
    summary: ScoresBatchSummary;
    statProofs?: ProofList[];
    subTreeProof: ProofList;
    mainTreeProof: ProofList;
}
