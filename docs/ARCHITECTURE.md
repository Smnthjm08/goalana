# Goalana — Architecture

Related docs: [TECHNICAL_DOCUMENTATION.md](TECHNICAL_DOCUMENTATION.md) (product, TxLINE integration, market lifecycle, API reference) · [SETUP.md](SETUP.md) (deployment) · [RISKS.md](RISKS.md)

## Monorepo layout

```text
apps/
  web/            Next.js frontend (App Router)
  api/            Express backend — TxLINE ingestion, crons, workers, on-chain market creation
packages/
  db/             Prisma schema + generated client (PostgreSQL)
  txline/         TxLINE API client (auth, fixtures, odds, scores services + SSE)
  goalana-sdk/    TS SDK for the Goalana Anchor program (PDAs, predicate hashing, IDL, client)
  ui/             shadcn/ui component library shared by apps/web
goalana_program/  Anchor workspace — the on-chain Goalana program (Rust)
```

Turborepo (`turbo.json`) wires `build`/`dev`/`start`/`typecheck` across the above; `bun` is the package manager and runtime for `apps/api`.

## Frontend (`apps/web`)

- Next.js App Router, Tailwind + shadcn/ui (`packages/ui`).
- `app/page.tsx` — fixture list, polled from the backend (`GET /api/fixtures`).
- `app/fixtures/[fixtureId]/page.tsx` — fixture detail: markets tab (reads `fixture.markets` from the DB) and an odds-movement chart tab (reads `GET /api/fixtures/:id/odds/history`).
- `components/providers/solana-provider.tsx` + `components/wallet-button.tsx` — wallet-adapter wiring (devnet, `autoConnect`), mounted in `app/layout.tsx`. Wallet connect works today.
- `MarketCard` builds and sends real `place_bet`/`claim_winnings`/`claim_refund` Anchor transactions from the connected wallet, with a per-session lifecycle timeline (tx link at every transition). `app/positions/page.tsx` is a wallet-scoped view across all markets with the same claim actions. See [TECHNICAL_DOCUMENTATION.md — Part 4: Backend API Reference](TECHNICAL_DOCUMENTATION.md#part-4--backend-api-reference) and [Part 3: Market Lifecycle](TECHNICAL_DOCUMENTATION.md#part-3--market-lifecycle).

## Backend / API (`apps/api`)

Single Express process (`src/index.ts`) that does three jobs:

1. **HTTP API** — read-only fixture/odds endpoints for the frontend (see [TECHNICAL_DOCUMENTATION.md — Part 4](TECHNICAL_DOCUMENTATION.md#part-4--backend-api-reference)).
2. **Crons** (`node-cron`, in-process):
   - `fixtures.cron.ts` — `syncFixtures` (snapshot, run once at boot + on-demand via `/api/fixtures/sync`), `syncFixtureUpdates` (every 5 min), `syncPreviousHourBatchValidation` (every 15 min, minutes `5,20,35,50`).
   - `market.cron.ts` — `createTodayMarket` (every 10 min): discovers supported markets from odds and calls the Anchor program to create them on-chain.
   - `odds.cron.ts` — `syncOdds`: snapshot-based odds sync, chained after every fixture snapshot sync.
3. **Long-lived workers** (start in `bootstrap()`, run until process exit):
   - `odds.worker.ts` — subscribes to TxLINE's `/odds/stream` SSE feed (`Last-Event-ID` resume, 5s reconnect backoff), filtering to fixtures Goalana tracks since the stream isn't competition-scoped. Snapshot sync (`odds.cron.ts`) remains the recovery path.
   - `scorer.worker.ts` — consumes the TxLINE **scores SSE stream** directly and upserts every event into `MatchEvent`.

`API_ONLY=true` disables crons/workers so the API can be deployed separately from the ingestion process.

## PostgreSQL / Prisma (`packages/db`)

Key models (`prisma/schema.prisma`):

- `Fixture` — canonical current state per TxLINE fixture (`fixtureId` as `BigInt` primary key).
- `FixtureUpdate` — append-only log of every fixture delta (`payload` raw JSON), for audit/replay.
- `Odds` — one row per **logical market identity** (`fixtureId + bookmakerId + superOddsType + marketPeriod + marketParameters`), upserted on every update — "current state."
- `OddsHistory` — append-only, one row per TxLINE `messageId` — feeds the odds-movement chart.
- `MatchEvent` — one row per `(fixtureId, seq)` score event from the SSE stream; carries `statusId`/`confirmed` and the raw payload.
- `FixtureBatchValidation` — cached Merkle batch-validation responses per `(epochDay, hourOfDay)`.
- `Market` — Goalana's own on-chain markets mirrored off-chain: `marketPda`, `predicateHash`, `locksAt`/`settleAfter`, `initialYesPct`/`initialNoPct`, `status`.

`Fixture.finalSeq` is populated by `scores.processor.ts` once the live feed confirms a terminal event, and `settlement.service.ts` (`apps/api/src/services/`) is the settlement trigger it feeds — both implemented and running on `lifecycle.cron.ts`'s every-minute tick. See [TECHNICAL_DOCUMENTATION.md#status-summary](TECHNICAL_DOCUMENTATION.md#status-summary).

## TxLINE integration

Fully covered in [TECHNICAL_DOCUMENTATION.md — Part 2](TECHNICAL_DOCUMENTATION.md#part-2--txline-integration). Summary: `packages/txline` wraps the full documented surface (auth, fixtures snapshot/updates/validation, odds snapshot/live/interval/SSE/validation, scores snapshot/updates/historical/SSE/stat-validation). `apps/api` uses it for ingestion (crons/workers); the on-chain program independently CPIs into TxLINE's **on-chain** oracle program for settlement proof verification — two separate integration points with the same data source.

## Solana / Anchor program (`goalana_program`)

Program ID (Devnet, live): `ELiJEqT95P8LzEiTrA86TEXXoLbK61cxxHFevvPDGE42` (declared in `lib.rs`, matches `packages/goalana-sdk/src/constants.ts` and the shipped IDL — see [SETUP.md](SETUP.md) for the redeploy history).

Accounts:

- `ProtocolConfig` (PDA `["config"]`) — `authority`, `market_authority`, `settlement_authority`. Initialized once via `initialize_config`.
- `Market` (PDA `["market", fixture_id_le, predicate_hash]`) — predicate, lifecycle status, `total_yes`/`total_no` pari-mutuel pools, timestamps.
- `Vault` (PDA `["vault", market]`) — holds staked SOL as native lamports (no token account).
- `Position` (PDA `["position", market, user]`) — a user's `yes_amount`/`no_amount` + `claimed` flag for one market.

Instructions:

| Instruction         | Signer                                                          | Purpose                                                                          |
| ------------------- | --------------------------------------------------------------- | -------------------------------------------------------------------------------- |
| `initialize_config` | any (becomes admin)                                             | One-time protocol setup                                                          |
| `create_market`     | `market_authority` only                                         | House creates a market from a fixture + predicate                                |
| `lock_market`       | `market_authority` only                                         | Freeze betting (kickoff)                                                         |
| `cancel_market`     | `market_authority` only                                         | Cancel, enabling refunds                                                         |
| `place_bet`         | any user                                                        | Stake SOL on YES/NO before `locks_at`                                            |
| `settle_market`     | **permissionless** — no signer required beyond the CPI accounts | CPI into TxLINE's oracle `validate_stat`; sets `outcome` from the verified proof |
| `claim_winnings`    | position owner                                                  | Pari-mutuel payout from the vault                                                |
| `claim_refund`      | position owner                                                  | Refund on cancel, or on a settled-but-empty-winning-side market                  |

`settle_market` is deliberately permissionless on-chain — anyone (in practice, Goalana's own backend automation) can submit the proof and trigger settlement; the program's Merkle/CPI verification is what makes the result trustworthy, not a signer check. See [TECHNICAL_DOCUMENTATION.md#8-settlement](TECHNICAL_DOCUMENTATION.md#8-settlement).

`create_market`/`lock_market`/`cancel_market` are **house-only** by design for this hackathon (`constraint = creator/authority == config.market_authority`). `MarketOrigin::User` exists as an enum value in `state/market.rs` but has no corresponding permissionless instruction — it is unused, and **will stay unused for this hackathon** per the house-only product decision (see [TECHNICAL_DOCUMENTATION.md#non-goals-this-hackathon](TECHNICAL_DOCUMENTATION.md#non-goals-this-hackathon)).

## Data flow: fixture discovery → claim

```text
TxLINE snapshot/updates ─▶ Fixture / FixtureUpdate (Postgres)
TxLINE odds snapshot/SSE ─▶ Odds / OddsHistory (Postgres)
Odds (Postgres) ─▶ market.service.discoverMarketsForFixture ─▶ goalana.service.createMarketForFixture
                                                                     │
                                                                     ▼
                                                     create_market (Anchor, house authority signs)
                                                                     │
                                                                     ▼
                                                          Market PDA on-chain + Market row (Postgres)
                                                                     │
                              frontend reads GET /api/fixtures/:id ◀┘ (shows the market)
                                                                     │
                              user connects wallet, calls place_bet │
                                                                     ▼
                                                        Vault + Position PDAs updated
lifecycle.cron.ts (every minute) calls lock_market at kickoff, via lock.service.ts
TxLINE scores SSE ─▶ MatchEvent (Postgres)               ← implemented (scorer.worker.ts)
MatchEvent confirmed result ─▶ fetch scores/stat-validation proof (settlement.service.ts)
                                                                     │
                                                                     ▼
                                          settle_market (Anchor, CPI-verifies proof, permissionless)
                                          triggered automatically by lifecycle.cron.ts
                                                                     │
                                                                     ▼
                                          claim_winnings / claim_refund (user signs, via MarketCard/positions page)
```

The chain from **TxLINE → Postgres → on-chain market creation → bet → lock → settle → claim** is implemented end-to-end, backend and frontend — see [TECHNICAL_DOCUMENTATION.md — Part 3: Market Lifecycle](TECHNICAL_DOCUMENTATION.md#part-3--market-lifecycle) for the authoritative per-step status. The remaining gap is an on-demand market-creation endpoint/UI (creation is currently cron-only).
