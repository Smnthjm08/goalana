# Goalana — Final Features Shortlist (top 5, judge-lens)

_Written 2026-07-19 (deadline day, 23:59 UTC). Read this against `v3-todo.md` §0's
rule: the judge only touches the demo video, the deployed app, and the repo._

Ranked by **uniqueness ÷ effort ÷ risk**, not raw impact — the goal is "a judge who
has watched 50 identical TxLINE-escrow-CPI demos remembers this one for a _new_
reason," same bar `v2-todo.md` used for the proof-visualizer wedge.

## Status at a glance

| #   | Item                                                             |                       Status                       | Green tick needs                                                                       |
| --- | ---------------------------------------------------------------- | :------------------------------------------------: | -------------------------------------------------------------------------------------- |
| 1   | Challenge Pools (user-proposed, house-signed, on-chain enforced) | 🚧 **Deployed to Devnet** — not yet exercised live | One live approve→create→bet cycle once a fixture is available                          |
| 2   | Atomic bet slip (multi-bet, one signature)                       |      🚧 Code-complete, **browser-unverified**      | One real click-test: stage 2+ bets, submit, confirm a single wallet popup + one tx sig |
| 3   | Cross-market liquidity & volume dashboard                        |            ✅ **Shipped** — `/liquidity`           | None — live, sortable, real pool data                                                  |
| 4   | AI Agent API                                                     |                   ☐ Not started                    | Not attempted — see effort/status below                                                |
| 5   | Client-side Merkle re-verification                               |     ✅ **Shipped** — spike succeeded, see below     | None — reproduces real proofs in-browser for two full stages                           |
| 6   | Permissionless settlement bounty                                 |                   ☐ Not started                    | Needs its own design pass (fee source, cap, anti-spam) before writing code             |
| 7   | Public settlement proof gallery (no wallet needed)               |            ✅ **Shipped** — `/proofs`               | None — live, no wallet required, falls back to live TxLINE previews when nothing of ours has settled yet |
| 8   | USDC / SPL-token markets                                         |                   ☐ Not started                    | Real program change — needs its own design pass, see below                             |

Legend: ✅ done and verified live · 🚧 built, one concrete step from done · ☐ not started.

**Reviewer's note on track fit (added 2026-07-19, checked against the TxLINE track brief):**
the brief explicitly names "Custom On-Chain Settlement Engines" that "utilize Cross-Program
Invocations (CPIs) into TxLINE's `validate_stat` instruction to confirm match outcomes
trustlessly" as a specifically-valued pattern. `settle_market.rs:124-135` already does exactly
this — it CPIs into the TxOracle program's `validate_stat` (`txline_cpi.rs:88-118`, `invoke()`
against the declared oracle program ID) and never re-implements Merkle math itself; the local
`txoracle_mock` doesn't even check proofs, confirming the real proof math lives entirely in the
oracle program, outside this repo. This isn't a code gap — it's a **documentation/demo gap**.
Today's `README.md`/`SETUP.md` describe the proof-receipt UI but don't name the CPI-to-
`validate_stat` architecture explicitly, which is the literal phrase judges will be scoring
against. Say it by name in the technical documentation and show the CPI call site on screen in
the demo video — this is a five-minute fix worth more judge-visible credit than most items below.

---

## 1. User-proposed parametric prop markets, house-signed → "Challenge Pools" 🚧

**What:** Right now `PARAMETRIC_PROP_MARKETS` (`apps/api/src/services/market-definitions.ts:161`)
is a **hardcoded** pair — "Total corners > 9.5" and "Total cards > 3.5" — created
automatically for every fixture. Generalize it: let a user (or an agent) submit a
custom threshold over any of the already-validated stat pairs (corners 7/8, cards
3/4, goals 1/2 — see `todo.md`'s stat-key validation) — e.g. "Total corners > 7.5"
or "Total cards > 5.5" — as a request. The house reviews and, if it approves, signs
the **exact same** `create_market` call the automated cron already makes.

**Why unique:** `create_market` is hard-gated on-chain — `creator` must equal
`config.market_authority` (`create_market.rs:47-49`, `address = config.market_authority`)
— so true permissionless creation isn't possible without a program change. This
doesn't try to fight that; it turns the constraint into the story: **"the community
designs the bet, the house is a rubber stamp with no fund custody, cryptography
still settles it."** No competitor identified in `v2-todo.md`'s teardown (Final
Whistle, GoalChain, Quovra, GoalLine, WorldCup PredMarket) does user-driven market
_design_ — only user-driven market _participation_. This is a genuinely new angle,
not a copy of anyone's idea.

**Why zero risk:** Reuses `create_market` byte-for-byte — same instruction, same
predicate shape (`add + greaterThan`, already audited), same `MarketOrigin::House`
tag (`create_market.rs:80`). The only new surface is a request queue (a DB table +
one review endpoint) sitting entirely in `apps/api`. Doesn't touch `settle_market.rs`,
`txline_cpi.rs`, or anything under `v3-todo.md` §0's freeze list.

**Effort:** ~0.5–1d — a `MarketRequest` table (fixtureId, statA/statB keys, threshold,
requester wallet, status), a submit form, and an admin-approve action that calls the
same `createParametricPropMarketsForFixture`-style path already proven live (item 18
in `v2-todo.md`). Skip full moderation UI if short on time — even a CLI approval
script is a legitimate v1 (mirrors how `create-prop-markets.ts` already works).

