# Deploying Goalana to a New Program Address

Checklist for redeploying `goalana_program` under a **brand-new program ID**
on devnet (fresh keypair, fresh on-chain state) and wiring every consumer
(SDK, API, web) to it.

> This is different from `docs/DEPLOYMENT.md`, which covers deploying the
> already-built `apps/api` server to a VM. This doc is about the Anchor
> program itself getting a new address.

## Why the program ID is scattered

There's no single `PROGRAM_ID` env var — the ID is hardcoded in 6 places
because Anchor's IDL/type codegen and the SDK constants are independent
sources of truth:

| # | File | What it is |
|---|------|------------|
| 1 | `goalana_program/programs/goalana_program/src/lib.rs:12` | `declare_id!` — compiled into the on-chain binary |
| 2 | `goalana_program/Anchor.toml` | `[programs.localnet]` entry Anchor CLI uses for deploy/test |
| 3 | `packages/goalana-sdk/scripts/sync-idl.ts:5` | `TARGET_PROGRAM_ID` — stamped into the IDL/types on sync |
| 4 | `packages/goalana-sdk/src/idl/goalana_program.json` + `src/types/goalana_program.ts` | generated — **don't hand-edit**, produced by `sync-idl.ts` |
| 5 | `packages/goalana-sdk/src/constants.ts:7` | `GOALANA_PROGRAM_ID` — used by `apps/api` via the SDK |
| 6 | `apps/web/lib/protocol.ts:7` | `GOALANA_PROGRAM_ID` — web's own copy (doesn't import the SDK) |

`config.authority` / `market_authority` / `settlement_authority` are **not**
env vars either — they get set on-chain, once, to whichever wallet signs
`initialize_config` (see Step 6). That wallet must be the API's
`WALLET_PRIVATE_KEY`, or every admin-gated instruction (`lock_market`,
`cancel_market`, `create_market`, `close_position`) will reject the API's
transactions afterward.

---

## Step 0 — Prereqs

- `anchor-cli 1.1.2`, `solana-cli 3.x` (already installed and on `PATH` here)
- A devnet-funded keypair to pay for the deploy (rent + program buffer, a few SOL)
- `bun install` already run at repo root

## Step 0.5 — Choose the new production authority wallet

There is no `rotate_authority` instruction. Whichever keypair signs Step 8's
`initialize_config` becomes `config.authority` / `market_authority` /
`settlement_authority` **permanently**, for the life of this program address —
that same key must then also be the one that signs every `create_market`,
`lock_market`, `cancel_market` call the API makes going forward, or those
instructions reject with a signer/authority mismatch. Decide this before
Step 1, not after Step 8.

If you want a real production authority distinct from the hackathon dev wallet
(`B9cWHC7dS6P1gG98FbXzyYhSMLL8J5dvHfMza39gNPar`, the one baked into the current
`.env.production`):

```bash
solana-keygen new -o ./goalana-prod-authority.json --no-bip39-passphrase
solana-keygen pubkey ./goalana-prod-authority.json
solana airdrop 2 $(solana-keygen pubkey ./goalana-prod-authority.json) --url devnet
```

This writes the keypair into the repo root as `goalana-prod-authority.json` —
already added to `.gitignore` so it can't be committed by accident, same
treatment as the existing `devnet-wallet.json`. Back it up somewhere durable
outside the repo too (password manager / secrets vault) — losing it means
losing the ability to lock/cancel/settle every market ever created under this
program address. You'll paste its secret key into `WALLET_PRIVATE_KEY` in
Step 7.

## Step 1 — Generate the new program keypair

```bash
cd goalana_program
solana-keygen new -o target/deploy/goalana_program-keypair.json --force --no-bip39-passphrase
solana-keygen pubkey target/deploy/goalana_program-keypair.json
```

Copy the printed pubkey — call it `<NEW_PROGRAM_ID>`. This keypair *is* the
program's upgrade authority mechanism (Anchor deploys upgradeable programs);
back it up somewhere durable, it's gitignored (`goalana_program/target` isn't
tracked) and losing it means losing upgrade authority.

## Step 2 — Point the source at the new ID

Replace the old ID (`AgxqK6wRkFKyabyArNiJF8dpoJ6TNLLxPnV5rg27pRQu`) with
`<NEW_PROGRAM_ID>` in:

- `goalana_program/programs/goalana_program/src/lib.rs:12` — `declare_id!("<NEW_PROGRAM_ID>");`
- `goalana_program/Anchor.toml` — `[programs.localnet]` entry (Anchor.toml only has a `localnet` table today; add a `[programs.devnet]` table with the same value so `anchor deploy --provider.cluster devnet` and IDL commands resolve correctly)

