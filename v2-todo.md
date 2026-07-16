# Goalana v2 — Judge-Lens Competitive Analysis & Roadmap

_Written 2026-07-17. Submission deadline: 2026-07-19 23:59 UTC. ~3 days._
_Track: Prediction Markets & Settlement. Judged **heavily on the demo video** (matches finish after the deadline, so there is little/no live activity during review — the demo must SHOW the full lifecycle)._

---

## 0. The one thing that matters

There will be ~200 submissions and a large cluster of them are **architecturally identical to us**: "TxLINE feed → Solana escrow → keeper CPIs into `validate_stat` → winners claim." GoalChain, GoalLine, Quovra, and Goalana are all that same sentence. Everyone will _claim_ "trustless on-chain settlement."

**The wedge: almost nobody SHOWS it. We will make the settlement visible, inspectable, and verifiable inside the product.** A judge who has watched 50 identical demos remembers the one where they could literally watch a Merkle proof get verified on-chain, see a tampered proof get rejected, and click straight to Explorer at every step.

Everything below is ordered against that single goal: **polished, trustworthy, memorable — not feature-heavy.**

---

## 1. Competitor teardown (judge lens)

### A. Final Whistle Markets (Anuragt1104) — _the docs/rigor benchmark_

**Better than us:** Best documentation in the field (TECHNICAL.md, RISKS.md). Honest "dual-rail, labeled" framing. A **real "tampered proof → CPI reverts → settlement fails" demo** with tx links — this is the single strongest trust artifact any competitor has. Memorable thesis ("Living Market Graph"). Named on-chain evidence table.
**We do better:** Simpler, cleaner scope. Their LMSR/micro-market complexity is a liability under a 5-min demo and "deterministic resolution" scoring; ours is legible. Real World Cup markets, not replay-first.
**Borrow:** (1) the **tampered-proof-reverts evidence** — we already test this on localnet (`StaleOracleSnapshot`, wrong stat key, wrong root); surface it as a headline trust claim + recorded demo beat. (2) A `RISKS.md` that honestly labels fallback modes. (3) Named on-chain evidence table in README.
**Do NOT copy:** LMSR/AMM, micro-markets, "living graph," `?admin=1` replay simulator. Explicit non-goals; huge surface for zero settlement-track credit.

### B. GoalChain (openclaw011) — _the README/evidence benchmark_

**Better than us:** README opens with **"On-Chain Evidence — verify it yourself"** tx table (program, market, real bet, subscription, payout — each an Explorer link). Embedded **YouTube demo thumbnail**. Live backend `/health` showing `txline.scoresConnected: true`. Badges. Numbered "Core Innovation" story.
**We do better:** House-only creation is a cleaner, more honest scope than their loose model. Our monorepo + typed SDK + 26 on-chain tests is higher code quality. Our docs (`docs/`) are audited-not-aspirational.
**Borrow:** the **evidence table**, **demo video front-and-center**, a **`/health` endpoint** that proves the TxLINE stream is live, badges, the numbered innovation narrative.
**Do NOT copy:** nothing harmful; they're our closest twin. Just out-execute on polish + proof visibility.

### C. Quovra (MystiqueMide) — _the positioning benchmark_

**Better than us:** Sharpest one-liner: **"Prediction markets that settle themselves."** Product **screenshot table** (desktop/mobile). **"Why it is different"** comparison table (vs token-vote, off-chain resolver, oracle relay, mock CPI). **Mermaid** architecture diagram. Concrete stat: "settlement consumed ~118k of 1.4M compute." Clean CHANGELOG/CONTRIBUTING/SECURITY.
**We do better:** We have a live match feed, odds movement chart, event timeline, and lifecycle UI they don't foreground. Deeper TxLINE ingestion (SSE odds + scores workers).
**Borrow:** the **tagline**, **screenshots in README**, the **"why different" table**, **mermaid diagram**, the **compute-cost stat** ("our settle_market CPI cost X CU"), CHANGELOG/SECURITY files.
**Do NOT copy:** nothing conflicting.

