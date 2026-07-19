# Goalana — Technical Documentation

Status: hackathon MVP (Superteam "Prediction Markets & Settlement" track, World Cup theme)

This is the consolidated technical reference: product scope, the TxLINE data/proof integration, the on-chain market lifecycle, and the backend API surface. For the monorepo/system-level view (folder layout, data flow, account model), see [ARCHITECTURE.md](ARCHITECTURE.md). For deployment, see [SETUP.md](SETUP.md).

**Contents**

- [Part 1 — Product Requirements](#part-1--product-requirements)
- [Part 2 — TxLINE Integration](#part-2--txline-integration)
- [Part 3 — Market Lifecycle](#part-3--market-lifecycle)
- [Part 4 — Backend API Reference](#part-4--backend-api-reference)

---

## Part 1 — Product Requirements

### Problem

Prediction markets need a trustworthy, tamper-evident source of truth for both the odds that price a market and the final result that settles it. Most crypto prediction markets either rely on a trusted oracle multisig (a single point of failure/trust) or on manual/social dispute resolution (slow, gameable). Sports markets specifically need: real fixtures, live odds to price markets fairly, and a final result that can be **cryptographically proven**, not just asserted.

### Solution

Goalana is a World Cup prediction market protocol on Solana that sources fixtures, odds, and match results from **TxLINE** (TxODDS' verifiable sports data feed). TxLINE publishes Merkle roots of its data on-chain; Goalana's Anchor program CPIs into TxLINE's on-chain oracle program (`txoracle`) to verify a Merkle proof for the exact stat a market's predicate depends on before settling — so settlement is backed by a cryptographic proof anchored to TxLINE's on-chain root, not a trusted party's word.

### Target User Experience

1. A visitor opens Goalana and sees real, upcoming World Cup fixtures with live odds.
2. They open a fixture and see one or more markets (e.g. "Will Brazil win?") that Goalana's house authority has created from real TxLINE odds.
3. They connect a Solana wallet and place SOL on YES or NO before kickoff.
4. The market locks at kickoff. After the match ends, Goalana's backend detects the confirmed TxLINE result, fetches the Merkle proof for the relevant stat, and settles the market on-chain.
5. If they won, they see a "Claim" button and receive their payout from the on-chain vault. The UI shows the TxLINE fixture ID, the settlement transaction, and (where feasible) the proof data used, so the outcome is independently checkable.

### Hackathon Scope

**In scope:** one sport (soccer), one competition (World Cup, `competitionId = 72`), a small fixed set of market types (1X2 full-time result, Over/Under 2.5 goals), SOL-denominated pari-mutuel betting, house-only market creation, permissionless proof-based settlement, claim flow.

**Out of scope (see Non-Goals):** permissionless/user-created markets, non-soccer sports, order-book/AMM pricing, live in-play betting, parlays, token (SPL) betting, mobile app.

### MVP Features

- Fixture discovery and display (real TxLINE World Cup fixtures, live-updating).
- Odds ingestion and an odds-movement chart per fixture (already implemented).
- House-authority on-chain market creation from supported TxLINE odds markets.
- Wallet connect + place a real SOL bet (`place_bet`) on an open market.
- Automatic market locking at kickoff (`lock_market`).
- Automatic final-result detection from the TxLINE scores stream.
- Merkle proof retrieval (`scores/stat-validation`) for the market's predicate stat(s).
- On-chain settlement via CPI into TxLINE's oracle (`settle_market`), which verifies the proof and derives the true/false outcome — no trusted-party signature involved.
- Claim flow (`claim_winnings` / `claim_refund`) with a wallet-connected "Claim" button.
- A lifecycle view per market: created → open → locked → settled (+ proof reference) → claimable.

### Non-Goals (this hackathon)

- **User/permissionless market creation.** `MarketOrigin::User` exists as a concept in the on-chain state but there is **no** `create_market_user` instruction, and none will be added for this hackathon. All markets are created by the configured `market_authority` (the Goalana backend's wallet). See [Part 3 — House-only creation](#house-only-creation).
- Parlays / multi-leg combined markets.
- Live/in-play odds-based betting (an `InRunning` odds filter already excludes in-play odds from market discovery; live betting is not implemented).
- Social features (inviting friends to a private market, flat-price/fixed-odds peer bets). See "Post-MVP ideas" below — explicitly not part of this hackathon's build.
- Multi-sport support, multi-competition support beyond the World Cup.
- Order-book or AMM-based pricing (the program is pari-mutuel only: `total_yes` / `total_no` pools).
- SPL-token betting (program only moves native SOL lamports).

#### Post-MVP ideas (not committed, not built)

These came up as "what would you suggest next" — recorded here as candidate roadmap items, **not** MVP commitments:

- **Live/in-play odds-based betting**: technically the hardest of the three — it needs a market design that's safe to price continuously (e.g. periodic re-quoted micro-markets, or a maker/taker order-intent model closer to TxLINE's own `txoracle` trade-intent instructions) rather than the current fixed-price-until-lock pari-mutuel pool. Worth prototyping only after the core lifecycle is solid.
- **Parlay betting**: straightforward to reason about (AND-combine predicates, single stake, single payout) but needs a new on-chain market/position shape (a parlay is not a single `Predicate`); a clean v2 addition once single-leg settlement is proven reliable.
- **User-created "invite friends at a flat price" markets**: closest to a peer-to-peer fixed-odds bet rather than a pari-mutuel market — likely a _different_ instruction (e.g. a 1:1 escrow/challenge, closer to TxLINE's own `createIntent`/`executeMatch` pattern) rather than reusing `create_market`. This directly conflicts with the hackathon's explicit "house-only" decision, so it should stay out until that decision is revisited.

### Final E2E Flow (definition of "done" for this hackathon)

```text
Real TxLINE fixture (World Cup)
  → supported TxLINE odds snapshot (1X2 / O2.5)
  → Goalana house authority creates on-chain market (create_market)
  → user connects wallet, places a bet (place_bet)
  → market locks at kickoff (lock_market)
  → TxLINE confirms final result (scores stream / StatusId)
  → Goalana fetches TxLINE Merkle proof for the market's stat (scores/stat-validation)
  → market settles on-chain via CPI-verified proof (settle_market)
  → winner claims funds (claim_winnings)
  → frontend shows the full lifecycle + the fixture/proof provenance
```

### Success Criteria

1. A real (non-mocked) TxLINE World Cup fixture is visible in the UI with live odds.
2. At least one market for that fixture exists on-chain, created by the house authority, and is visible in the UI.
3. A connected wallet can place a real devnet SOL bet against that market.
4. The market locks automatically at (or after) kickoff.
5. After the match concludes, the market settles on-chain using a real TxLINE Merkle proof (via CPI to TxLINE's `txoracle` program) — not a manually-entered result.
6. The winning side can claim funds and see the payout land in their wallet.
7. The frontend displays, for a settled market: the fixture, the outcome, and enough detail (tx signature, proof reference) that the settlement is independently verifiable.

---

## Part 2 — TxLINE Integration

Goalana integrates with TxLINE (TxODDS' verifiable sports data system) in **two separate places**, which is important to keep straight:

1. **Off-chain HTTP/SSE client** (`packages/txline`, used by `apps/api`) — for discovering fixtures, pricing markets from odds, and detecting when a match has finished.
2. **On-chain CPI** (`goalana_program/src/txline_cpi.rs`) — for cryptographically verifying the exact stat a market's predicate depends on, directly against TxLINE's own on-chain `txoracle` program, at settlement time.

Off-chain data is used to _decide what to do_; on-chain proof verification is used to _prove the result is real_ before money moves. Goalana never trusts its own backend's read of TxLINE for settlement — only the on-chain CPI verification counts.

### Authentication

Two-tier, per TxLINE's guest-session flow:

1. `POST /auth/guest/start` → guest JWT (30-day expiry), sent as `Authorization: Bearer <jwt>`.
2. An on-chain TxLINE subscription (`subscribe` on TxLINE's own program) is activated by signing `${txSig}:${leagues.join(",")}:${jwt}` and calling `POST /api/token/activate`, which returns an **API token** sent as `X-Api-Token` on every subsequent data call. For the standard free bundle (`SELECTED_LEAGUES = []`), this collapses to `${txSig}::${jwt}` (empty middle segment) — TxLINE's own docs give this exact degenerate case explicitly, and `activate.ts` produces it correctly via `leagues.join(",")`.

Implemented in `apps/api/src/scripts/activate.ts` (one-off activation script, run manually — not part of the running server) and consumed at request time by `packages/txline/src/client.ts`, which lazily reads `TXLINE_API_ORIGIN`, `TXLINE_JWT`, `TXLINE_API_TOKEN` from the environment on every request (avoids env-var-not-loaded-yet races).

**Free tier still costs SOL.** TxLINE's free World Cup/International Friendlies tier (service level 1 on mainnet, real-time level 12, or the single free devnet tier) needs no TxL purchase, but the on-chain `subscribe` transaction still pays ordinary Solana fees and any ATA rent — fund the activating wallet with SOL (a devnet airdrop is enough on devnet) before running `activate.ts`.

#### Network configuration (must all match — mixing networks is the #1 activation failure)

| Network | Program ID                                     | TxL Token Mint                                 | Guest Auth                                       | API Base                             |
| ------- | ---------------------------------------------- | ---------------------------------------------- | ------------------------------------------------ | ------------------------------------ |
| Mainnet | `9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA` | `Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL`  | `https://txline.txodds.com/auth/guest/start`     | `https://txline.txodds.com/api/`     |
| Devnet  | `6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J` | `4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG` | `https://txline-dev.txodds.com/auth/guest/start` | `https://txline-dev.txodds.com/api/` |

`activate.ts`'s `CONFIG` object already encodes this table correctly for both networks (verified byte-for-byte against TxLINE's docs). The on-chain `txline_cpi.rs::declare_id!` (`6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`) is the devnet oracle program ID — swapping Goalana to mainnet requires updating that `declare_id!` to the mainnet program ID above as well, not just `activate.ts`.

#### Subscription tiers

Priced per 28-day period (minimum term 4 weeks, must be purchased in multiples of 4 weeks), 1 USD = 1,000 TxL. All tiers include Scores + StablePrice Odds.

| Service level(s) | Leagues                      | Delay           | Price            |
| ---------------- | ---------------------------- | --------------- | ---------------- |
| 1, 12            | World Cup + Int'l Friendlies | 60s / real-time | **Free**         |
| 2–6              | 10 / 25 / 50 / 100 / All     | 60s             | $500 – $2,500    |
| 7–11             | 10 / 25 / 50 / 100 / All     | real-time       | $5,000 – $25,000 |

Devnet has a single free tier (World Cup + Int'l Friendlies, zero-second delay) — no paid devnet tiers exist. `activate.ts`'s `SERVICE_LEVEL_ID = 1` is the free World Cup tier on both networks. No rate limits apply to free-tier API calls.

### Fixtures

| API                                            | Client method                              | Used by                                                                                              |
| ---------------------------------------------- | ------------------------------------------ | ---------------------------------------------------------------------------------------------------- |
| `GET /fixtures/snapshot?competitionId=`        | `FixtureService.getFixtureSnapshot`        | `fixtures.cron.syncFixtures` — full resync, boot + manual `/api/fixtures/sync`                       |
| `GET /fixtures/updates/{epochDay}/{hourOfDay}` | `FixtureService.getFixtureUpdates`         | `fixtures.cron.syncFixtureUpdates` — every 5 min, current + previous hour, deduped by `FixtureId:Ts` |
| `GET /fixtures/validation`                     | `FixtureService.getFixtureValidation`      | not called from `apps/api` yet (available in the client)                                             |
| `GET /fixtures/batch-validation`               | `FixtureService.getFixtureBatchValidation` | `fixtures.cron.syncPreviousHourBatchValidation` — every 15 min, cached into `FixtureBatchValidation` |

**Discovery** = snapshot (full state, competition-scoped). **Recovery/drift-correction** = updates endpoint, polled on a schedule since Goalana doesn't yet subscribe to a fixtures SSE stream. **Provenance** = validation/batch-validation, which return Merkle proofs proving a fixture snapshot belongs to TxLINE's on-chain root — cached but not yet consumed by anything on-chain (fixture-level proofs aren't needed for settlement; only the scores stat-proof is).

**Known gap:** `syncFixtures` (the full snapshot) is not on a recurring schedule — only `syncFixtureUpdates` and batch-validation are (`fixtures.cron.ts` → `startFixtureCron`). A newly-announced fixture may not appear until the snapshot is re-run manually.

### Odds

| API                                                   | Client method                        | Used by                                                                                                  |
| ----------------------------------------------------- | ------------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `GET /odds/snapshot/{fixtureId}`                      | `OddsService.getOddsSnapshots`       | `odds.cron.syncOdds` (all tracked fixtures) and `market.service` (market discovery pricing)              |
| `GET /odds/updates/{fixtureId}`                       | `OddsService.getLiveOddsUpdates`     | not called yet                                                                                           |
| `GET /odds/updates/{epochDay}/{hourOfDay}/{interval}` | `OddsService.getOddsIntervalUpdates` | not called yet (historical recovery/backfill path)                                                       |
| `GET /odds/stream` (SSE)                              | `OddsService.streamOddsUpdates`      | **`odds.worker.ts`** — live, filtered to tracked fixtures, `Last-Event-ID` resume + 5s reconnect backoff |
| `GET /odds/validation`                                | `OddsService.getOddsValidation`      | not called yet                                                                                           |

Live-UI pricing is **SSE-based** (`odds.worker.ts` subscribes to `GET /odds/stream` with `Last-Event-ID` resume and a 5s reconnect backoff), filtered to fixtures Goalana tracks since the stream isn't competition-scoped. Snapshot-based sync (`odds.cron.ts`, chained off fixture sync) remains the recovery/reconciliation path, not the live-update path. (This corrects an earlier version of this doc that described odds as poll-based — that was true before the SSE upgrade landed.)

### Scores

| API                                                     | Client method                           | Used by                                                                                                                   |
| ------------------------------------------------------- | --------------------------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| `GET /scores/snapshot/{fixtureId}`                      | `ScoresService.getScoresSnapshot`       | not called yet                                                                                                            |
| `GET /scores/updates/{epochDay}/{hourOfDay}/{interval}` | `ScoresService.getScoresUpdates`        | not called yet                                                                                                            |
| `GET /scores/updates/{fixtureId}`                       | `ScoresService.getLiveScoresUpdates`    | not called yet                                                                                                            |
| `GET /scores/historical/{fixtureId}`                    | `ScoresService.getHistoricalScores`     | not called yet                                                                                                            |
| `GET /scores/stream` (SSE)                              | `ScoresService.streamScoresUpdates`     | **`scorer.worker.ts`** — live, implemented, auto-reconnects with a 5s backoff, upserts every event into `MatchEvent`      |
| `GET /scores/stat-validation`                           | `ScoresService.getScoresStatValidation` | **`settlement.service.ts`** — called for every market whose fixture has reached `finalSeq`, once `settleAfter` has passed |

**Live UI** = the scores SSE stream (implemented). **Recovery** = snapshot/historical/interval endpoints (client exists, nothing calls them yet — needed if the stream drops for an extended period). **Settlement provenance** = `scores/stat-validation`, which returns the exact `ScoreStat` + Merkle proof (`statProof`, `subTreeProof`, `mainTreeProof`) needed to call the on-chain program's `settle_market`. This is called with the market's real `statKey`/`statKey2` and the fixture's actual observed `finalSeq` (never `seq=0` — TxLINE's docs call this out explicitly as a common mistake) — see [Part 3 — Settlement](#8-settlement).

### Correct snapshot → updates/stream → validation flow

This is the pattern TxLINE's docs describe, and how Goalana should (and partly does) use it end-to-end:

1. **Snapshot** to seed state (fixtures at boot, odds per-fixture on demand).
2. **Updates or stream** to keep state current — either polling the interval/live update endpoints, or (preferred, lower latency) subscribing to the SSE stream with `Last-Event-ID` support for resume after a disconnect.
3. **Validation** to prove a specific piece of data — a fixture update, an odds update, or (for Goalana's purposes, the one that matters) a match stat — actually belongs to TxLINE's Merkle root, before treating it as ground truth for money movement.

Goalana completes all three steps for scores (snapshot/updates client exists though unused; SSE live-update; `scores/stat-validation` → `settle_market` for provenance), step 1+2 for odds (snapshot recovery + SSE live-update), and step 1+2 (partially) for fixtures — snapshot at boot plus hourly resync, delta updates every 5 min. Fixtures and odds don't need step 3 for Goalana's purposes: only the scores stat proof gates money movement, so `validate_stat`'s CPI is the only on-chain validation call the program makes (TxLINE's docs also define `daily_batch_roots`/`ten_daily_fixtures_roots` PDAs for odds/fixture proofs — Goalana doesn't use either, since it never needs to prove an odds quote or a fixture update on-chain, only the final match stat).

### On-chain CPI verification (the part that actually matters for trust)

`goalana_program/src/txline_cpi.rs` declares TxLINE's real on-chain oracle program ID (`6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J`, matching the devnet program ID used in `apps/api/src/scripts/activate.ts`) and invokes its `validateStat` instruction via CPI, passing:

- `ts` — the oracle snapshot timestamp (ms) the proof is for.
- `fixture_summary: ScoresBatchSummary` — `{ fixture_id, update_stats, events_sub_tree_root }`, from `scores/stat-validation`'s `summary`.
- `fixture_proof: Vec<ProofNode>` — the stat's sub-tree proof (`subTreeProof`).
- `main_tree_proof: Vec<ProofNode>` — proof that the sub-tree root belongs to TxLINE's daily on-chain root (`mainTreeProof`).
- `stat_a` / `stat_b: Option<StatTerm>` — the exact `{ statToProve, eventStatRoot, statProof }` for each stat key in the market's predicate.
- `predicate` — the market's threshold/comparison, translated 1:1 from Goalana's `Predicate` into TxLINE's `TraderPredicate`.

TxLINE's program derives the canonical `daily_scores_roots` PDA for the oracle timestamp's `epoch_day` and returns a single `bool` via Anchor return-data, which `settle_market` uses directly as `Market.outcome`. Because this is a real cross-program invocation into TxLINE's program (not a local re-implementation of the Merkle check), a forged or stale proof is rejected by TxLINE's own program, not by Goalana's — Goalana's program only has to get the _plumbing_ (correct PDA derivation, correct predicate translation, correct timing checks) right. See [Part 3 — Settlement](#8-settlement) for the full settlement walkthrough.

#### Validation PDAs (all three TxLINE-documented types; Goalana only derives one)

| Account                    | Seed(s)                                                                           | Proves                                                | Used by Goalana?                                                                    |
| -------------------------- | --------------------------------------------------------------------------------- | ----------------------------------------------------- | ----------------------------------------------------------------------------------- |
| `daily_scores_roots`       | `"daily_scores_roots"` + `epochDay` (u16 LE)                                      | A `ScoreStat` belongs to TxLINE's daily on-chain root | **Yes** — `settle_market.rs`, derived and `require_keys_eq!`-checked before the CPI |
| `daily_batch_roots`        | `"daily_batch_roots"` + `epochDay` (u16 LE)                                       | An odds update batch                                  | No — Goalana never proves an odds quote on-chain, only the final scoreline          |
| `ten_daily_fixtures_roots` | `"ten_daily_fixtures_roots"` + `epochDay` aligned down to the nearest 10 (u16 LE) | A fixture snapshot/update                             | No — fixture provenance isn't needed for settlement                                 |

`settle_market.rs` derives `epoch_day` as `oracle_ts_ms / 86_400_000` cast to `u16`, using `oracle_ts_ms` from `scores/stat-validation`'s top-level `ts` field (passed through untouched by `settlement.service.ts` as `validation.ts`) — **never** `Date.now()`, per TxLINE's explicit warning that this is the most common cause of `InvalidMainTreeProof`. `settle_market` also independently enforces `oracle_ts_secs >= market.settle_after` (`GoalanaError::StaleOracleSnapshot`), so a stale or pre-window proof is rejected before the CPI even runs.

#### Troubleshooting — TxLINE's documented failure modes vs. Goalana's handling

| TxLINE error                          | Cause                                       | Goalana's guard                                                                                                                                                        |
| ------------------------------------- | ------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 504 on activation                     | Mixed mainnet/devnet values                 | `activate.ts`'s single `CONFIG[NETWORK]` object forces one network for RPC, program ID, mint, and API origin together                                                  |
| 403 signature verification failed     | Wrong preimage/wallet/encoding              | `signActivationMessage` signs the exact `${txSig}:${leagues}:${jwt}` string with the same wallet that submitted `subscribe`, base64-encodes the detached signature     |
| `stat-validation` called with `seq=0` | Placeholder sequence, not a real record     | `settleOneMarket` uses `fixture.finalSeq` — set by `scores.processor.ts` only on an observed `action=game_finalised` record, never a placeholder                       |
| `InvalidMainTreeProof`                | Epoch day derived from wrong timestamp      | See PDA table above — `settle_market.rs` uses the proof's own `ts`, not wall-clock time                                                                                |
| Final outcome uses wrong phase        | In-running record used instead of finalized | `finalSeq` detection specifically watches for `action=game_finalised`, `statusId=100`, `period=100` (see [Part 3 — Final result detection](#6-final-result-detection)) |
| `validateStatV2` checks wrong stat    | `statKeys` index confusion                  | Not applicable — Goalana only ever calls legacy `statKey`/`statKey2` (see `isLegacyValidation` guard in `settlement.service.ts`), never the V2 multi-stat path         |

---

## Part 3 — Market Lifecycle

Each step below states what's implemented today vs. what's planned. On-chain program instructions referenced here are all implemented and audited against `goalana_program/programs/goalana_program/src/instructions/`. The full lifecycle (create → bet → lock → settle → claim/refund) is wired end-to-end, backend and frontend; the one remaining gap is an on-demand market-creation endpoint/UI (step 3) — creation today is cron-only.

### 1. Fixture eligibility

A fixture becomes eligible for market discovery when it's in Postgres (`Fixture` table, synced from TxLINE) and its `startTime` falls within the next 24 hours (`market.service.processMarketsForUpcomingFixtures`, `take: 10` per run, ordered by `startTime`).

- **Implemented.** Runs every 10 minutes (`market.cron.ts`).
- Hardcoded to World Cup only (`competitionId = 72`, `market-definitions.ts` scope).

### 2. Supported odds discovery

For each eligible fixture, `market.service.discoverMarketsForFixture` fetches the current TxLINE odds snapshot (`OddsService.getOddsSnapshots`) and matches rows against `SUPPORTED_MARKETS` (`market-definitions.ts`):

- `FULL_TIME_HOME_WIN` / `FULL_TIME_DRAW` / `FULL_TIME_AWAY_WIN` — from `1X2_PARTICIPANT_RESULT`.
- `FULL_TIME_OVER_2_5` — from `OVERUNDER_PARTICIPANT_GOALS`, `line=2.5`.

Only **pre-match** odds are considered (`row.InRunning` rows are skipped); when multiple rows match the same logical market, the most recent by `Ts` wins. Each match produces a `Predicate` (e.g. `HOME_GOALS - AWAY_GOALS > 0` for a home win) plus a reference YES/NO probability read straight from the odds' `Pct` array.

- **Implemented.**

### 3. House market creation

For each discovered, supported market: `goalana.service.createMarketForFixture` derives the `Predicate` hash (`derivePredicateHash`, SHA-256 over the Borsh-encoded predicate — matches the on-chain `compute_predicate_hash` byte-for-byte), derives the `Market` PDA (`["market", fixture_id_le, predicate_hash]`), checks on-chain whether that PDA already exists (idempotent — **prevents duplicate on-chain creation**), and if not, calls `create_market` signed by the backend's configured wallet (`WALLET_PRIVATE_KEY`).

```text
fixture (Postgres) ─▶ discoverMarketsForFixture ─▶ Predicate + reference odds
                                                        │
                                                        ▼
                                          derivePredicateHash + getMarketPda
                                                        │
                                              already exists on-chain? ──yes──▶ skip (idempotent)
                                                        │ no
                                                        ▼
                                    create_market(fixture_id, predicate, predicate_hash,
                                                   locks_at = kickoff, settle_after = kickoff + 3h)
                                                        │
                                                        ▼
                                   Market PDA created on-chain + mirrored into Postgres `Market` row
```

#### House-only creation

This is a deliberate hackathon scope decision, not a partial implementation:

- `create_market` requires `creator == config.market_authority` (`create_market.rs`), enforced on-chain.
- There is **no** permissionless creation instruction. `MarketOrigin::House` is the only variant ever set; `MarketOrigin::User` exists in `state/market.rs` but is dead code for this hackathon.
- **Do not add** a `create_market_user` instruction or change the `Market` PDA seeds — this is out of scope by explicit product decision (see [Part 1 — Non-Goals](#non-goals-this-hackathon)).
- The frontend _may_ let a user click "create this market" for an eligible fixture that doesn't have one yet — but that click only **requests** creation; the actual `create_market` transaction is still signed by the backend's `market_authority` keypair. This satisfies "user-initiated" without touching the authority model.

- **Implemented:** the on-chain instruction, the discovery logic, the cron trigger, duplicate prevention.
- **Missing:** an on-demand HTTP endpoint to trigger creation for one fixture (today it's cron-only, every 10 min, first 10 upcoming fixtures) and a frontend "create market" affordance. See [Part 4 — Planned, not implemented](#planned-not-implemented).

### 4. User prediction

`place_bet(side: Yes|No, amount)` — any signer, while `market.status == Open` and `now < market.locks_at`. Transfers `amount` lamports from the user to the `Vault` PDA, and accumulates into the user's `Position` PDA (`init_if_needed`) and the market's pari-mutuel totals (`total_yes`/`total_no`).

- **Implemented on-chain**, including overflow-checked math.
- **Implemented in the frontend:** `apps/web`'s `MarketCard` builds and sends a real `place_bet` transaction from the connected wallet (`SolanaProvider`/`useWallet`), with a per-session lifecycle timeline (tx link at every transition).

### 5. Locking

`lock_market()` — `market_authority`-only, transitions `Open → Locked`, sets `locked_at`. Runs at (or just after) each market's `locks_at` (kickoff).

- **Implemented, on-chain and automated.** `lifecycle.cron.ts` runs every minute and calls `lock.service.ts::lockDueMarkets()`, which re-reads on-chain status before acting (idempotent against double-firing) and persists `lockTx`/`lockedAt` on the `Market` row.

### 6. Final result detection

`scorer.worker.ts` consumes TxLINE's scores SSE stream live and hands every event to `scores.processor.ts::processScoresUpdate`, the single canonical entry point (also used by `scores.backfill.ts` for manual/reconciliation backfills). It upserts the raw event into `MatchEvent` (`fixtureId`, `seq`, `action`, `statusId`, `confirmed`, raw `payload`) and then advances `Fixture`'s canonical live state (`homeScore`/`awayScore`/`liveStatusId`/`livePeriodLabel`/`clockSeconds`/`clockRunning`), guarded so a stale/out-of-order `Seq` can never regress it (`lastEventSeq` WHERE-clause guard, not a read-then-check race).

- **Implemented:** the ingestion (stream connection, auto-reconnect), the canonical state derivation, and `Fixture.finalSeq`.
- Confirmed against real fixture payloads that soccer status arrives on the root `StatusId` field, not a separate `StatusSoccerId`. It is populated correctly.
- In practice the real feed's terminal signal is the undocumented `StatusId=100` paired with action `game_finalised`, not the originally-assumed documented codes (5/10/13) — `isTerminal()` treats `action === "game_finalised"` OR `statusId ∈ {5, 10, 13, 100}` as terminal. This is the trigger settlement needs (step 8) and it now exists and has fired on real data.
- **Also added:** `scores.backfill.ts::reconcileLiveFixtures()`, called once on every process boot, re-syncs any fixture that was already mid-match when the process restarted — the SSE worker's resume position (`lastEventId`) only lives in memory, so without this a restart would silently drop events for a live match.

### 7. Proof retrieval / verification

**Off-chain retrieval (implemented):** `settlement.service.ts` calls TxLINE's `GET /scores/stat-validation` for the market's predicate stat key(s) — `TXLINE_STAT_KEYS.HOME_GOALS = 1`, `AWAY_GOALS = 2` (`packages/goalana-sdk/src/txline-stats.ts`) — and returns the `ScoreStat` + three-stage Merkle proof (`statProof`, `subTreeProof`/`eventStatRoot`, `mainTreeProof`). `GET /api/fixtures/:id/proof-preview` exposes this for any finished fixture even without a Goalana settlement.

**On-chain verification (implemented):** `settle_market`'s handler (`settle_market.rs`) CPIs into TxLINE's real oracle program (`txline_cpi::validate_stat`) with the fetched proof, and TxLINE's program — not Goalana's — verifies the Merkle proof against its own on-chain daily root before returning a `bool`. See [Part 2 — On-chain CPI verification](#on-chain-cpi-verification-the-part-that-actually-matters-for-trust) for the full parameter mapping.

- **Implemented, both halves:** off-chain proof fetch and on-chain CPI verification.

### 8. Settlement

`settle_market(oracle_ts_ms, fixture_summary, fixture_proof, main_tree_proof, stat_a, stat_b)` is **permissionless on-chain** — no signer beyond the (unchecked, PDA/owner-constrained) oracle accounts is required, deliberately:

> "Normal TxLINE proof-based settlement is permissionless and does not require this authority to sign." (`state/market.rs`, `ProtocolConfig.settlement_authority` doc comment)

The handler enforces, before trusting the CPI result: `now >= market.settle_after`, `oracle_ts_secs >= market.settle_after` (rejects a stale proof), `fixture_summary.fixture_id == market.fixture_id`, and that `stat_a`/`stat_b` keys match the market's predicate exactly. Only after all of that does it CPI into TxLINE and set `market.outcome`/`status = Settled`.

- **Implemented on-chain, fully, and automated end-to-end.** `lifecycle.cron.ts` calls `settlement.service.ts::settleFinishedFixtures()` every minute; it fetches the proof (step 7), builds and sends `settle_market`, and persists `settlementTx`/`settledAt`/`settlementProof` (a display copy of the exact proof used) on the `Market` row. Also re-reads on-chain state before acting, so a second cron tick after a successful settle is a no-op, not a resubmission.

### 9. Claim

`claim_winnings` (pari-mutuel payout: `winning_stake × total_pool / total_winning_stake`, u128 intermediate math, vault rent-exempt reserve protected) and `claim_refund` (full stake back, on `Cancelled` or a `Settled` market whose winning side has zero stake) — both position-owner-signed, both implemented on-chain with `claimed` flag guarding double-claims.

- **Implemented on-chain, fully**, including edge cases (empty winning pool → refund path, not a stuck payout).
- **Implemented in the frontend:** `MarketCard` builds and sends `claim_winnings`/`claim_refund` transactions from the connected wallet; the `/positions` page lists a wallet's positions with claim actions and Explorer links.

### Status summary

| Step                      | Off-chain / backend                                                       | On-chain program            | Frontend                                                            |
| ------------------------- | ------------------------------------------------------------------------- | --------------------------- | ------------------------------------------------------------------- |
| 1. Fixture eligibility    | Complete                                                                  | —                           | Complete (list + detail page)                                       |
| 2. Odds discovery         | Complete                                                                  | —                           | Complete (odds chart)                                               |
| 3. House market creation  | Complete (cron-only; no on-demand endpoint)                               | Complete                    | Missing (no "create market" UI)                                     |
| 4. User prediction        | —                                                                         | Complete                    | Complete (`place_bet` wired in `MarketCard`)                        |
| 5. Locking                | Complete (`lifecycle.cron.ts`, every minute)                              | Complete                    | Complete (lifecycle timeline + lock countdown)                      |
| 6. Final result detection | Complete (stream, canonical state, `finalSeq` trigger, restart self-heal) | —                           | Complete (live score header, event timeline)                        |
| 7. Proof retrieval        | Complete                                                                  | Complete (CPI verification) | Complete (Settlement Proof / preview tabs)                          |
| 8. Settlement             | Complete (`lifecycle.cron.ts`, every minute)                              | Complete                    | Complete (settlement proof receipt)                                 |
| 9. Claim                  | —                                                                         | Complete                    | Complete (`claim_winnings`/`claim_refund` wired, `/positions` page) |

Remaining gaps are narrow: an on-demand market-creation endpoint/UI (step 3) and other deliberately-deferred items (AI-agent API, extra-time/penalty markets).

---

## Part 4 — Backend API Reference

Base: `apps/api` (Express), default port `BE_PORT` (see `.env.example`, default `8081`). All responses are `{ data: ... }` on success or `{ error: string }` on failure. BigInt fields (e.g. `fixtureId`) are serialized as strings via a global JSON replacer.

### Existing endpoints (implemented today)

These are read straight from `apps/api/src/index.ts` — nothing below is aspirational.

#### `GET /`

Health check. Returns `{ status: "healthy!" }`.

#### `GET /health`

Trivial, dependency-free infra liveness probe. Returns `{ status: "UP", timestamp: <ISO string> }`. Deliberately never touches the DB/RPC so a platform health check never fails on a slow round-trip — see `GET /api/health` below for that.

#### `GET /api/health`

Rich status for the UI's "TxLINE Connected" indicator: SSE stream connection state for odds and scores (connected-since, last frame/event), tracked/live fixture counts, and Solana RPC reachability. Always `200` — a degraded upstream is a payload state, not a transport error.

#### `POST /api/users/connect`

Upsert-based wallet registration — the frontend calls this right after a wallet connects. Body: `{ walletAddress: string }` (validated as a real `PublicKey`). Returns `{ data: { user, isNewUser } }`. `400` if the address is missing or invalid.

#### `GET /api/fixtures`

All fixtures, ordered by `startTime` ascending, each with `_count.markets`. Powers the frontend fixture list (`apps/web/app/page.tsx`).

#### `GET /api/fixtures/:id`

One fixture by `fixtureId` (numeric string, parsed as `BigInt`; `400` if non-numeric), including its `markets` (each with `currentYesPct`/`currentNoPct` computed live from current odds), `odds`, and a normalized match event timeline. 404 if not found. Powers the fixture detail page.

#### `GET /api/markets`

A flat index of every market across all fixtures (id, PDA, type, question, lifecycle timestamps/tx signatures, status, and minimal fixture context) — one request instead of a fixture-by-fixture fan-out. Powers the wallet-scoped `/positions` page, which joins this against on-chain Position accounts.

#### `GET /api/fixtures/:id/odds/history`

Derives an odds-movement time series for the fixture's **1X2 full-time** market (`superOddsType = "1X2_PARTICIPANT_RESULT"`, `marketPeriod = ""`) from `OddsHistory`, deduplicating consecutive identical probability triples. Returns `{ fixtureId, market: "MATCH_RESULT", opening, latest, history: [{ timestamp, home, draw, away }] }`, or `{ data: null }` if no history exists. Powers the "Odds & Movement" tab's chart.

#### `GET /api/fixtures/:id/proof-preview`

Fetches TxLINE's **real** Merkle proof for a finished fixture and returns it in the settlement-receipt shape, without requiring any Goalana market to have actually settled that fixture. `404` if the fixture isn't final yet or TxLINE has no priced stat for it. Powers the "Settlement Proof" preview tab, and is how the proof visualizer stays demoable even when none of Goalana's own markets have settled yet.

#### `POST /api/fixtures/sync`

Manually triggers `syncFixtures` (the full TxLINE snapshot resync for the World Cup competition) and returns `{ success: true }` once it completes. Not called by any cron or frontend code — crons call `syncFixtures()` in-process instead — so this is an ops-only manual trigger, gated behind `ADMIN_SYNC_SECRET` (via `X-Admin-Secret` header) if that env var is set.

### Not exposed as REST — automated internally instead

`lock_market` and `settle_market` are **not** triggered via HTTP endpoint. `lifecycle.cron.ts` runs every minute, re-reads on-chain state, and calls `lock.service.ts`/`settlement.service.ts` directly in-process — a REST trigger was considered and deliberately not built, since the cron already covers both the automatic and "I want it now" cases (worst case, a minute's wait). Settlement evidence (outcome, `settledAt`, oracle timestamp, the full Merkle proof record) is served as part of `GET /api/fixtures/:id`'s `markets[].settlementProof`, not a separate endpoint.

No endpoint is needed for `place_bet` / `claim_winnings` / `claim_refund` — those are user-signed wallet transactions the frontend builds directly against the Anchor program via `@workspace/goalana-sdk`, not backend-mediated. The backend's role in those steps is limited to serving current on-chain-mirrored state (already covered by `GET /api/fixtures/:id` and `GET /api/markets`).

### Planned, not implemented

#### `POST /api/fixtures/:id/markets`

Trigger on-demand market discovery + house creation for one fixture (reuses `discoverMarketsForFixture` + `createMarketForFixture` from `market.service.ts`, scoped to a single fixture instead of the cron's batch-of-10-upcoming). Needed so the frontend can offer a "create market" action instead of waiting up to 10 minutes for the next cron tick. This is the one real remaining gap.
