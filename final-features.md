# Goalana — Final Features Shortlist (top 5, judge-lens)

_Written 2026-07-19 (deadline day, 23:59 UTC). Read this against `v3-todo.md` §0's
rule: the judge only touches the demo video, the deployed app, and the repo._

Ranked by **uniqueness ÷ effort ÷ risk**, not raw impact — the goal is "a judge who
has watched 50 identical TxLINE-escrow-CPI demos remembers this one for a _new_
reason," same bar `v2-todo.md` used for the proof-visualizer wedge.

## Status at a glance

| #   | Item                                                             |                  Status                  | Green tick needs                                                                         |
| --- | ---------------------------------------------------------------- | :--------------------------------------: | ---------------------------------------------------------------------------------------- |
| 1   | Challenge Pools (user-proposed, house-signed, on-chain enforced) |    🚧 Code-complete, **not deployed**    | Devnet redeploy (holds the upgrade authority, ready) → one live approve→create→bet cycle |
| 2   | Atomic bet slip (multi-bet, one signature)                       | 🚧 Code-complete, **browser-unverified** | One real click-test: stage 2+ bets, submit, confirm a single wallet popup + one tx sig   |
| 3   | AI Agent API                                                     |              ☐ Not started               | Not attempted — see effort/status below                                                  |
| 4   | Client-side Merkle re-verification                               |              ☐ Not started               | Needs a hash-matching spike before any commitment                                        |
| 5   | Permissionless settlement bounty                                 |              ☐ Not started               | Needs its own design pass (fee source, cap, anti-spam) before writing code               |

Legend: ✅ done and verified live · 🚧 built, one concrete step from done · ☐ not started.

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

**Status: 🚧 code-complete, not deployed.** DB/API/frontend done and verified live
against the running API. Program-level enforcement (`create_challenge_market` +
`place_challenge_bet` + `ChallengePool` account) written, Anchor suite 33/33,
monorepo typecheck 6/6, lint 0 errors. See the two progress-log entries below for
the full build record.

**To get the green tick (in order):**
1. **Devnet redeploy** — the new instructions exist in code but aren't callable
   on-chain until the program is upgraded. Upgrade authority (`goalana-prod-authority.json`)
   confirmed matching, fee payer has 3.26 SOL on Devnet — held for your explicit go.
   Mechanically: extend ProgramData ~72KB, then upgrade.
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

## 3. AI Agent API (unsigned-transaction builder + `llm.txt`) ☐

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

## 4. Client-side Merkle proof re-verification ("don't trust us") ☐

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

## 5. Permissionless settlement bounty (small crank incentive) ☐

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
errors. **Not yet redeployed to Devnet** — held for explicit go (the one
irreversible step).

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

**#2 has no redeploy dependency** and can be click-tested against the currently
live program right now. **#1 is code-complete and tested (33/33) but needs the
Devnet redeploy** before any of it is callable on-chain or demoable — that step is
being held for explicit go, not because anything is wrong with it.

Both are still subordinate to the P0 submission blockers (repo visibility, demo
video link, live app link) — if those aren't closed, close them first. #3–5
remain backlog, not a to-do list for the remaining hours.
