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
| --- | ------ | ------------ |
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

## Step 0 — Prereqs ✅

- `anchor-cli 1.1.2`, `solana-cli 3.x` (already installed and on `PATH` here)
- A devnet-funded keypair to pay for the deploy (rent + program buffer, a few SOL)
- `bun install` already run at repo root

## Step 0.5 — Choose the new production authority wallet ⚠️ superseded

**Attempted, but didn't end up as the real authority — see incident note
below.** Generated `./goalana-prod-authority.json`, pubkey
`BZF1y4Ha31ighWmRbvx3NZCG4L57bSjZfEu9NNFsi5u5`, funded with 5 SOL via direct
transfer (`29oL1JvtKa2wc2DweqDSmLRQCVecAkMLmrr7GsUuy3pD1jdRJNt9tTX6s8Ah7o5XfeJwSALnTgctQ8WAdgBSTNwz`).
This wallet is **not** this program's actual authority — kept around unused,
harmless to leave funded.

**🚨 Incident: a long-running background `bun --watch src/index.ts` process
(started 2026-07-16 21:53, well before this whole pass) silently called
`initialize_config` on the new program using the wrong wallet.** `bun --watch`
auto-reloads on file changes, so once Steps 5/6 updated the SDK's program ID,
that process picked up the **new** program ID live — but it was still reading
the repo-root `.env` (never swapped), which has `API_ONLY="false"` and the
**old** hackathon dev wallet. Its market-creation cron
(`market.service.ts:293`) calls `initializeGoalanaConfig()` automatically
before creating a market, and did so within its normal 10-minute tick —
new program ID + old wallet + an active cron = the old wallet became this
program's permanent `authority` / `market_authority` / `settlement_authority`.
Confirmed by decoding the actual on-chain account bytes at the config PDA
(`G4CZWBesSU9GwVb1GY7mU3ssv7gvnnkDsRJ8WNa6iZ8n`) — all three authority fields
match the old wallet's pubkey byte-for-byte, not the new one.

**Resolution: accepted, not redone.** No functional issue with one wallet
being authority for two independent program deployments — each program's
config PDA is independent, no cross-program conflict. `WALLET_PRIVATE_KEY` in
`.env.devnet` was updated to the **old** dev wallet's key (the one actually
matching on-chain state) instead of `goalana-prod-authority.json`'s. The
offending background process (PID 64926) was killed
(`kill` then `kill -9`, SIGTERM alone didn't stop it).

**Lesson for next time:** before editing any file a long-running `bun --watch`
process might reload (SDK constants, IDL, anything workspace-linked), check
for and stop stray background processes first — `todo.md` had already
documented this general class of bug (concurrent processes double-processing
cron ticks) but it wasn't checked for at the start of this pass.

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

## Step 1 — Generate the new program keypair ✅

**Done.** `<NEW_PROGRAM_ID>` = `ELiJEqT95P8LzEiTrA86TEXXoLbK61cxxHFevvPDGE42`,
written to `goalana_program/target/deploy/goalana_program-keypair.json`.

```bash
cd goalana_program
solana-keygen new -o target/deploy/goalana_program-keypair.json --force --no-bip39-passphrase
solana-keygen pubkey target/deploy/goalana_program-keypair.json
```

Copy the printed pubkey — call it `<NEW_PROGRAM_ID>`. This keypair *is* the
program's upgrade authority mechanism (Anchor deploys upgradeable programs);
back it up somewhere durable, it's gitignored (`goalana_program/target` isn't
tracked) and losing it means losing upgrade authority.

## Step 2 — Point the source at the new ID ✅

**Done.** `lib.rs`'s `declare_id!` and both `Anchor.toml` tables
(`[programs.localnet]` + new `[programs.devnet]`) now hold
`ELiJEqT95P8LzEiTrA86TEXXoLbK61cxxHFevvPDGE42`, confirmed via `git diff --staged`.

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

## Step 3 — Build ✅