**Status: 🚧 deployed to Devnet, not yet exercised live.** DB/API/frontend done and
verified live against the running API. Program-level enforcement
(`create_challenge_market` + `place_challenge_bet` + `ChallengePool` account)
written, Anchor suite 33/33, monorepo typecheck 6/6, lint 0 errors, and **now live
on-chain** at the same program ID — see the progress-log entries below for the
full build + deploy record.

**To get the green tick (in order):**

1. ~~Devnet redeploy~~ ✅ **done** — see the 2026-07-19 deploy log entry below.
2. **One live end-to-end cycle** — submit a request → house approves via
   `POST /api/market-requests/:id/review` → confirm `ChallengePool` account exists
   on Explorer → one `place_challenge_bet` from a real wallet → confirm the fixed
   stake landed and the per-side cap is enforced (a violating bet should revert
   with `ChallengePoolSideFull` on real Devnet, not just in the local test).
3. **A fixture to run it on** — the France v England final has already played, so
   step 2 needs an upcoming fixture once TxLINE prices one, or a synthetic
   never-settling market the same way `todo.md`'s earlier claim_refund validation
   used one (see "Live-devnet settlement/claims validation" in `todo.md`).
4. **Browser click-through** — no headless-browser tool was available while
   building this; the propose form, request list, and challenge market card
   should each get one manual look before it's in the demo script.

---

## 2. Atomic multi-bet, one signature 🚧

**What:** Let a user stake on several markets in a single wallet approval instead
of one `place_bet` transaction per market. `place_bet`'s accounts
(`place_bet.rs:7-35`) are already fully self-contained per market — `market`/`vault`/
`position` all derive their own PDAs from `market.key()`, with no shared or ordered
state between different markets' bets. That means **N independent `place_bet`
instructions can already be packed into one Solana transaction and signed once** —
this needs no new Anchor instruction, just SDK/frontend work to build a bet slip,
compose the instructions, and submit as one `Transaction` (or a v0 tx + address
lookup table if the slip grows past the ~4–6 markets a legacy tx's 1232-byte limit
comfortably fits).

**Why unique:** Every competitor in the teardown, and Goalana today, is one-bet-per-
signature. A "build your slate, sign once" flow reads like a real sportsbook bet
slip, not a single-market toy — and it's a concrete, demoable UX beat ("five markets,
one wallet popup") that costs the judge zero extra cognitive load to appreciate.
Also a genuine efficiency story: one signature = one set of network round trips
instead of N, and (if pushed further) one v0 tx with a lookup table demonstrates
real Solana-native tx-construction competence, not just "wallet adapter defaults."

**Why zero risk:** No program change, so it doesn't touch anything under the
redeploy gate (moot today — the France v England settlement already happened
2026-07-18 21:00 UTC — but the same "don't touch what's live and working" logic
still applies to the deployed program on submission day). Worst case, a bet slip
transaction fails atomically (all-or-nothing) exactly like `place_bet` already does
per-market — no new partial-failure mode to reason about.

**Effort:** ~0.5d for the core (compose instructions, one signature, one toast);
another ~0.5d if you want the v0 tx + lookup table path for slips bigger than ~5
markets. The corners/cards prop markets from item 18 make a great demo pairing —
"stake on the match winner and the corners prop in one click."

**Status: 🚧 code-complete, browser-unverified.** `bet-slip-context.tsx` +
`bet-slip-drawer.tsx` built, wired into `layout.tsx` and `market-card.tsx`,
typecheck 6/6, lint 0 errors. No program change at all, so this one has **no
redeploy dependency** — it works against whatever program version is live,
including today's, without waiting on item #1's deploy.

**To get the green tick:**

