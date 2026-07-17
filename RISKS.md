# RISKS.md — honest scope, trust surface, and known limitations

Goalana's core claim is that **settlement can't be faked** — a TxLINE Merkle proof is verified
on-chain, inside `settle_market`, via CPI into TxLINE's own oracle. This document is the other
half of that honesty: what *isn't* trustless, what's operationally fragile, and what we measured
rather than assumed. Nothing below is a surprise we're hiding — it's the same standard we hold
the settlement claim to, applied to the rest of the system.

---

## 1. Tampered-proof rejection — the evidence

Settlement never trusts Goalana's backend. `settle_market` delegates the outcome check to a CPI
into TxLINE's real oracle program (`validate_stat`), which re-hashes the three-stage Merkle path
(stat leaf → `eventStatRoot` → subtree root → anchored `daily_scores_roots`) and only returns
`true`/`false` — it does not trust the caller's claimed value. To demonstrate this isn't just an
architecture diagram, we submitted the **exact instruction `settle_market` uses**, standalone,
against the **real Devnet oracle**, for England 1–2 Argentina (fixture `18241006`):

| Case | Proof | Result | Signature |
|---|---|---|---|
| Total goals > 1.5 (keys 1+2) | genuine | ✅ accepted → `YES`, 198,959 CU | [`4uB1JMtx…dpt5GEcA`](https://explorer.solana.com/tx/4uB1JMtxtZEr5K5rDfx2e3n4eXK6tpdaVk6QbCFWqzw7sy4PxvEbZkJ6ozo5TtNkc5e7zBaRA6hpDFoxdpt5GEcA?cluster=devnet) |
| Total corners > 9.5 (keys 7+8) | genuine | ✅ accepted → `NO`, 198,965 CU | [`qMSVSThU…cALVJWi`](https://explorer.solana.com/tx/qMSVSThUULv23wsjNnL2uVBDZt4mq42GcYRVHjU2BcCXN92o2DNPzxqZKxRofd2fofmKnn9QiC34s16fcALVJWi?cluster=devnet) |
| Total yellow cards > 3.5 (keys 3+4) | genuine | ✅ accepted → `YES`, 198,963 CU | [`22r1dJCS…x4vC7T7B`](https://explorer.solana.com/tx/22r1dJCSeX5MzGPWkRNnPnNz2khCj24QsJV35JBQRc5xJdhQkgfUyZLaBxGUXX2TSNi16AC9HeQMhpkGx4vC7T7B?cluster=devnet) |
| Same goals proof, **value forged** 1 → 6 | tampered | ❌ **reverted** — `InvalidStatProof` (6023) | [`2fpwYkGU…d56K74Bb`](https://explorer.solana.com/tx/2fpwYkGU3apxRb5WnvXeXNQ6MGwtuDJZikW53ZfZrLi7k64hC9RRJBHZvh7wZ1cVX1kfsd4dUg47PaGQd56K74Bb?cluster=devnet) |
| Same goals proof, **one sibling-hash byte flipped** | tampered | ❌ **reverted** — `InvalidStatProof` (6023) | [`Zf3XtAxZ…C4HpqX3`](https://explorer.solana.com/tx/Zf3XtAxZtEsZivuvRtHzsfJhS4mHfFmtr5ikzb318v67ukPxb5ScDiXzCjwaRk4iMVvpbyLm8YvVpoRaC4HpqX3?cluster=devnet) |

Change one goal, or flip one byte of one sibling hash, and the oracle reverts — the CPI fails and
`settle_market` reverts with it. Rendered in-app under each fixture's **Proof Integrity** tab.
Reproduce: `bun src/scripts/record-proof-integrity.ts <fixtureId> --execute` (from `apps/api`).

**Why this ran standalone rather than through a real `settle_market` failure:** the program
deliberately cannot settle a fixture that finished before its market existed (`create_market.rs`
enforces `settle_after > locks_at` at creation, and a finished match's proof timestamp is already
in the past). Isolating the CPI via a top-level `validate_stat` call was the only way to
demonstrate rejection against a fixture that had already finished — see `docs/API.md` and
`packages/goalana-sdk/src/txoracle.ts::buildValidateStatIx()`.

**This also proves settlement is stat-agnostic, not a goals-only oracle** — goals, corners, and
cards all verify through the identical `add + greaterThan` predicate and the identical
instruction; only the stat keys differ. That's what backs the parametric prop markets
("Total corners > 9.5", "Total cards > 3.5") on France v England — see [`v2-todo.md` item 18](./v2-todo.md).

---

## 2. Settlement compute-cost

The oracle's cost scales with proof depth, not a fixed amount — measured across two finished
fixtures via the recorded `validate_stat` calls above:

| Stat | Fixture 18237038 | Fixture 18241006 |
|---|---:|---:|
| Goals (keys 1/2) | 131,986 CU | 198,959 CU |
| Corners (keys 7/8) | 200,460 CU | 198,965 CU |
| Cards (keys 3/4) | 200,458 CU | 198,963 CU |

Two of those already **exceed Solana's 200,000 CU single-instruction default outright**, and the
rest clear it by roughly a thousand CU — before `settle_market` does any of its own work (PDA
derivation, account loads, the account write). A CPI shares the caller's compute budget, so
without an explicit budget, `settle_market` would plausibly **run out of compute and fail** on
any fixture with a deep enough proof — this would have killed the real France v England
settlement. Fixed: `settleMarketOnChain` now sets `SETTLE_COMPUTE_UNIT_LIMIT = 400_000` via
`preInstructions`, giving roughly 2x headroom over the worst measured cost.

The 26/26 localnet test suite cannot catch this class of bug — its mock CPI hashes nothing, so
it's effectively free regardless of proof depth (see §3 below).

---

## 3. Known limitation: the localnet mock oracle doesn't check the proof

`txoracle_mock` (used by the 26/26 `anchor test` suite) returns `threshold >= 100` regardless of
what's in the proof — it does not verify a Merkle path. This is why §1's tampered-proof evidence
runs on **Devnet only**, against TxLINE's real deployed oracle: it's the only place that property
can be demonstrated. The localnet suite is still valuable — it exercises Goalana's *own* guards
(stat-key binding, stale-oracle-snapshot rejection, PDA derivation, the full lifecycle state
machine, payout math) — but it proves nothing about cryptographic proof integrity. We label this
distinction everywhere it matters (README's "Honest status" section, the Proof Integrity tab)
rather than let the 26/26 badge imply more than it does.

---

## 4. House trust surface

Goalana is **house-only for creation, lock, and cancel** — deliberately, to keep the settlement
path itself simple and legible (see [`docs/PRD.md`](docs/PRD.md#non-goals-this-hackathon)).
`settle_market`, `claim_winnings`, and `claim_refund` are permissionless: no authority signer is
required, so anyone (a keeper bot, a user, a judge) can trigger settlement once a genuine proof
exists, and every payout is user-pulled. The house's remaining powers are real and worth stating
plainly rather than leaving a judge to find them by reading the program:

- **`cancel_market` is unconditional** — callable on both `Open` and `Locked` markets, with no
  time gate. The house could in principle cancel a market seconds before genuine settlement,
  turning a losing pool into refunds for everyone. It **cannot** redirect funds to itself or
  choose an outcome — cancellation only ever routes to `claim_refund` at face value, and every
  fund movement still requires the position owner's own signature.
- **`lock_market` has no `now >= locks_at` check** — the house could freeze betting before
  kickoff. `place_bet` independently enforces `now < locks_at` regardless, so early locking
  narrows the betting window rather than creating a fund-safety issue.
- Neither power can move a single lamport without a user's own signed claim — the trust surface
  is "the house can change *when* a market resolves," never "the house can decide *what* it
  resolves to, or take custody of stakes."

Not fixed pre-submission by design: both would require a program redeploy, and the deployed
program is intentionally **frozen** until the France v England semifinal settles (a live,
externally-positioned market sits on it — an upgrade the night before is unbounded downside for
zero judge-visible upside). If shipped post-settlement: `lock_market` becomes permissionless +
time-gated (`now >= market.locks_at`), and `cancel_market` gets restricted to `status == Open` or
gated to outside a window of `settle_after`.

---

## 5. Smaller, non-fund-safety issues

- **Vault dust.** Payouts use floor-division on `u128` intermediate math (checked arithmetic,
  correct proportional splits) — the residual lamports from rounding stay in the Vault PDA with
  no sweep path today. Not a fund-safety issue (nobody's stake is shorted beyond integer
  rounding), just unreclaimed dust; a `close_vault` (once all positions have claimed) is
  post-hackathon work.
- **Position rent is never reclaimed.** There's no instruction to close a `Position` account
  after it's claimed, so ~0.002 SOL in rent stays locked per position indefinitely.
  `instructions/close_bet.rs` exists in the repo as an unwired 5-line stub (`handle_close_bet()`
  is empty and never registered in `lib.rs`) — presumably scaffolding for exactly this that was
  never finished. Harmless to a judge reading the program (it does nothing, silently), but worth
  naming rather than leaving as an unexplained dead file.
- **`lock_market`/`cancel_market` don't re-derive PDA seeds** the way `bet`/`claim`/`settle` do.
  Safe today — `Account<Market>` already enforces owner + discriminator, and both instructions are
  authority-gated — but inconsistent, and worth tightening if `lock_market`/`cancel_market` are
  ever touched for the §4 fixes above.

---

## 6. Operational risks (infra, not protocol)

- **No backoff cap on SSE reconnect.** Both the odds and scores workers retry every 5s
  indefinitely on a sustained TxLINE outage. Acceptable at hackathon scale; worth an exponential
  cap given more time.
- **No retry on individual RPC/DB calls.** The idempotent lifecycle cron self-heals within
  roughly 60 seconds regardless (every tick re-reads on-chain state before acting), but a
  persistently-failing RPC endpoint gets hit every minute with no backoff in between.
- **TxLINE free-tier access ends at the submission deadline.** Everything used as evidence —
  settlement proofs, proof-integrity artifacts, the odds/scores history — is persisted in
  Goalana's own database specifically so it stays fully inspectable after the feed goes dark
  during judging, rather than depending on a live re-fetch.

---

## 7. Live, non-code risk at time of writing

The France v England markets were cancelled and recreated on 2026-07-17 to fix a stat-key bug
(see [`v2-todo.md`](./v2-todo.md#stat-key-validation--france-v-england-recreate-2026-07-17)) —
correct and necessary, but it left an **external wallet's 1.051 SOL position on the now-cancelled
old `HOME_WIN` market**. That wallet — not Goalana's backend, which cannot sign on their behalf —
needs to call `claim_refund` (the app surfaces a **Claim Refund** button on the cancelled market
card). This is escrow working as designed — funds are refundable, not stuck — but it's an open
action item, not a resolved one, until that wallet acts.

---

_Everything above reflects the code and on-chain state as of 2026-07-17. See
[`README.md`](./README.md#honest-status) for the localnet-vs-Devnet evidence scoping, and
[`v2-todo.md`](./v2-todo.md) / [`v3-todo.md`](./v3-todo.md) for the full dated build log._
