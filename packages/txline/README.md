# @workspace/txline

TxLINE off-chain API client integration for sports data from the **Hybrid on-chain/off-chain TxODDS Data system**.

## Setup & Environment Variables

This package uses `axios` to query the TxLINE API. To configure the client, ensure the following environment variables are set in your `.env` file at the package or workspace root:

```ini
TXLINE_API_ORIGIN="https://txline-dev.txodds.com/api/"
TXLINE_JWT="your_session_jwt"
TXLINE_API_TOKEN="your_long_lived_api_token"
```

## Available Services

The integration is divided into three main service classes exposed by the package exports:

### 1. FixtureService

- **`getFixtureSnapshot(startEpochDay?, competitionId?)`**: Get the latest snapshot of fixtures, optionally filtering by competition ID (defaults to World Cup, ID `72`).
- **`getFixtureUpdates(epochDay, hourOfDay)`**: Get historical fixture updates/changes on a given epoch day and hour of day.
- **`getFixtureValidation(fixtureId, timestamp?)`**: Get a Merkle containment proof for a specific fixture update to verify its validity.
- **`getFixtureBatchValidation(epochDay, hourOfDay)`**: Get batch metadata and Merkle proof for an entire hourly batch of fixtures.

### 2. OddsService

- **`getOddsSnapshots(fixtureId)`**: Get demargined pricing ("Stable Price" percentages and odds) for the markets of a particular fixture.
- **`getLiveOddsUpdates(fixtureId)`**: Get currently active live odds updates for a single fixture.
- **`getOddsIntervalUpdates(epochDay, hourOfDay, interval, fixtureId?)`**: Get historical odds updates from a specific 5-minute interval (0-11) within a given hour of day.
- **`getOddsValidation(messageId, ts)`**: Retrieve the Merkle proof for a specific odds update by message ID and timestamp.

### 3. ScoresService

- **`getScoresSnapshot(fixtureId)`**: Get snapshots for each action/event in the latest score events for a fixture.
- **`getScoresUpdates(epochDay, hourOfDay, interval, fixtureId?)`**: Get score updates logged on 5-minute intervals for historical queries during the given hour of a specific day.
- **`getLiveScoresUpdates(fixtureId)`**: Get the raw text-based SSE stream sequence of score updates within the current 5-min interval.
- **`getHistoricalScores(fixtureId)`**: Get the full historical sequence of score updates for a single fixture.
- **`getScoresStatValidation(params)`**: Get a deep cryptographic Merkle proof for stats within a scores update (supports Legacy one/two stat queries or V2 multi-stat keys).

---

## Workspace Scripts

Run commands from the `packages/txline` directory:

### Install Dependencies

```bash
bun install
```

### Run Integration Tests

```bash
bun test
```

### Typecheck

```bash
bun run typecheck
```
