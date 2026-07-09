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
 *   [x] streamOddsUpdates         → Readable (emits OddsStreamEvent)
 *   [x] getOddsValidation         → OddsValidation
 *
 * SCORES (scores-service.ts)
 *   [x] getScoresSnapshot         → ScoresRecord[]
 *   [x] getScoresUpdates          → ScoresRecord[]
 *   [x] getLiveScoresUpdates      → ScoresRecord[]
 *   [x] getHistoricalScores       → ScoresRecord[]
 *   [x] streamScoresUpdates       → Readable (emits ScoresStreamEvent)
 *   [x] getScoresStatValidation   → ScoresStatValidation | ScoresStatValidationV2
 */

export * from "./proofs";
export * from "./fixtures";
export * from "./odds";
export * from "./scores";
