# Goalana

World Cup prediction markets on Solana, priced and settled from **TxLINE** (TxODDS' verifiable sports data feed). Built for the Superteam "Prediction Markets & Settlement" hackathon.

Real TxLINE fixture → house creates on-chain market → user bets → market locks at kickoff → confirmed TxLINE result detected → TxLINE Merkle proof fetched and verified on-chain (CPI into TxLINE's own oracle program) → market settles → winner claims.

## Start here (docs/)

This repo's real documentation lives in [`docs/`](./docs) — read these before making changes, they reflect an actual code audit, not aspirational design:

- [`docs/PRD.md`](./docs/PRD.md) — problem, scope, MVP features, non-goals, success criteria
- [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md) — monorepo layout, frontend/backend/DB/program, data flow
- [`docs/TXLINE.md`](./docs/TXLINE.md) — how Goalana uses TxLINE (auth, fixtures/odds/scores, on-chain Merkle proof CPI)
- [`docs/MARKET_LIFECYCLE.md`](./docs/MARKET_LIFECYCLE.md) — the 9-step lifecycle with an implemented-vs-missing status per step
- [`docs/API.md`](./docs/API.md) — existing backend endpoints vs. planned ones (clearly separated — don't assume planned ones exist)
- [`docs/IMPLEMENTATION_PLAN.md`](./docs/IMPLEMENTATION_PLAN.md) — current status table + prioritized remaining work
- [`docs/DEPLOYMENT.md`](./docs/DEPLOYMENT.md) — manual VM deployment guide for `apps/api`

## Key product decision

Market creation is **house-only** for this hackathon: the Goalana backend's `market_authority` wallet signs every `create_market` call. There is no permissionless/user market creation instruction, and none should be added — see [`docs/PRD.md#non-goals-this-hackathon`](./docs/PRD.md#non-goals-this-hackathon) and [`docs/MARKET_LIFECYCLE.md#house-only-creation`](./docs/MARKET_LIFECYCLE.md#house-only-creation).

## Repo layout

```text
apps/web            Next.js frontend
apps/api             Express backend — TxLINE ingestion, crons, workers, on-chain calls
packages/db          Prisma schema (PostgreSQL)
packages/txline      TxLINE API client (auth, fixtures, odds, scores + SSE)
packages/goalana-sdk TS SDK for the Goalana Anchor program
packages/ui          shared shadcn/ui components
goalana_program      Anchor workspace — the on-chain program (Rust)
```

## Validation mode (`COMPETITION_ID`)
i
World Cup (TxLINE competition `72`) is **the product** — this is not a multi-competition pivot. `apps/api/src/config/competition.ts` exists purely as Devnet-validation continuity: the hackathon submission needs real evidence of the full on-chain lifecycle (`sync → odds → create_market → bet → lock → settle → claim`), and that depends on a real match actually kicking off and finishing inside the judging window. If the World Cup fixture currently furthest along stalls, there's no fallback fixture to fall back on.

`getActiveCompetitionId()` resolves once per process (cached for its lifetime):

- If `COMPETITION_ID` is set in the environment, it's used as-is (logged on boot).
- Otherwise, it calls TxLINE's `/fixtures/snapshot` with **no `competitionId` filter** — the only legitimate discovery signal TxLINE exposes (there is no "list competitions" endpoint, and guessing IDs 403s). It groups the results by competition and keeps World Cup (`72`) as long as World Cup has any upcoming fixture. Only if World Cup has none does it fall back to the competition with the soonest upcoming kickoff elsewhere in the subscription bundle (the free tier also includes "International Friendlies", competition `430`).

To reset to World Cup explicitly: unset `COMPETITION_ID`, or set `COMPETITION_ID=72`. To force a specific competition for testing: set `COMPETITION_ID=<id>`.

`apps/api/src/scripts/verify-competition-discovery.ts` and `apps/api/src/scripts/check-live-state.ts` are one-off diagnostic scripts (same pattern as `manual-sync.ts`) for inspecting the discovery decision and live fixture/odds state without waiting on the cron schedule.

## Adding shadcn components

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

This places components in `packages/ui/src/components`; import them via:

```tsx
import { Button } from "@workspace/ui/components/button";
```