```toml
[programs.localnet]
goalana_program = "<NEW_PROGRAM_ID>"

[programs.devnet]
goalana_program = "<NEW_PROGRAM_ID>"
```

Don't touch `txline_cpi.rs` or `txoracle_mock` — that `declare_id!`
(`6pW64gN...`) is TxLINE's oracle program, a separate deployment you're not
changing.

## Step 3 — Build

```bash
cd goalana_program
anchor build
```

This recompiles the `.so` with the new ID baked in and regenerates
`target/idl/goalana_program.json` + `target/types/goalana_program.ts`.

## Step 4 — Deploy to devnet

```bash
cd goalana_program
solana config set --url https://api.devnet.solana.com
solana balance <your-deployer-wallet>   # top up via `solana airdrop 2` if needed

anchor deploy --provider.cluster devnet --provider.wallet ~/.config/solana/id.json
```

(Swap the wallet path for whichever keypair you're funding — `Anchor.toml`'s
`[provider]` defaults to `~/.config/solana/id.json` / `cluster = "localnet"`,
both overridden here via flags rather than edited, so local testing is
unaffected.)

Confirm it landed:

```bash
solana program show <NEW_PROGRAM_ID> --url devnet
```

## Step 5 — Sync the IDL into the SDK

```bash
cd packages/goalana-sdk
```

Edit `scripts/sync-idl.ts:5` — `TARGET_PROGRAM_ID = "<NEW_PROGRAM_ID>"` — then:

```bash
bun scripts/sync-idl.ts
```

This copies `goalana_program/target/idl/goalana_program.json` and
`target/types/goalana_program.ts` into `packages/goalana-sdk/src/idl` and
`src/types`, stamping the top-level `address` field with `<NEW_PROGRAM_ID>`
(nested account addresses like the System Program / TxOracle CPI target are
left alone — see the comment in that script).

## Step 6 — Update the two manual constants

- `packages/goalana-sdk/src/constants.ts:7` — `GOALANA_PROGRAM_ID = new PublicKey("<NEW_PROGRAM_ID>")`
- `apps/web/lib/protocol.ts:7` — `GOALANA_PROGRAM_ID = "<NEW_PROGRAM_ID>"`

## Step 7 — Env vars (`.env`, `.env.production`)

Nothing here names the program ID directly, but double check these still
point where you expect for the network you just deployed to:

- `SOLANA_RPC_URL` / `NEXT_PUBLIC_SOLANA_RPC_URL` — devnet RPC endpoint (a
  dedicated provider, not the public `api.devnet.solana.com`, per the note
  in `apps/web/components/providers/solana-provider.tsx:21`)
- `WALLET_PRIVATE_KEY` — **this is the wallet that must sign Step 8 below.**
  It's the API's fee-payer/authority (`apps/api/src/services/goalana.service.ts:18-34`),
  accepts either a base58 string or a JSON byte-array string. Make sure it
  holds devnet SOL.

## Step 8 — Initialize on-chain config (new program = empty state)

A fresh program address means the `config` PDA doesn't exist yet — every
admin-gated instruction will fail until it's created, and whoever signs this
becomes `authority` / `market_authority` / `settlement_authority` for good
(`goalana_program/programs/goalana_program/src/instructions/initialize_config.rs:24-30`).
Run it with the same `WALLET_PRIVATE_KEY` set in Step 7:

```bash
cd apps/api
bun run -e '
import { initializeGoalanaConfig } from "./src/services/goalana.service";
await initializeGoalanaConfig();
'
```

(`initializeGoalanaConfig` in `apps/api/src/services/goalana.service.ts:55`
is idempotent — it no-ops if the config PDA already exists, so it's safe to
re-run.)

## Step 9 — Rebuild and restart the apps

```bash
bun run build       # turbo build across the monorepo picks up the new SDK constants
```

Restart whatever's running `apps/api` (`pm2 reload goalana-api --update-env`
if using the VM flow in `docs/DEPLOYMENT.md`) and redeploy/restart
`apps/web` so the new `NEXT_PUBLIC_*`-baked build ships.

## Step 10 — Sanity check

- `solana program show <NEW_PROGRAM_ID> --url devnet` — confirm deployed slot
- Hit the app, place a test bet on devnet, confirm the tx shows the new
  program ID on https://explorer.solana.com/?cluster=devnet
- Check `/inspector` (if reintroduced) or logs for `Config initialized in
  tx:` from Step 8

---

### If you actually just want to upgrade the existing program (same address)

