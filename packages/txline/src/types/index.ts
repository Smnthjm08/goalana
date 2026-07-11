/**
 * TxLINE API — Type Coverage Tracker
 * ====================================
 * Track which service methods have typed return values.
 *
 * FIXTURES (fixtures-service.ts)
 *   [x] getFixtureSnapshot        → TxLineFixture[]
 *   [x] getFixtureUpdates         → TxLineFixture[]
 *   [x] getFixtureValidation      → FixtureValidation
 *   [x] getFixtureBatchValidation → FixtureBatchValidation
 *
 * ODDS (odds-service.ts)
 *   [x] getOddsSnapshots          → OddsPayload[]
 *   [x] getLiveOddsUpdates        → OddsPayload[]
 *   [x] getOddsIntervalUpdates    → OddsPayload[]
 *   [x] streamOddsUpdates         → SSEParser (objectMode, emits SSEEvent)
 *   [x] getOddsValidation         → OddsValidation
 *
 * SCORES (scores-service.ts)
 *   [x] getScoresSnapshot         → ScoresRecord[]
 *   [x] getScoresUpdates          → ScoresRecord[]
 *   [x] getLiveScoresUpdates      → ScoresRecord[]
 *   [x] getHistoricalScores       → ScoresRecord[]
 *   [x] streamScoresUpdates       → SSEParser (objectMode, emits SSEEvent)
 *   [x] getScoresStatValidation   → ScoresStatValidation | ScoresStatValidationV2
 */

export * from "./proofs";
export * from "./fixtures";
export * from "./odds";
export * from "./scores";
export * from "./stream-options";
