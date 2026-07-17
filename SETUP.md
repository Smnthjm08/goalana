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
