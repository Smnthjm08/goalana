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

## Adding shadcn components

```bash
pnpm dlx shadcn@latest add button -c apps/web
```

This places components in `packages/ui/src/components`; import them via:

```tsx
import { Button } from "@workspace/ui/components/button";
```
