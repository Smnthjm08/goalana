import type { ProofList } from "./proofs";

/** A single fixture record — returned by snapshot and used inside FixtureValidation. */
export interface TxLineFixture {
    Ts: number;
    StartTime: number;
    Competition: string;
    CompetitionId: number;
    FixtureGroupId: number;
    Participant1Id: number;
    Participant1: string;
    Participant2Id: number;
    Participant2: string;
    FixtureId: number;
    Participant1IsHome: boolean;
    /** Integer game state code (e.g. 1 = scheduled). Not in OpenAPI schema but present in real responses. */
    GameState?: number;
}

export interface FixtureUpdateStats {
    updateCount: number;
    minTimestamp: number;
    maxTimestamp: number;
}

export interface FixtureBatchSummary {
    fixtureId: number;
    competitionId: number;
    competition: string;
    updateStats: FixtureUpdateStats;
    /** Raw bytes of the Merkle sub-tree root for this fixture's updates. */
    updateSubTreeRoot: number[];
}

/** Response from GET /api/fixtures/validation — Merkle proof for a single fixture update. */
export interface FixtureValidation {
    snapshot: TxLineFixture;
    summary: FixtureBatchSummary;
    subTreeProof: ProofList;
    mainTreeProof: ProofList;
}

/** Metadata for an entire hourly batch of fixture updates. */
export interface BatchMetadata {
    totalUpdateCount: number;
    numUniqueFixtures: number;
    overallBatchStartTs: number;
    overallBatchEndTs: number;
}

/** Response from GET /api/fixtures/batch-validation — Merkle proof for an entire hourly batch. */
export interface FixtureBatchValidation {
    metadata: BatchMetadata;
    proof: ProofList;
}
