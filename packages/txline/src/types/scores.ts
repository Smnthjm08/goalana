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
    FixtureId: number;
    GameState: string;
    StartTime: number;
    IsTeam: boolean;
    FixtureGroupId: number;
    CompetitionId: number;
    CountryId: number;
    SportId: number;
    Participant1IsHome: boolean;
    Participant2Id: number;
    Participant1Id: number;
    Action: string;
    Id: number;
    Ts: number;
    ConnectionId: number;
    Seq: number;
    // Optional shared
    CoverageSecondaryData?: boolean;
    CoverageType?: string;
    Confirmed?: boolean;
    Participant?: number;
    Possession?: number;
    PossessionType?: unknown;
    Type?: unknown;
    Stats?: Record<string, number>;
    Kickoff?: unknown;
    Lineups?: unknown[];
    // Optional sport-specific status (union tags)
    StatusId?: unknown;           // US Football status
    StatusBasketballId?: unknown; // Basketball status
    StatusSoccerId?: unknown;     // Soccer status
    // Optional US Football
    Score?: unknown;
    Data?: unknown;
    Clock?: unknown;
    Down?: unknown;
    InPlayInfo?: unknown;
    KickoffInfo?: unknown;
    Parti1StateUsFootball?: unknown;
    Parti2StateUsFootball?: unknown;
    PossibleEventUsFootball?: unknown;
    PlayerStatsUsFootball?: unknown;
    // Optional Soccer
    ScoreSoccer?: unknown;
    DataSoccer?: unknown;
    Parti1StateSoccer?: unknown;
    Parti2StateSoccer?: unknown;
    PossibleEventSoccer?: unknown;
    PlayerStatsSoccer?: unknown;
    // Optional Basketball
    ScoreBasketball?: unknown;
    DataBasketball?: unknown;
    Parti1StateBasketball?: unknown;
    Parti2StateBasketball?: unknown;
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