**Done.** `anchor build` finished clean (release + test profiles, unit tests
ran). It also printed a `Program ID mismatch` warning for `txoracle_mock` —
confirmed unrelated: that keypair file is dated July 13 (pre-dates this
whole pass) and isn't something Step 1/2 touched. Its real CPI-target ID
(`txline_cpi.rs`'s `declare_id!`, `6pW64gN...`) is untouched and correct.
**Do not run `anchor keys sync`** — it would overwrite that unrelated
program's ID and break the CPI wiring.

```bash
cd goalana_program
anchor build
```

This recompiles the `.so` with the new ID baked in and regenerates
`target/idl/goalana_program.json` + `target/types/goalana_program.ts`.

## Step 4 — Deploy to devnet ✅

**Done.** Deployed with `--provider.wallet ../goalana-prod-authority.json`
against the public `https://api.devnet.solana.com` RPC. The CLI reported
"Failed to initialize IDL" after printing the Program ID — that's Anchor's
separate, optional on-chain IDL-metadata write (unused by this codebase, the
SDK ships its own local IDL), not the actual program deploy. Confirmed via
`solana program show`:

```bash
Program Id: ELiJEqT95P8LzEiTrA86TEXXoLbK61cxxHFevvPDGE42
Owner: BPFLoaderUpgradeab1e11111111111111111111111
ProgramData Address: 9sZEaGWG7jKdMrYN7rsgoRw5eGyKihtxVZNRkYsY2jVC
Authority: BZF1y4Ha31ighWmRbvx3NZCG4L57bSjZfEu9NNFsi5u5
Last Deployed In Slot: 477145364
Data Length: 329824 (0x50860) bytes
Balance: 2.29677912 SOL
```

**Update, see Step 0.5's incident note:** this deploy's upgrade authority
(`goalana-prod-authority.json`, above) and Step 8's actual on-chain business
authority ended up being **two different wallets**, not the same one as
planned — a background process raced Step 8 and set the old dev wallet as
business authority instead. Harmless (they're separate roles — upgrade
authority never gates `create_market`/`lock_market`/etc., only business
authority does), just not the unified setup originally intended.

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

## Step 5 — Sync the IDL into the SDK ✅

**Done.** `sync-idl.ts` ran clean; confirmed via diff that
`idl/goalana_program.json` and `types/goalana_program.ts` both got their
top-level `address` stamped with the new ID, while the nested System Program
and TxOracle CPI addresses were correctly left alone.

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

## Step 6 — Update the two manual constants ✅

**Done.** Both confirmed via diff:

- `packages/goalana-sdk/src/constants.ts:7` — `GOALANA_PROGRAM_ID = new PublicKey("<NEW_PROGRAM_ID>")`
- `apps/web/lib/protocol.ts:7` — `GOALANA_PROGRAM_ID = "<NEW_PROGRAM_ID>"`

## Step 7 — Env vars (`.env`, `.env.production`) ✅

**Done.** Values finalized in `.env.devnet`: `TXLINE_API_ORIGIN`,
`TXLINE_JWT`, `TXLINE_API_TOKEN`, `DATABASE_URL` (a fresh, separate Neon DB —
`ep-patient-night...`, deliberately not the same one `.env.production` uses),
`BE_PORT`, `API_ONLY`, `SOLANA_RPC_URL` / `NEXT_PUBLIC_SOLANA_RPC_URL`,
`WALLET_PRIVATE_KEY` (byte-for-byte verified against
`goalana-prod-authority.json`), `NEXT_PUBLIC_SITE_URL`, `NEXT_PUBLIC_API_URL`.

**Plan changed from "swap locally":** these values get pasted directly into
the VM's `.env` as part of Step 14, not applied to this machine's local
`.env`. Step 8 (`initialize_config`) and the DB migration both run on the VM
too, right after that paste — see Step 14 for the exact commands. Only
reminder carried into that step: include `TXLINE_ENV` (any value) alongside
these when building the VM's `.env`, since `index.ts`'s boot check requires
it to be present.

**⚠️ `.env.devnet` is currently git-tracked (removed from `.gitignore`) and
holds a real secret key in plaintext.** Re-add it to `.gitignore` before this
repo goes public, or the authority wallet is compromised the moment it's
pushed.

Nothing here names the program ID directly, but double check these still
point where you expect for the network you just deployed to:

- `SOLANA_RPC_URL` / `NEXT_PUBLIC_SOLANA_RPC_URL` — devnet RPC endpoint (a
  dedicated provider, not the public `api.devnet.solana.com`, per the note
  in `apps/web/components/providers/solana-provider.tsx:21`)
- `WALLET_PRIVATE_KEY` — **this is the wallet that must sign Step 8 below.**
  It's the API's fee-payer/authority (`apps/api/src/services/goalana.service.ts:18-34`),
  accepts either a base58 string or a JSON byte-array string. Make sure it
  holds devnet SOL.

## Step 8 — Initialize on-chain config (new program = empty state) ✅

**Done — but not the way planned.** A background process (see Step 0.5's
incident note) triggered this automatically before it was run deliberately.
Confirmed on-chain: config PDA `G4CZWBesSU9GwVb1GY7mU3ssv7gvnnkDsRJ8WNa6iZ8n`
exists (105 bytes, owned by the new program), `authority` /
`market_authority` / `settlement_authority` all equal the **old** hackathon
dev wallet's pubkey (`B9cWHC7dS6P1gG98FbXzyYhSMLL8J5dvHfMza39gNPar`), decoded
byte-for-byte from the raw account data. `.env.devnet`'s `WALLET_PRIVATE_KEY`
has been updated to match (the old wallet's key, not
`goalana-prod-authority.json`'s) so future `create_market`/`lock_market`/
`cancel_market`/`settle_market` calls sign correctly against this program.

Can run locally **or** on the VM (Step 14) — it's network/wallet-scoped, not
machine-scoped, and idempotent, so it only takes effect once wherever you run
it first (already satisfied here — re-running the command below now would
just log "Config PDA already initialized." and exit, which is expected).

A fresh program address means the `config` PDA doesn't exist yet — every
admin-gated instruction will fail until it's created, and whoever signs this
becomes `authority` / `market_authority` / `settlement_authority` for good
(`goalana_program/programs/goalana_program/src/instructions/initialize_config.rs:24-30`).

**`bun run -e '<multi-line string>'` doesn't reliably parse** (confirmed —
it fell through to the help menu instead of running). Use a temp script file
instead, the same pattern `docs/DEPLOYMENT.md` already uses elsewhere:

```bash
cd apps/api
cat << 'EOF' > init-config-once.ts
import { initializeGoalanaConfig } from "./src/services/goalana.service";
await initializeGoalanaConfig();
EOF
bun run init-config-once.ts
rm init-config-once.ts
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
  program ID on <https://explorer.solana.com/?cluster=devnet>
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
since Step 8 means a **fresh on-chain config**, update on the VM:

- `WALLET_PRIVATE_KEY` — **the old hackathon dev wallet's secret key**
  (`.env.production`'s current value, unchanged) — per Step 0.5/8's incident
  note, that ended up being this new program's real authority, not the
  separate `goalana-prod-authority.json` wallet originally intended. Use
  whatever's already in `.env.devnet` at this point.
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
# paste .env.devnet's values (plus TXLINE_ENV — see Step 7) into this VM's
# .env directly here, e.g. via `nano .env` — not committed to git
cd packages/db && bun run migrate:deploy && cd ../..

# Step 8 — safe to run again even if already done locally, it no-ops if the
# config PDA already exists:
cd apps/api
cat << 'EOF' > init-config-once.ts
import { initializeGoalanaConfig } from "./src/services/goalana.service";
await initializeGoalanaConfig();
EOF
bun run init-config-once.ts
rm init-config-once.ts
cd ../..

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

### Step 16 — Backend before frontend, not the other way round

Deploy in this order — frontend depends on the backend being live, not
vice versa:

1. **Backend/VM first** (Steps 11–14 above). Confirm it's actually serving:
   `curl https://<vm-domain-or-ip>/api/health`, confirm a real fixture list
   comes back, confirm the on-chain config from Step 8 is visible through it.
2. **Then Vercel (frontend)**. `NEXT_PUBLIC_API_URL` / `NEXT_PUBLIC_SITE_URL` /
   `NEXT_PUBLIC_SOLANA_RPC_URL` are all baked in at **build time** — Vercel
   needs the backend's real, already-live URL before it builds, or the
   deployed frontend ships pointed at nothing (or worse, the old backend).
   Set those in Vercel's project env vars, trigger a deploy, then verify
   wallet connect → place a real bet → see it reflected against the new
   program, all from the public Vercel URL.

Reversing this order (frontend first) just means rebuilding/redeploying the
frontend a second time once the backend URL is known — not harmful, just
wasted a round trip.