1. **One real click-test** — connect a wallet, add 2+ markets to the slip
   (mix a normal market and, once #1 is deployed, a challenge-pool leg),
   submit, and confirm: exactly one wallet popup, one transaction signature,
   and both positions land (check `/positions` or the market cards refresh).
2. **Confirm the 6-leg cap is enforced client-side** — try adding a 7th market
   and confirm it's silently rejected rather than building an oversized tx
   that fails on submit.
3. Nothing here needs a redeploy or a specific fixture — it can be verified
   against the currently-deployed program right now, independent of #1.

---

## 3. Cross-market liquidity & volume dashboard ☐

**What:** A single view (new `/liquidity` page, or a panel on the fixtures browse
page) listing every open market across the tournament sorted by pool size, with
each row showing: total staked, YES/NO split, `PoolVsReference` divergence badge
(already built — `pool-vs-reference.tsx`), and time-to-lock. Purely a new
aggregation/read view over data that already exists in the DB and is already
served by `GET /api/markets`.

**Why unique:** The track brief names this by title — "Prediction Market Viewer:
a clean dashboard or analytics interface that tracks active volumes, changing
liquidity, or shifting odds across World Cup prediction spaces" — and it's the
one line item in README's "Built to the track sheet" table still marked 🟡
Partial. Correcting the record first: the "pool-implied-probability-vs-TxLINE-
reference display" half of that partial claim is actually **already shipped**
(`pool-vs-reference.tsx`, wired into `market-card.tsx`) — the README line is
stale and undersells what's built. What's genuinely still missing is the
cross-market rollup: today a user sees one market's liquidity at a time, never
all of them ranked together.

**Why zero risk:** Read-only aggregation over an endpoint that already exists
(`GET /api/markets` in `apps/api/src/index.ts`). No program change, no new DB
writes, no redeploy — doesn't touch anything under `v3-todo.md` §0's freeze list.
Worst case it's a table with a sort dropdown; there's no failure mode beyond a
rendering bug.

**Effort:** ~2–4h for a genuinely useful v1 — a sortable table (pool size, split,
divergence, lock countdown) fed by data the frontend already fetches per-market
today, just not aggregated across markets. A full "changing liquidity over time"
sparkline is a stretch goal, not required to satisfy the track's ask.

**Status: ☐ not started — and correctly so today.** Same posture as items #4–6
below: `v3-todo.md` §0 is explicit that no new feature is worth touching until
every P0/P1 item in that doc is closed. As of this review (2026-07-19, deadline
day) the repo is still **private** and README:13 still has placeholder demo/app
links — those are submission-blocking and must close first. If there are spare
hours after P0/P1 and after exercising #1/#2 live, this is the single cheapest,
lowest-risk remaining item that closes an explicitly-named track gap — rank it
above #4–6.

---

## 4. AI Agent API (unsigned-transaction builder + `llm.txt`) ☐

**What:** `GET /markets`, `GET /positions/:wallet` (trivial — data already exists),
plus `POST /markets/:id/bet-tx` / `POST /positions/:id/claim-tx` that return an
**unsigned, serialized transaction** for an agent to sign with its own key — Goalana
never custodies agent funds. Ship an `llm.txt`/OpenAPI descriptor so an agent can
self-discover the surface.

**Why unique:** The track brief explicitly names AI agents as eligible builders
(`v2-todo.md` §5, item 13) and, per that doc's own audit, almost nobody targets it.
Pairs naturally with item 2 above — an agent building a multi-market bet slip is
the same instruction-composition code path a human's bet-slip UI uses.

**Effort / status:** ~1d, low-medium risk, additive REST only. Real idea, correctly
not attempted yet — **does not fit today's remaining hours** unless P0 submission
blockers (repo visibility, demo video, live app link — see prior turn) are already
closed out.

---

## 5. Client-side Merkle proof re-verification ("don't trust us") ☐

**What:** Recompute the Merkle root in the browser from the leaf + sibling hashes
the settlement receipt already renders (`settlement-proof-receipt.tsx`), and show
"✓ independently reproduces the on-chain anchored root" — no backend involved in
the check the judge is looking at.

**Why unique:** The single most convincing trust artifact left on the table — maxes
out the track's Experimental Verification Layer bonus, and no competitor in the
teardown does it (GoalLine's `ProofVisualizer` renders the tree but doesn't
_recompute_ it independently). This is the natural sequel to the already-shipped
proof receipt and Proof Integrity tab.

**Effort / status:** ~1d, **high uncertainty** — gated entirely on matching
TxLINE's exact hash algorithm (leaf/node domain separation, byte order). `v2-todo.md`
flagged this correctly: spike it against one real proof first; only ship if the
root actually reproduces. Not a today item — it's a spike, and a failed spike burns
a day for nothing with hours left before 23:59 UTC.

---

## 6. Permissionless settlement bounty (small crank incentive) ☐

**What:** `settle_market` already takes no authority signer — anyone holding a
genuine TxLINE proof can call it (`README`'s already-shipped "permissionless
settlement" line). Today the only thing that actually calls it is Goalana's own
keeper cron. Add a thin incentive: a small lamport tip carved from the vault
(bounded, e.g. capped at dust-level or a fixed small fee) paid to whoever's
signature lands the successful `settle_market` call — first to submit wins it.

**Why unique:** Turns "permissionless" from a legally-true-but-never-exercised
property into something a judge could, in principle, go do themselves on a live
market and get paid a few lamports for it. No competitor's settlement story has an
economic incentive layer at all — this is a genuine mechanism-design idea, not
polish.

**Effort / status:** Real Anchor change to `settle_market.rs` — new vault-fee-split
logic, new tests, a fresh audit of payout math (the exact class of change
`v3-todo.md` §4 gates behind "only after settlement evidence is captured AND
everything else is green"). **Not a today item.** Flagging it here so it isn't
lost, not because it's ready — it needs its own design pass (fee source, cap,
anti-spam/self-settle economics) before it's safe to write, let alone deploy.

**Landscape check (Colosseum Copilot, 2026-07-19):** searched builder projects for
"keeper bot crank incentive permissionless settlement reward" — nothing on-topic
came back (closest hits were a generic MEV-bot template and an unrelated staking-
reward system). As far as the available corpus shows, no prior Solana hackathon
project has paired a prediction-market settlement instruction with a crank
incentive. Doesn't change the effort/risk verdict above, but it's one more reason
to keep this on the backlog rather than drop it — it's still an open, undersold angle.

---

## 7. Public settlement proof gallery (no wallet needed) ☐

**What:** A standalone page (e.g. `/proofs` or a "How settlement works" panel)
that aggregates already-**closed** fixtures and surfaces 2–3 fully-cycled markets
— bet placed → `settle_market` CPI landed → `settlement-proof-receipt.tsx` →
example claim — **without requiring a connected wallet**. Pure read aggregation
over data that already exists: closed fixtures (`fixtures/page.tsx`'s existing
`closedFixtures` filter), their settled markets, and the already-built
`settlement-proof-receipt.tsx` component.

**Why this, why now:** The track brief's own submission note says it directly —
_"the matches will end after the submission deadline, there may not be live
activity on the project during review... make sure your demo clearly showcases
the product experience."_ Today that risk is real and already realized: the
France v England final has played, there's no upcoming WC fixture, and the two
places that show settlement proof are (a) `/positions`, which only shows _your_
wallet's bets — empty for a judge who hasn't played — and (b)
`settlement-proof-receipt.tsx`, which is only rendered inside a single closed
fixture's market card (buried, not a showcase, confirmed by direct code read).
A judge with an unfunded wallet currently has **no page that proves resolution
happened** without digging. This item exists to close exactly that gap, in the
judge's own words from the brief, not a hypothetical one.

**Why unique:** Doubles as the track's "Verifiable Resolution UI" idea
("a feature that saves or displays the data receipt or Merkle proof... giving
users a clear, traceable record... without needing to trust an external oracle")
— but framed as a public showcase instead of a per-bet artifact, which is the
version that actually survives a review window with zero live matches.

**Why zero risk:** Read-only aggregation over `closedFixtures` (already computed
client-side in `fixtures/page.tsx`) plus the already-built, already-working
`settlement-proof-receipt.tsx`. No program change, no new DB writes, no new API
route beyond what `/api/markets` already returns. Same risk tier as item #3.

**Effort:** ~2–3h — pick 2–3 already-settled markets, reuse the existing receipt
component in a new standalone layout, add a one-line explainer of the CPI-into-
`validate_stat` flow (ties directly into the reviewer's note above). This is
almost certainly the single highest demo-value-per-hour item left in this
document given today's specific fixture-availability situation.

---

## 8. USDC / SPL-token markets ☐

**What:** `place_bet.rs` and `create_market.rs` currently move funds exclusively
via `anchor_lang::system_program::transfer` — native SOL only, confirmed by direct
code read (no mint or `TokenAccount` field anywhere in `place_bet.rs`,
`create_market.rs`, or `state/vault.rs`). Add SPL-token (e.g. USDC) support: a
mint-scoped vault (ATA-owned PDA instead of a bare lamport PDA) and
`transfer_checked` calls in place of `system_program::transfer`.

**Why unique / why the track calls for it:** The brief's architectural-
considerations section is explicit that the _TxLINE credit token itself_ is
locked to data-authorization only and cannot be wagered — but it separately,
explicitly encourages settlement engines that "unlock funds and execute
transfers natively on Solana **on other coins than TxLINE**," and names USDC
by example ("holds user funds (such as USDC) in escrow"). Today Goalana's
markets are SOL-denominated only, so this is a real, brief-named gap, not a
speculative one — a stablecoin-denominated market is also the more realistic
sportsbook analogue (bettors think in dollars, not SOL price swings mid-market).

**Why NOT a today item:** This is genuine Anchor surgery — new vault account
shape (breaks the existing `Vault { bump: u8 }` layout for any _new_ markets;
existing SOL markets would need to stay on the old code path, so this is additive-
only if done carefully, similar in spirit to how Challenge Pools added a
companion PDA rather than touching `Market`/`Vault`), new `transfer_checked`
CPIs into the SPL Token program, new tests for decimals/rounding on a 6-decimal
mint vs SOL's 9, and a fresh payout-math audit. That's the same class of change
`v3-todo.md` §4 gates behind "only after everything else is green." **Not a today
item** — flagged so it isn't lost, and ranked below items #3 and #7 because those
close named track gaps in hours, not a redesign.

**Effort / status:** ~1–2d for a careful additive implementation (new instruction
variants alongside the existing SOL path, not a replacement) plus a full test
pass. Needs its own design note first: single mint (USDC only) vs mint-agnostic,
and whether existing SOL markets and new USDC markets coexist in the same
`/api/markets` listing or are visually distinguished.

---

## Progress log — 2026-07-19 (#1 Challenge Pools + #2 Bet Slip shipped)

Both zero-program-change features built end-to-end. Typecheck **6/6 clean**, lint
**0 errors**, DB migration applied to the Neon production DB, new API routes
verified live against the running API.

**#1 evolved into "Challenge Pools"** per the user's fixed-stake / 1v1 / 4v4 idea —
a strictly better framing than the abstract "custom threshold" (it reuses the
existing pari-mutuel escrow as a fixed-stake N-vs-N skin, and ties into the
share-links feature).

- **DB** (`packages/db/prisma/schema.prisma`, migration `20260718231551_add_challenge_pools`):
  new `MarketRequest` model (fixture, requester wallet, validated stat pair,
  threshold, `fixedStakeLamports`, `slotsPerSide`, status, resulting `marketPda`);
  - nullable `Market.fixedStakeLamports` / `slotsPerSide` / `proposedByWallet`
    stamped onto the created market on approval. All additive/nullable — safe.
- **API** (`apps/api/src/services/market-request.service.ts`, routes in `index.ts`):
  `POST /api/market-requests` (open — validates stat/threshold/stake/slots +
  fixture-exists + pre-kickoff, writes a PENDING row, no chain touch);
  `GET /api/market-requests?fixtureId=&status=`; `POST /api/market-requests/:id/review`
  (house-gated by the existing `ADMIN_SYNC_SECRET` — approve signs the SAME
  authority-gated `create_market` the cron uses, then stamps the fixed-stake
  metadata onto the Market row). Verified live: GET returns `{success,requests}`,
  POST correctly 400s on the pre-kickoff guard and on an unknown stat.
- **Frontend**: `components/fixtures/challenge-pool-panel.tsx` (propose form: stat /
  over-line / fixed stake / 1v1·2v2·4v4 format + per-fixture request list with
  PENDING/APPROVED/REJECTED state), mounted at the bottom of the MARKETS tab in
  `fixture-detail-view.tsx`. `market-card.tsx` now recognises challenge pools:
  locks the bet amount to the fixed stake, shows a `Challenge Pool · NvN` badge
  with live YES/NO slot fill (pool ÷ fixed stake), and a "Join X SOL" button.
- **Honest caveat (not code):** approved pools only go live once the house calls
  the review endpoint, and there are no upcoming WC fixtures right now (final has
  played), so a _live_ end-to-end approve→create demo needs a future fixture. The
  submit/validate/list path and the fixed-stake UI are fully demoable today.

**#2 Bet Slip — atomic multi-bet, one signature:**

- `components/bet-slip/bet-slip-context.tsx` (slip state, one leg per market,
  capped at `MAX_SLIP_LEGS = 6` to stay inside a legacy tx) +
  `bet-slip-drawer.tsx` (floating slip that composes N `place_bet` instructions
  via `.instruction()` into one `Transaction` and submits with a single
  `provider.sendAndConfirm` — one wallet popup, atomic all-or-nothing).
- Provider + drawer mounted in `app/layout.tsx`; `market-card.tsx` gets a
  "+ Add to bet slip" button next to Place Bet.
- **Not verified in a real browser** (no headless-browser tool here): the actual
  wallet-signing of the composed tx. Logic is a straight composition of the
  already-working single `place_bet` path, and typechecks against the real IDL.

## Progress log — 2026-07-19 (#1 upgraded to ON-CHAIN enforcement)

Per the user (judges stand on on-chain verification, so the pools must too), the
app-layer version above was upgraded to genuine in-consensus enforcement. **Anchor
suite 33/33 passing** (was 29 — 4 new challenge tests), typecheck 6/6, lint 0
errors. Deployed to Devnet the same day — see the deploy log entry below.

- **Program (additive — no Market/Vault/Position layout change, existing markets
  untouched):**
  - New `ChallengePool` account (`state/challenge_pool.rs`) — companion PDA
    (`[b"challenge", market]`) committing `fixed_stake` + `slots_per_side` +
    `proposed_by` into consensus, publicly readable on Explorer.
  - New `create_challenge_market` — mirrors `create_market` (same predicate-hash
    verification, time gates, House authority gate) and also inits the ChallengePool.
  - New `place_challenge_bet` — the enforced entry: stake is taken from the pool
    (not the caller), and the per-side total is capped at `fixed_stake *
slots_per_side`. A violating bet **reverts on-chain** (`ChallengePoolSideFull`).
  - New errors: `InvalidChallengeConfig`, `InvalidChallengePool`, `ChallengePoolSideFull`.
  - Tests: create commits terms on-chain; zero-stake rejected; fixed-amount stake;
    per-side cap enforced (2nd entry into a 1v1 side reverts, opposing side still open).
- **SDK:** `sync-idl` regenerated IDL + types; new `getChallengePoolPda`; `CHALLENGE` seed.
- **Backend:** `createChallengeMarketForFixture` (calls the new instruction);
  `approveChallengeRequest` now creates the enforced on-chain pool.
- **Frontend:** `market-card` + `bet-slip-drawer` route challenge legs through
  `place_challenge_bet` (standard markets still use `place_bet`).
- **Honest residual (repo-style):** the generic `place_bet` remains callable on any
  market — we deliberately didn't fork the audited hot path. Pari-mutuel makes that
  safe (proportional payout, no theft); worst case is an unbalanced pool. The pool's
  _terms_ are on-chain and immutable, and the _enforced_ path checks them in consensus.

## Progress log — 2026-07-19 (Devnet upgrade deployed)

User confirmed the redeploy after reviewing the additive-only diff. Deployed in
place — **same program ID** (`ELiJEqT95P8LzEiTrA86TEXXoLbK61cxxHFevvPDGE42`), same
upgrade authority (`goalana-prod-authority.json`), no new address, no migration.

- **ProgramData extended first** (`solana program extend … 100000 -k
../goalana-prod-authority.json`) — the new binary (400,944 bytes) exceeded the
  previously allocated space (329,824 bytes).
- **First upgrade attempt failed on insufficient lamports** — the authority wallet
  had 1.97 SOL, the buffer needed ~2.79 SOL. Topped up with a 1.5 SOL transfer from
  the funded `devnet-wallet.json` (17.69 SOL balance) rather than the rate-limited
  devnet faucet — same-cluster wallet-to-wallet transfers aren't subject to the
  faucet's rate limit. Confirmed via signature
  `4UGhHVgbGBThGqmZ27Ud8fKrPTjvT9XM1gUuXXxGfdjggnS6sYHdJ5J93gNn2W3AdWLhAAuS9WCzCkDhXXeHND7Q`.
- **Upgrade landed on retry** — `anchor deploy` auto-resumed from the partial
  buffer left by the failed attempt. Real upgrade signature:
  `2tWfPFhXwXsjkT2xTALBD3RujSqYpdksPxwXtjwdQ2nTp9TkPodSjdbAMsgWWZ6dURHjRPmKFbpLv8umy9otC5pp`.
  The subsequent "Failed to initialize IDL" message is Anchor's separate, optional
  on-chain IDL-metadata write (unused — the SDK ships its own local IDL) — the same
  non-fatal message `SETUP.md`'s Step 4 already documented the first time this
  program was ever deployed, not a sign the upgrade failed.
- **Verified via `solana program show`**: `Last Deployed In Slot` moved
  477145364 → 477257515, `Data Length` grew 329,824 → 429,824 bytes (matches the
  extend + new binary), same `Authority`. The upgrade took.
- **Not yet done:** an actual `place_challenge_bet` call against the live program —
  that needs an approved request + an open fixture (checklist items 2–4 above are
  unchanged by this deploy landing).

## Progress log — 2026-07-19 (audit: default house creation untouched, opt-in confirmed)

User asked for confirmation that (a) the normal house market-creation path (cron-driven,
always-on) is untouched and (b) challenge-pool creation is strictly optional, never
a default path. Verified by diff, not by re-reading intent:

- **`create_market` (on-chain) and `place_bet.rs`: zero-byte diff** — not a single
  line changed by this work.
- **`createMarketForFixture` in `goalana.service.ts`: diff has zero deletions** —
  only the new `createChallengeMarketForFixture` was appended below it.
- **`market.service.ts`, `market-definitions.ts`, `market.cron.ts`** (the cron that
  creates standard + parametric-prop house markets every 10 min): **not touched at
  all** — not even present in `git status`.
- **`createChallengeMarketForFixture` is called from exactly one place**:
  `market-request.service.ts`'s `approveChallengeRequest`, itself only reachable via
  the explicit, admin-secret-gated `POST /api/market-requests/:id/review` endpoint.
  No cron, no discovery loop, nothing automatic ever calls it.
- **Extra sweep (unprompted, same pass):** confirmed a challenge market's
  unrecognized `marketType` string (`CHALLENGE_...`) falls through
  `computeCurrentReferenceProbability`'s switch to its existing `default: return
null` — the same safe path parametric prop markets already use — and through
  `market-groups.ts`'s grouping to `"OTHER"` with a graceful label fallback. No
  crash risk, nothing needed fixing.

**Conclusion: both guarantees hold by construction**, not by after-the-fact patching —
the two features were built as strictly additive/opt-in from the start of this work.

---

## Bottom line for today

**Both #1 and #2 are now live on-chain and click-testable.** #1's new instructions
(`create_challenge_market`, `place_challenge_bet`) are deployed to Devnet at the
same program ID — what's left is exercising them for real (an approved request +
an open fixture), not writing or shipping more code. #2 has no redeploy dependency
at all and was always testable against the live program.

Both are still subordinate to the P0 submission blockers (repo visibility, demo
video link, live app link) — if those aren't closed, close them first. #3–6
remain backlog, not a to-do list for the remaining hours.

**Re-verified this claim directly (2026-07-19, reviewing this doc against the
track brief): the P0 blockers are still open right now.** `gh repo view` reports
the repo visibility as `PRIVATE`, and `README.md:13` still reads
`_[add Loom/YouTube link]_` / `_[add Vercel link]_`. Per the submission
requirements ("Demo Video... Absolute requirement to pass initial screening"),
none of #1–6 in this document matter if these three don't close before
23:59 UTC today.

---

## Reviewer pass — 2026-07-19 (added items #7 and #8, re-checked P0 status)

Reviewed this document against the full TxLINE track brief (track description,
architectural considerations, ideas-to-get-started list, and the judging/
submission-requirements sections) and cross-checked the competitive landscape via
Colosseum Copilot (`search/projects`, `acceleratorOnly`/`winnersOnly` filters,
`search/archives`). Findings:

- **`gh repo view` still reports `PRIVATE`; `README.md:13` still has the placeholder
  demo/app links.** Nothing below changes the verdict two sections up: those three
  P0s gate the entire submission regardless of which feature items are green.
- **The architecture already satisfies the brief's "Custom On-Chain Settlement
  Engines" ask** (CPI into `validate_stat`, see the note under the status table)
  — this is a documentation/demo fix, not a code item, and costs minutes.
- **Added #7 (public settlement proof gallery)** — directly closes the brief's own
  named risk ("there may not be live activity on the project during review") using
  only existing data and an existing component. Ranked above #3–6: same zero-risk/
  low-effort tier as #3, but motivated by a risk the brief states outright rather
  than a nice-to-have. **If there are spare hours after the P0 blockers and after
  exercising #1/#2 live, do this one next.**
- **Added #8 (USDC/SPL-token markets)** — the brief names USDC by example and
  explicitly invites settlement "on other coins than TxLINE"; Goalana is SOL-only
  today (confirmed by direct code read of `place_bet.rs`/`create_market.rs`/
  `state/vault.rs`). Real, brief-named gap — but real Anchor surgery, so it joins
  #4–6 as backlog, not a today item.
- **Landscape re-check found no new competitor angle worth reacting to.** Searched
  builder projects for prediction-market settlement/escrow patterns (general,
  `acceleratorOnly`, and `winnersOnly`); the closest neighbors were Capitola (1st
  place Consumer Apps, C4 accelerator, Cypherpunk — a cross-platform prediction-
  market _aggregator_, a different product shape than Goalana) and Riverboat
  (honorable mention, Breakout — multi-outcome AMM liquidity, not settlement
  design). Nothing in the corpus does user-proposed market design (#1), atomic
  bet slips (#2), or a CPI-verified settlement bounty (#6) — the existing
  uniqueness claims in this document hold up under a fresh check, not just the
  original `v2-todo.md` teardown.
- **#3–8 all remain backlog, not a to-do list for the remaining hours**, until the
  P0 blockers close. That instruction from the prior review pass is unchanged.

---

## Reviewer pass — 2026-07-19 (P0 + #1/#2 assumed closed — recommended build order)

Per the user: treat the P0 blockers (repo public, demo video linked, live app linked)
and the #1/#2 live-verification checklists as **done** for the purpose of this pass.
That removes the "don't touch anything" gate the last two review entries stood on —
here is the ranked build order for whatever hours remain before 23:59 UTC, using the
same uniqueness÷effort÷risk lens as the rest of this document, plus one fresh
landscape check to make sure the ranking still holds.

**Recommended order:**

1. **#7 — Public settlement proof gallery.** Still the top pick: ~2–3h, zero risk,
   pure aggregation over data that already exists, and it directly answers the
   track brief's own stated review-time risk ("there may not be live activity...").
   Do this first — it's the cheapest insurance against the exact failure mode the
   judges were warned about in the brief itself.
2. **#3 — Cross-market liquidity & volume dashboard.** ~2–4h, zero risk, closes the
   one line item the track brief names verbatim ("Prediction Market Viewer") that
   README still marks partial. Do this second — same risk tier as #7, slightly
   more UI work, no other dependency.
3. **#5 — Client-side Merkle re-verification.** ~1d but **spike it first, don't
   commit the day up front** — timebox 1–2h against one real settled proof
   (available now that #1/#2 produced real settlement data). If the hash
   reproduces, this is the highest-ceiling remaining item: it's the literal
   "Experimental Verification Layer" bonus the track brief calls out by name, and
   per the fresh archive check below, trust-minimized resolution is exactly what
   the field is converging on. If the spike fails, drop it — don't burn the day.
4. **#4 — AI Agent API.** ~1d, additive-only REST, no program change. Re-checked
   the landscape for this pass specifically (`acceleratorOnly`/`winnersOnly`
   project search + archive search) — the closest neighbor is Trump.fun
   (Honorable Mention, Gaming track, Breakout Apr 2025), but that's AI-agent-as-
   market-**creator** (scrapes social posts into markets), a different shape from
   Goalana's angle of AI-agent-as-**bettor** via an unsigned-tx-signing API. That
   angle still reads as open. Archive grounding: Galaxy Research's "The Shape of
   Prediction Markets to Come" (2026-02-18) and a16z's "Super Bowl of Prediction
   Markets" (2026-02-06) both frame agentic participants as the near-term growth
   vector for onchain prediction markets — this item is on-thesis, not a stretch.
   Do this if #7/#3/#5 land with time to spare; it's real effort, not a quick win.
5. **#6 — Permissionless settlement bounty.** Real Anchor change to
   `settle_market.rs` (fee-split logic, new tests, payout-math re-audit). Only
   attempt if #1–5 are all done, verified, and there are still hours left — this
   is the kind of change that needs a calm pass, not a rushed one on deadline day.
6. **#8 — USDC/SPL-token markets.** Ranked last on purpose: real, brief-named gap,
   but the biggest single lift (new vault shape, `transfer_checked`, decimal
   handling, full payout-math audit) — a partial or buggy version live on
   submission day is worse than not shipping it. Backlog for post-submission, not
   a deadline-day item even with P0 closed.

**What did not change:** the uniqueness claims for #1, #2, and #6 already survived
a landscape re-check in the prior pass; this pass only added fresh evidence for #4
and reconfirmed #5's framing against the track's named "Experimental Verification
Layer" bonus. No new items were added — #7 and #8 from the prior pass are the full
remaining set.

---

## Progress log — 2026-07-19 (#7, #3, and #5 shipped, per the recommended build order)

Executed the recommended order from the pass above. All three are additive,
read-only, zero-program-change, and typecheck clean (6/6). Lint could not be
run in this environment — `eslint` is declared as a devDependency but the
binary isn't actually installed under `node_modules/.bin` here (`bun install`
reports no changes), which predates this work and is unrelated to it; flagging
honestly rather than claiming a lint pass that didn't happen.

**#7 — Public settlement proof gallery, at `/proofs`:**

- New `GET /api/settlements` (`apps/api/src/index.ts`) — every `Market` row
  with `status: "SETTLED"`, joined to its fixture, ordered by `settledAt`
  desc. Pure read over columns `settlement.service.ts` already writes at
  settle time; no new writes, no on-chain reads.
- **Discovered while building this that the gallery would have shipped
  empty**: no market has actually been settled on-chain yet in this Devnet
  environment (checklist item 2 under Challenge Pools above is still open).
  Rather than ship a gallery that's empty on review day — precisely the
  failure mode this item exists to insure against — the endpoint falls back,
  per closed fixture with no settled market of its own, to the same live
  TxLINE proof preview `settlement-proof-panel.tsx` already renders
  per-fixture (`getSettlementProofPreview` — real signed data from TxLINE,
  no settle tx, same anchored daily-root scheme). Confirmed live: today it
  returns two real previews (England v Argentina, France v Spain).
- Frontend: `app/proofs/page.tsx` — no wallet gate, groups entries by
  fixture, renders the existing `SettlementProofReceipt` component per
  market/preview with a one-line explainer of the CPI-into-`validate_stat`
  architecture (ties into the reviewer's note at the top of this doc).
  Loading/error/empty states match the existing `/fixtures` page style.
- Added "Proofs" to the header nav.

**#3 — Cross-market liquidity dashboard, at `/liquidity`:**

- Extended `GET /api/markets` to also compute each market's *current*
  TxLINE reference probability (`currentYesPct`/`currentNoPct`), identically
  to how `/api/fixtures/:id` and `/api/markets/:marketPda` already do it —
  same `computeCurrentReferenceProbability` call, same `fixture.odds`
  current-state rows, just reused per-market here too. No new data source.
- New `hooks/use-liquidity-data.ts` — mirrors the existing
  `use-inspector-data.ts` pattern (`program.account.market.all()` in one
  batched RPC call, joined against `/api/markets` by PDA) instead of N
  individual `useMarketAccount` polls, so the table stays one round trip
  regardless of market count.
- Frontend: `app/liquidity/page.tsx` — a sortable table (shadcn `Table`)
  of every market: fixture, status, live pool size (SOL), YES/NO split,
  `PoolVsReference`-style divergence badge, and time-to-lock (reusing
  `MarketLockStatus`). Sortable by pool size, divergence, or lock time.
  Header strip shows markets tracked / open count / total SOL staked.
- Added "Liquidity" to the header nav.

**#5 — Client-side Merkle re-verification, at every settlement receipt:**

Spiked first, per the plan above, against the two real proofs #7 surfaced
(England v Argentina, France v Spain) — TxLINE's hash scheme is undocumented
anywhere in this repo (confirmed: `txoracle_mock` is a stub that doesn't
hash anything, `docs/TXLINE.md` doesn't specify it either), so this was pure
reverse-engineering: brute-forced ~5,000 candidate leaf encodings (field
order, width, byte order, domain-separation prefix, hash function) against
the real sibling hashes until the target reproduced bit-for-bit.

**The spike succeeded.** Confirmed formula, reproduced exactly across two
independent fixtures and multiple proof stages:

- Leaf: `sha256(u32_LE(key) ‖ i32_LE(value) ‖ i32_LE(period))` — 12 bytes,
  no domain-separation prefix.
- Node: `sha256(left ‖ right)`, with the sibling's `isRightSibling` flag
  choosing concatenation order.
- Verified stat-leaf → `eventStatRoot` and `eventStatRoot` →
  `eventsSubTreeRoot` for England v Argentina (both stats) and for France v
  Spain's away-goals stat. The third stage (→ anchored daily batch root)
  uses the identical node-combine step but has no independently-stated
  target in the proof payload to check against in this repo, so it isn't
  claimed as verified.
- **One honest edge case found, not hidden**: France v Spain's home-goals
  stat (`value: 0`) did *not* reproduce under this formula — its sibling
  path looks like a placeholder/sentinel encoding (repeating `0xff` bytes),
  suggesting TxLINE encodes zero-valued stats differently. Documented in
  `lib/merkle-verify.ts`; the implementation reports per-stat results
  instead of failing the whole proof over one such leaf.
- Shipped as `apps/web/lib/merkle-verify.ts` (Web Crypto API, no new
  dependency — re-tested the shipped `crypto.subtle` code path directly
  against both real proofs, not just the Node spike script, before wiring
  it in) plus a live verification line in `SettlementProofReceipt`:
  "✓ Independently reproduced in your browser — matches TxLINE's stated
  roots" once the browser's own recomputation lands, with no backend call
  involved in that check. This is the literal "Experimental Verification
  Layer" bonus the track brief names, now real rather than aspirational.

**Verification method for this pass:** typecheck 6/6 clean after every
change; both new pages hit against the actual running dev servers (API +
web, already up from an earlier session) and confirmed rendering — `/proofs`
confirmed non-empty via the live fallback described above, `/liquidity`
confirmed compiling and serving real `/api/markets` data. The Merkle spike
was validated by actually running both the Node prototype and the shipped
browser (`crypto.subtle`) code path against real settlement data fetched
live from the running API, not by inspection alone.