### D. GoalLine (cool-pythagoras) — _the wow-factor benchmark_

**Better than us:** A **`ProofVisualizer` component that renders the Merkle tree in the UI** — "judges can see the Merkle tree in action." This is the single most demo-friendly idea in the whole field and it maps directly onto the track's **"Verifiable Resolution UI"** + **"Experimental Verification Layer"** bonus. Also a built-in faucet for judges.
**We do better:** Our settlement is actually wired end-to-end with real devnet markets/bets and a 26-test suite; theirs reads more aspirational ("could trigger on-chain settlement when a FT event is received"). Our proof CPI is real and validated.
**Borrow:** **THE VISUAL MERKLE PROOF.** We fetch the exact three-stage proof already (`stat-validation`: statProof → eventStatRoot → subTreeProof → mainTreeProof → daily root). Render it. This is our headline feature.
**Do NOT copy:** their vaguer settlement wiring; SOL faucet isn't needed (we bet native devnet SOL — judges use the standard faucet).

### E. WorldCup PredMarket (neocarvajal) — _the breadth benchmark_

**Better than us:** Portfolio (active/history), in-app + push notifications, live odds with directional arrows, settlement receipt with share-on-X, docs page, faucet. Very polished, broad.
**We do better:** Tighter, settlement-focused scope. They spread across notifications/i18n/push — none of which is what _this track_ scores. Our trust story is clearer.
**Borrow:** (1) a **My Positions / Portfolio** page (wallet-scoped bets + claim actions + tx links) — this is also a track "Prediction Market Viewer" idea. (2) **Directional odds arrows** (▲▼ + %) on markets. (3) A **settlement receipt** artifact.
**Do NOT copy:** push notifications, service workers, i18n, match-watcher, SOL/token faucet, share-on-X. Generic consumer-app surface, not settlement differentiation, and a 3-day time sink.

---

## 2. Where Goalana stands today (honest audit)