Skip Steps 1–2 and 6, 8 entirely — just `anchor build && anchor deploy
--provider.cluster devnet` with the *existing* `goalana_program-keypair.json`
present in `target/deploy/`. The ID stays
`AgxqK6wRkFKyabyArNiJF8dpoJ6TNLLxPnV5rg27pRQu`, existing PDAs/config/markets
are untouched, and nothing downstream needs updating. Only do the full
new-address flow above if you specifically need a clean slate.

---

## Going live: starting the API in production, not locally

The goal here is that from the moment the new program address is live, every
fixture/odds/market/bet the crons touch gets written to the **production**
DB/API, not a local dev process — so there's no "local test data" to reconcile
or throw away later.

### Step 11 — Sync the `production` branch before deploying

`deploy.sh` deploys whatever is on the `production` branch
(`git checkout production && git pull --ff-only origin production`), **not**
`main`. As of this writing `production` is a clean fast-forward candidate —
7 commits behind `main`, 0 commits of its own ahead — so this is a safe,
conflict-free fast-forward, not a merge:

```bash
git checkout production
git merge main --ff-only
git push origin production
git checkout main
```

Skipping this step means the VM redeploys 7-commits-stale code (missing the
CORS required-env fix, the share/market/position pages, the reverted
multi-competition config, etc.) while you believe you're shipping current
`main`. Re-check `git rev-list --left-right --count main...production`
before every future deploy — if it's ever not `N 0`, `production` has drifted
and you have real commits to reconcile, not a fast-forward.

### Step 12 — Point `.env.production` at the new program's world

Nothing in `.env.production` names the program ID directly (see Step 7), but
since Step 0.5/8 above mean a **new authority wallet** and a **fresh on-chain
config**, update on the VM:

- `WALLET_PRIVATE_KEY` — the Step 0.5 production authority's secret key (not
  the old hackathon dev wallet's)
- `SOLANA_RPC_URL` / `NEXT_PUBLIC_SOLANA_RPC_URL` — keep pointed at the
  dedicated devnet RPC provider (never the public `api.devnet.solana.com` —
  `settle_market` alone is a 400k-CU tx that the public endpoint won't
  reliably confirm)
- `API_ONLY` **must stay `"false"`** on the VM (`index.ts:485`) — that's the
  flag that turns on the lifecycle cron, market-creation cron, and the
  odds/score SSE workers. `"true"` (what `apps/api/package.json`'s `dev:api`
  script forces) makes the process a read-only API with no ingestion at all.

### Step 13 — First boot on a fresh program: nothing to migrate in the DB

Confirming the earlier point directly: there is no DB step that "moves" the
deployment to the new address. The DB has no `programId` column — it only
stores `marketPda` values that are meaningless once the program address
changes. The correct sequence is:

1. VM boots with `API_ONLY=false` against the new program + new authority.
2. The existing market-creation cron (`market.service.ts`, runs every 10 min
   over upcoming fixtures) calls `create_market` against the **new** program
   ID automatically and writes fresh `Market` rows with the new PDAs — no
   manual DB writes needed.
3. Old `Market` rows from the previous program address are now orphaned
   (their PDAs point at an account under the old, now-superseded program).
   Leave them — deleting isn't required for correctness — or clean them up
   with a one-off script once you've confirmed the new markets are flowing,
   your call.

### Step 14 — First deploy (VM has no `goalana-api` pm2 process yet)

If this VM has never run the app before, `deploy.sh`'s `pm2 reload
goalana-api` will fail (nothing to reload). Bootstrap once using
`docs/DEPLOYMENT.md`'s flow, then `deploy.sh` works for every deploy after:

```bash
ssh <vm>
git clone <repo-url> goalana && cd goalana
git checkout production   # already synced to main in Step 11
bun install
# .env.production already has real values (WALLET_PRIVATE_KEY, DATABASE_URL,
# TXLINE_* etc.) — copy it to the VM securely (scp, not committed to git) as .env
cd packages/db && bun run migrate:deploy && cd ../..
bun add -g pm2
pm2 start "bun run start" --name "goalana-api" --cwd "./apps/api"
pm2 save
pm2 startup
```

From here on, every subsequent deploy is just running `./deploy.sh` (Steps
11–12 already folded into it once `production` tracks `main` and
`.env.production` is current on the VM).

### Step 15 — Don't run a second ingesting process locally

`todo.md` already documents the failure mode: **3 concurrent `apps/api`
processes double-processing the same lifecycle cron ticks.** Once the VM is
live with `API_ONLY=false`, run locally only with `API_ONLY=true` (i.e.
`bun run dev:api`, never plain `bun run dev`) — that gives you a local
read-only API against the same DB for testing, without a second process
racing the VM's cron for lock/settle/create-market calls.