**Strengths (keep, don't touch):** real Devnet lifecycle with tx evidence in `todo.md`; house-only creation (deliberate, correct scope); pari-mutuel pools (legible, deterministic); real TxLINE SSE odds+scores ingestion; odds movement chart; live score header; match event timeline; lifecycle status strip; on-chain settlement via CPI with a 26/26 localnet suite; per-session tx history with Explorer links; typed SDK; audited docs.

**Gaps that cost us judging points:**

1. **The settlement proof is invisible.** It's a 3-line text panel. Our single biggest differentiator is buried. (← fix first)
2. **Home page reads as broken/placeholder.** Every card shows a hardcoded `0`–`0` score even for non-live matches, and there's **no hero explaining what Goalana is or why it's trustless**. Terrible first impression for a judge landing cold.
3. **No "verify it yourself" evidence in the README or UI.** All our real tx signatures sit in `todo.md` where a judge never looks.
4. **No My Positions / activity view.** A judge who places a demo bet can't see a clean record of "my bets + their on-chain proofs."
5. **README is thin** vs. every competitor: no evidence table, no demo video, no diagram, no tagline, no screenshots, no badges.
6. Only 6 markets, all full-time. Fine, but "more markets" is a visible-depth lever if cheap.

---

## 3. Prioritized roadmap (impact per engineering hour)

Ordered by **(impact ÷ effort)**, then risk. Effort in half-days. All fit the 3-day window and Goalana's existing architecture (no protocol redesign).

| Done | # | Item | Impact | Effort | Risk | Why |
|:---:|---|------|--------|--------|------|-----|
| ✅ | **1** | **Visual Merkle proof receipt** (settlement panel → full proof-chain visualization: stat leaf → eventStatRoot → subtree → main tree → anchored daily root, with CPI tx + `daily_scores_roots` PDA + `validate_stat` links, "verified on-chain, not by our backend" badge) | 🔥🔥🔥 | 1.5d | Low | THE wedge. Beats GoalLine at their own headline. Directly hits the bonus criteria. Uses proof data we already fetch. |
| ✅ | **2** | **Home landing hero + kill the fake `0-0` cards** (thesis line, compact how-it-works lifecycle, real evidence links; show live score only when actually live, else kickoff time) | 🔥🔥🔥 | 0.5d | Low | First impression. Currently looks broken. Cheapest big win. |
| ✅ | **3** | **README overhaul** (tagline, badges, On-Chain Evidence "verify it yourself" table from `todo.md` txs, mermaid architecture + lifecycle diagrams, demo video slot, screenshots, TxLINE endpoints table, feedback section) | 🔥🔥🔥 | 0.5d | None | Docs are a scored criterion and shape the demo. Pure surfacing of things we already have. |
| ✅ | **1b** | **🚨 Stat-key correctness fix + conclusive validation** (SDK `HOME_GOALS/AWAY_GOALS` 7/8→1/2; triangulated across every completed fixture) — emerged while building #1; gates the France v England recreate | 🔥🔥🔥 | 0.5d | Med | Without it, every live settlement resolves on **corners**, not goals — fatal to the whole trust story. |
| ✅ | **5** | **Lifecycle theater on the market card** (tx link at every transition: create → bet → lock → settle → claim; "tampered proof rejected" trust callout) | 🔥🔥 | 0.5d | Low | Makes the trustless claim tangible per-market. Reuses Explorer helpers. |
| ☐ | **1c** | **Execute France v England cancel → recreate** (dry-run script ready; needs user go — touches a real external bet) | 🔥🔥🔥 | 0.25d | Med | Makes the genuine on-chain settlement (2026-07-18) resolve on goals, not corners. |
| ☐ | **4** | **My Positions page** (`/positions`, wallet-scoped: each bet's market, side, stake, status, claim action, tx links) | 🔥🔥 | 1d | Med | Track "Prediction Market Viewer." Lets a judge replay their own bet with proof. |
| ☐ | **6** | **`/health` + status endpoint surfaced** (TxLINE stream connected, last event ts, tracked fixtures) + a tiny "feed live" indicator in the header | 🔥 | 0.5d | Low | Proves the pipeline is live even when matches aren't. GoalChain-style trust. |
| ☐ | **7** | **Directional odds arrows** (▲▼ + % since open) on market cards | 🔥 | 0.5d | Low | Cheap polish; we already store odds history. |
| ☐ | **8** | **RISKS.md + tampered-proof evidence writeup + compute-cost stat** | 🔥 | 0.5d | None | Honest-scope trust points; Quovra/FWM parity. |
| ☐ | 9 | **User-requested markets (house-verified queue)** — users submit a market request; house reviews + signs `create_market`. Keeps house-only on-chain model. | 🔥 | 1.5d | Med | User asked for it. Fits the model (house still signs). Lower priority: backend + moderation surface, not settlement-differentiating. |
| ☐ | 10 | **More markets** (BTTS / first-scorer / extra O/U lines) — only if TxLINE prices them and matchers + settlement path already generalize | 🔥 | 1d | Med | Visible depth, but risks the settlement path; only if 1–8 done. |
| | | _— new bets (2026-07-17 idea pass; full reasoning in §5) —_ | | | | |
| ☐ | **11** | **Parametric prop markets (corners / cards) via the SAME proof engine** — "Total corners > 9.5", "Total cards > 3.5" settle on keys 7/8 & 3/4 (both just validated) with the identical add+greaterThan predicate | 🔥🔥🔥 | 0.5d | **Low** | Track *explicitly* suggests prop bets ("Team A + Team B corners > 10"). Proves our settlement engine generalizes to ANY TxLINE stat, not just goals. Low risk — keys verified, same code path. **Top new pick.** |
| ☐ | **12** | **Live tampered-proof rejection demo** — one-click "settle with a mutated proof → `validate_stat` CPI reverts" on Devnet, failed-tx + logs shown in UI | 🔥🔥🔥 | 0.75d | Med | The single strongest trust artifact in the field (Final Whistle has it). Directly hits the track's **custom-check-gate bonus**. We already prove it 26/26 on localnet — surface it as a real failed Devnet tx. **Top new pick.** |
| ☐ | **13** | **AI-Agent API** (discover markets, read positions, build unsigned bet/claim txs, `llm.txt`/OpenAPI) | 🔥🔥 | 1d | Low-Med | The track **explicitly names AI agents** as eligible builders — almost nobody will do this. "Agent-native prediction market" is a distinctive second wedge. Mostly additive REST + docs. |
| ☐ | **14** | **Protocol Inspector page** (`/inspector`) — live on-chain state: config PDA, every Market (status/predicate/pools/settle_after), vault balances, the anchored `daily_scores_roots` freshness | 🔥🔥 | 1d | Low | A mini block-explorer scoped to Goalana = "verify the whole protocol yourself." Strong verifier trust artifact, pure on-chain reads. |
| ☐ | **15** | **Client-side proof re-verification** — recompute the Merkle root in the browser from leaf+siblings, show "✓ matches the on-chain anchored root" | 🔥🔥 | 1d | **High** | The ultimate "don't trust us" moment + track's Experimental-Verification bonus. Gated on exactly matching TxLINE's hash algorithm — **spike it first**, ship only if the root reproduces. Stretch. |
| ☐ | **16** | **Countdown / protocol-time UI** — live countdown to lock (kickoff) and to `settle_after` on each market, reinforcing the time-gated automatic lifecycle | 🔥 | 0.5d | Low | Cheap polish; we already store `locksAt`/`settleAfter`. Makes "automatic lifecycle" tangible. |
| ⏸ | **17** | **Extra-Time / Penalty markets** — DEFER | 🔥 | 1d | High | Thematically perfect for knockouts, BUT needs a *non-full-match period* stat proof, and real proofs return `period=100` (not the doc's 0–5) — period semantics are **unverified** and TxLINE may not price ET/pen odds. Verify period handling in `settle_market` first; skip otherwise. |

**Explicitly NOT doing** (per constraints + judge lens): LMSR/AMM, micro/living-graph markets, permissionless on-chain creation, leaderboards, social, auth systems, push/i18n/faucet/match-watcher, any protocol redesign.

---

## 4. Execution order (this pass)

Do the three lowest-risk, highest-first-impression items, then the wedge:

1. **#2 Home hero + fix fake scores** — fastest visible polish. ✅ start here
2. **#3 README overhaul** — pure surfacing, no code risk.
3. **#1 Visual Merkle proof receipt** — the memorable differentiator (needs backend to expose the stat-validation proof for a settled market; check `settlement.service.ts` for what's already fetched/stored).
4. Then #5 lifecycle tx links, #4 positions, #6 health, #7 arrows as time allows.

Progress is tracked inline below as each item lands.

### Progress log

- **2026-07-17 — #2 Home hero + fake-score fix DONE.** Added `apps/web/lib/protocol.ts` (program IDs, trust statement, lifecycle steps). Rebuilt `apps/web/app/page.tsx`: hero (thesis, program-verify link, 5-step how-it-works with the Settle step highlighted as the trust moment) + cards now show a real live/final scoreline only when the feed has one (`homeScore`/`awayScore` + live/final gate, home/away oriented by `participant1IsHome`) instead of a hardcoded 0–0. Typecheck 6/6.
- **2026-07-17 — #3 README overhaul DONE.** Submission-grade README: tagline, badges, demo/live/program links, "Why different" table, mermaid lifecycle diagram, **On-Chain Evidence table** (real Devnet program/market/bet/vault txs from `todo.md`), TxLINE endpoints table, honest localnet-vs-devnet status labelling, testing/evidence section, TxLINE feedback. Fixed the `<add…>` HTML-parse placeholders. _Judge must still paste the real demo-video + Vercel links._
- **2026-07-17 — #1 Visual Merkle proof receipt DONE (backend + frontend, typecheck 6/6).**
  - _Why persist vs. re-fetch:_ TxLINE free-tier access ends 2026-07-19 (the deadline), so an on-demand proof fetch could fail mid-judging. A persisted proof always renders. Chose persistence.
  - **Backend:** added nullable `Market.settlementProof Json?` (migration `20260716195506_add_settlement_proof`, applied to Neon + client regenerated). `settlement.service.ts` now builds a display-friendly record on settle (`buildSettlementProofRecord`): hex-encoded roots/hashes, sibling directions, the anchored `daily_scores_roots` PDA, resolved outcome, and the decoded stat(s). Flows through `GET /api/fixtures/:id` automatically (scalar field).
  - **Frontend:** `components/fixtures/settlement-proof-receipt.tsx` renders the three-stage chain (stat leaf → eventStatRoot → events-subtree root → anchored daily batch root), each stage showing the Merkle path siblings with L/R direction; header states "verified on-chain via CPI, not by Goalana's backend"; links to the settle tx, daily-roots PDA, oracle program, and market account; decodes stat keys to human labels (Home goals / Full match = 2). Wired into the market card, replacing the 3-line text panel, with a graceful fallback for markets settled before proof-retention shipped.
  - **⚠️ Demo-robustness gap:** no market has settled on Devnet yet, so `settlementProof` is null everywhere and the visualizer won't render in the live app until France v England settles (2026-07-18, auto via the lifecycle cron) OR a real proof is seeded. **Follow-up:** a one-off script that fetches a genuine `stat-validation` proof for an already-finished fixture and stores it on a settled market — both validates `buildSettlementProofRecord` against real data now and guarantees the receipt is demoable even if live settlement slips. Localnet settle populates it too but in a separate DB.

- **2026-07-17 — 🚨 CRITICAL BUG FOUND & FIXED: settlement was proving CORNERS, not goals.** While building the proof preview, the real TxLINE proof for France 0–2 Spain came back with the wrong stat: `packages/goalana-sdk/src/txline-stats.ts` defined `HOME_GOALS: 7, AWAY_GOALS: 8`, but a live probe proved keys **7/8 = corners** (7/1) and keys **1/2 = goals** (0/2, matching the actual scoreline; keys 3/4 = yellow cards 2/1). Fixed to `HOME_GOALS: 1, AWAY_GOALS: 2` (matches TXLINE_ENDPOINTS.md, which the SDK contradicted). The 26/26 localnet suite never caught this — it uses a mock oracle, so real key semantics were never exercised. **Every market predicate uses these keys**, so before the fix any live settlement would have resolved on corners.
  - **⚠️ TIME-SENSITIVE ON-CHAIN CONSEQUENCE:** the 5 France v England markets already created on Devnet (+ the real 0.05 SOL bet) were created with the **old 7/8 keys baked immutably into their Market accounts** — they will settle on **corners**, not goals, when the match finishes 2026-07-18. To get a *correct* genuine settlement artifact they must be **cancelled + recreated** with the fixed keys before kickoff (cancel_market is unconditional; the bet becomes claim_refund-able). **This is a required user decision — not done unilaterally because it touches a real positioned market + a real bet the day before the match.**
- **2026-07-17 — 🥇 Priority 1 (proof seeding) DELIVERED via a better route than seeding.**
  - _Dead end discovered:_ can't create+settle a market on an already-finished fixture — the program enforces `locks_at > now` AND `settle_after > locks_at` (create_market.rs:72-74), but a finished match's proof timestamp is in the *past*, so `settle_after` (forced future) can never satisfy the on-chain `oracle_ts >= settle_after` check. **The program deliberately forbids settling a match that ended before its market existed.** A genuine on-chain settle is only possible on a fixture that finishes *after* creation (France v England, 2026-07-18 — already positioned).
  - _What shipped instead (honest, real data, demoable TODAY):_ `GET /api/fixtures/:id/proof-preview` fetches the **real** TxLINE Merkle proof for any finished fixture (total goals ≷ 1.5) and returns it in the receipt shape — no fake settle tx. Frontend: a new **"Settlement Proof" tab** on the fixture page (`settlement-proof-panel.tsx`) renders the full three-stage Merkle visualization via `SettlementProofReceipt` in `mode="preview"`. Verified live: France v Spain → 0/2 goals → over-1.5 YES; England v Argentina → 1/2 → YES, both with genuine 5-node stat proofs + anchored daily-roots PDA. This **guarantees the headline visualization is in the demo** regardless of whether France v England finishes in the window. When it does settle, the market card also shows its own persisted receipt with a real `settle_market` tx.
  - Added `placeBetOnChain` / `claimWinningsOnChain` / exported `settleOneMarket` (server-side helpers) — kept for scripted end-to-end validation when France v England settles (also closes the `claim_winnings`-on-Devnet gap from `todo.md`).
- **2026-07-17 — 🥈 Priority 2 (lifecycle tx links) DONE.**
  - **Schema:** migration `20260716201322_add_lifecycle_transitions` added `Market.lockTx / lockedAt / settledAt` (create tx/time + settle tx already existed). `lock.service.ts` now persists lockTx+lockedAt; `settlement.service.ts` persists settledAt. All flow through `GET /api/fixtures/:id` (verified live).
  - **Frontend:** `market-lifecycle-timeline.tsx` — a collapsible **Create → Bet → Lock → Settle → Claim** vertical timeline in each market card. Protocol stages (create/lock/settle) come from the market record; the wallet's Bet/Claim come from the session's signed txs. Each stage shows status (done/pending/n·a), timestamp, and an Explorer tx link. Replaces the old flat "This session" list.
  - Typecheck 6/6 throughout; both running dev services healthy; pages 200.

## Stat-key validation & France v England recreate (2026-07-17)

### Validation — CONCLUSIVE ✅

Ran `apps/api/src/scripts/verify-stat-keys.ts` (retained diagnostic) over **every completed fixture** (only 2 exist in the current free-tier bundle — the finished 2026 WC semis), triangulating **3 independent sources** at final seq: (A) Goalana's DB score, (B) the raw TxLINE `Stats` composite-key map on the highest-Seq snapshot record, (C) the `stat-validation` endpoint value.

- [x] **HOME_GOALS = stat key 1, AWAY_GOALS = stat key 2** — confirmed on every fixture.
- [x] Cross-checked returned values against the official (TxLINE-derived) scores.
- [x] Keys **7/8 are corners** (not goals) — consistently different from the scoreline.
- [x] Evidence documented (below).

**Evidence:**

| Fixture | Match (final) | Official goals (H/A) | `Stats` 1/2 | stat-valid k1/k2 | k3/k4 (yellows) | k7/k8 (corners) | Goals=1/2? |
|---|---|:---:|:---:|:---:|:---:|:---:|:---:|
| 18237038 | France 0–2 Spain | 0 / 2 | 0 / 2 | 0 / 2 | 2 / 1 | 7 / 1 | ✅ |
| 18241006 | England 1–2 Argentina | 1 / 2 | 1 / 2 | 1 / 2 | 1 / 3 | 1 / 6 | ✅ |

_Verdict from the script: "HOME_GOALS = key 1, AWAY_GOALS = key 2 confirmed on every fixture: ✅ CONCLUSIVE / keys 7/8 are a different statistic (corners), never goals: ✅ yes."_ Only 2 completed fixtures were available (not the requested 5) — the triangulation compensates for the small sample. Orientation is also safe: 1X2 markets are labelled by **participant1** ("Will France win"), and the predicate proves `key1 − key2` (participant1 − participant2), so key1 = participant1's goals makes them self-consistent regardless of physical home/away.

- [x] **SDK fix applied:** `packages/goalana-sdk/src/txline-stats.ts` → `HOME_GOALS: 1, AWAY_GOALS: 2`. New markets now get correct predicates; the live proof preview already proves goals correctly.

### Cancel → recreate plan (France v England, fixture 18257865)

Dry-run script ready: `apps/api/src/scripts/recreate-france-england-markets.ts` (dry-run by default; `--execute` to apply; `--rebet <SOL>` optionally repopulates a keeper YES bet on the new HOME_WIN). Confirmed state: all **5 markets Open**, all with **wrong predicate keys A:7 B:8 (corners)**; keeper wallet `B9cWHC…gNPar` holds **no positions**.

Per-market plan (metadata preserved verbatim; only predicate keys change → new PDA):

| Market | Old PDA | Pool | Action |
|---|---|:---:|---|
| FULL_TIME_HOME_WIN | `GRzRon4…mTwfz` | **0.051 SOL** (external bettor) | cancel → recreate (keys 1/2) · **bettor must refund** |
| FULL_TIME_DRAW | `AuVam6D…cZHbs` | 0 | cancel → recreate |
| FULL_TIME_AWAY_WIN | `BEGo5bb…EQ948` | 0 | cancel → recreate |
| FULL_TIME_OVER_1_5 | `C4ZmEJg…DLo5F` | 0 | cancel → recreate |
| FULL_TIME_OVER_3_5 | `XtHHXLN…u3gcd` | 0 | cancel → recreate |

**Preserved unchanged:** `marketType`, `question`, `locksAt` (2026-07-18T21:00Z kickoff), `settleAfter` (kickoff+15min), `initialYesPct/NoPct`, `sourceOddsMessageId`. **Changed:** predicate stat keys 7/8 → 1/2 (⇒ new `predicateHash` ⇒ new Market PDA).

**Required USER actions:**
- [ ] **Refund the 0.05 SOL test bet.** It's on the OLD HOME_WIN market from an **external wallet** (not the keeper). After cancellation, that wallet must call **claim_refund** — in the app: open the fixture → the cancelled HOME_WIN card shows a **Claim Refund** button. The keeper cannot do this on their behalf.
- [ ] **Re-place the demo bet (optional).** The bet does **not** carry to the new HOME_WIN PDA. To keep the demo populated, either re-bet from the same wallet in the UI, or run the recreate with `--rebet 0.05` (keeper wallet) — the latter also lets `claim_winnings` be validated live on Devnet when the match settles.

**Execution gate:**
- [ ] **Run `--execute`** — held for explicit user go: it cancels a live, externally-positioned market the day before kickoff (irreversible). Say the word and I'll run it (optionally with `--rebet`).

## 5. Idea evaluation & new bets (2026-07-17)

Judge-lens verdict on the four proposed ideas + proof-leverage ideas of my own. Ranked by **impact ÷ effort ÷ risk** within the remaining ~2 days.

### The proposed four

**① Extra-Time / Penalty auto-markets — ⏸ DEFER (item 17).** Thematically ideal (the WC is at the knockout stage — matches *can* go to ET/pens). But two unknowns make it risky in a 3-day window: (a) the real proof for full-match goals came back with `period=100`, **not** the doc's `0` — so TxLINE's `period` field semantics are not what we assumed, and an ET/penalty market needs a *different-period* stat proof that `settle_market` has never been exercised against; (b) TxLINE likely doesn't price ET/penalty odds, and market creation is odds-gated. **Verdict:** only pursue after a spike that proves a non-full-match-period proof settles on-chain. Not worth risking the settlement path pre-deadline.

**② AI-Agent API — ✅ ADD (item 13).** Strong and distinctive. The track brief **explicitly lists "AI agents" as eligible builders**, yet almost no submission will lean into it. "Agent-native, permissionless prediction market" is a genuine second wedge next to the proof visualizer. Scope that fits the model: read endpoints (`GET /markets`, `GET /positions/:wallet`) are trivial (we have the data); for betting/claims, expose **unsigned-transaction builder** endpoints (`POST /markets/:id/bet-tx` → serialized tx the agent signs) so we never custody agent keys — consistent with house-only creation but permissionless participation. Ship with an `llm.txt`/OpenAPI descriptor so an agent can self-discover. Mostly additive; no protocol change.

**③ Countdown / protocol-time UI — ✅ ADD (item 16).** Cheap, honest polish. We already store `locksAt` + `settleAfter`; a live countdown to *lock* (kickoff) and *settle-after* makes the **time-gated automatic lifecycle** visible and reinforces "this settles itself." Low effort, low risk. Good demo texture, not a headline.

**④ Protocol Inspector — ✅ ADD (item 14).** A mini block-explorer scoped to Goalana: config PDA, every Market account (status, predicate-in-plain-English, YES/NO pools, `settle_after`), vault balances, and the **anchored `daily_scores_roots` freshness**. This is a serious trust artifact — "don't take our word, inspect the entire protocol state live" — and it's pure on-chain reads (low risk). Pairs perfectly with the proof receipt: receipt proves *one* settlement; the inspector proves the *whole system*.

### My additions — squeezing more out of the TxLINE proofs

**⑤ Parametric prop markets (corners / cards) — ✅ ADD, TOP PICK (item 11).** The stat-key validation we just did **unlocked this for free.** We now know keys 7/8 = corners and 3/4 = cards, verified at full-match against real fixtures. A "Total corners > 9.5" or "Total cards > 3.5" market uses the **identical** `add + greaterThan` predicate and the **identical** settlement CPI — only the stat keys differ. So this is **low-risk, high-signal**: it (a) directly answers the track's own suggested idea ("Parametric Sports Insurance & Prop Bets… Team A Corners + Team B Corners > 10"), and (b) demonstrates that our settlement engine is **stat-agnostic** — the strongest possible rebuttal to "it's just a goals oracle." One afternoon of work turns "we settle match results" into "we trustlessly settle *any* TxLINE statistic." This is the highest-leverage new idea.

**⑥ Live tampered-proof rejection demo — ✅ ADD, TOP PICK (item 12).** The single most persuasive trust artifact any competitor has (Final Whistle's tampered-proof revert). We already prove it 26/26 on localnet (`StaleOracleSnapshot`, wrong stat key, wrong root). Surface it as a **real failed Devnet transaction**: submit `settle_market` with a mutated goals value, capture the `validate_stat` CPI revert + program logs, and show it in the UI ("Proof integrity: tampered value → CPI failed → settlement reverted") with the failed-tx Explorer link. This *is* the track's "custom check gate" bonus, shown rather than claimed. Turns an abstract security property into a visceral demo beat.

**⑦ Client-side proof re-verification — ⚠️ STRETCH (item 15).** The ultimate "don't trust us": recompute the Merkle root in the browser from the leaf + sibling hashes we already render, and show "✓ reproduces the on-chain anchored root." This maxes out the track's *Experimental Verification Layer* bonus. The catch is exactly matching TxLINE's hashing (algorithm + leaf/node domain separation + byte order). **Spike it first** — if the root reproduces from one real proof, ship it; if not, don't burn time. High upside, high uncertainty.

**⑧ Settlement compute-cost stat — ✅ CHEAP ADD (fold into item 8 / the receipt).** Quovra flexes "118k of 1.4M compute." Capture our `settle_market` CPI's actual compute units + fee and print it on the proof receipt / README ("verified on-chain in ~X CU, Y lamports"). A concrete efficiency/trust number for ~15 minutes of work.

### Recommended sequence (remaining window)

1. **Item 11 (prop markets)** — highest leverage, lowest risk, unlocked by today's validation.
2. **Item 12 (tampered-proof demo)** — headline trust beat for the video.
3. **Item 14 (Protocol Inspector)** *or* **Item 13 (Agent API)** — pick one as the "distinctive second wedge" based on whether the demo audience skews verifier (Inspector) or ecosystem/agents (API).
4. **Item 16 (countdown)** + **⑧ (compute stat)** — cheap polish to fill gaps.
5. **Item 15 (client-side verify)** only if a quick hash-matching spike succeeds.

_None of these require protocol redesign; 11/12/16/⑧ reuse the existing settlement path directly._

## Remaining roadmap (next passes)

- **#5 Per-market lifecycle tx links** — surface create/lock/settle tx at each transition on the card (creation tx already stored; lock tx not persisted yet).
- **#4 My Positions page** (`/positions`, wallet-scoped bets + claim + tx links).
- **#6 `/health` indicator** in the header (TxLINE stream connected, last event ts).
- **#7 Directional odds arrows** on market cards.
- **#8 RISKS.md** + tampered-proof-rejection writeup + `settle_market` compute-unit stat.
- **#9 (opt) User-requested markets** — house-verified queue (user asked; fits house-only model).
