# Goalana v3 — Final Sprint: Submission Package, Live Settlement, Anchor Fixes

_Written 2026-07-17 (evening). Deadline: **2026-07-19 23:59 UTC** (~2 days)._
_Prior context: [v2-todo.md](./v2-todo.md) — the product wedge (visible, forgery-resistant settlement) is **built and evidenced**. v3 is about not losing with a winning product._

---

## 0. The one rule of this sprint

**The judge can only touch three things: the demo video, the deployed app, and the public repo.**
Every remaining hour goes into those three. No new features unless every P0/P1 below is done.
The brief says the demo video is the _"absolute requirement to pass initial screening"_ and
judging is _"heavily based on the demo video"_ — matches end after the deadline, so the video
carries ~100% of the UX score and most of the functionality score.

**Frozen until the semifinal settles:** the deployed program, the settlement path
(`settle_market.rs`, `txline_cpi.rs`, `txoracle.ts`, `settlement.service.ts`), and the
France v England market state. See §4's redeploy gate.

---

## 1. P0 — Submission blockers (lose-the-hackathon items)

| Done | # | Item | Effort | Notes |
|:---:|---|------|:---:|------|
| ☐ | **P0-1** | **Record the demo video (≤5 min) TODAY — do not wait for the semifinal.** | 0.5d | Script in §5. Everything it needs already exists: live app, proof-preview tab, Proof Integrity tab with the 5 real Devnet txs (genuine accepted / forged reverted), lifecycle timeline, positions page. If the live settlement lands tomorrow, splice/re-record the settle beat — that's a bonus take, **not the plan**. One bad RPC night must not leave us with no video. |
| ☐ | **P0-2** | **Deploy `apps/web` (Vercel) + put the real link in README + submission form.** | 0.25d | "Application Access: a working link" is a hard requirement. Point it at the live API VM; verify `/`, `/fixtures/:id`, `/positions`, wallet connect, and the Proof Integrity tab all work from the public URL, on mobile too (judges click on phones). |
| ☐ | **P0-3** | **Commit + push everything; verify the public repo state.** | 0.25d | ~10 modified files are sitting uncommitted on `production` (odds ordering guard, market indexes migration, chart tooltip fix, activate.ts secret fix…). Judges clone the repo — pushed state must match the demo. Also: confirm the repo is public, the **default branch** shows the current README, and no secrets/`.env.activation.local` are tracked (`git log --diff-filter=A` spot-check). |
| ☐ | **P0-4** | **Kill the README placeholders** (`_[add Loom/YouTube link]_`, `_[add Vercel link]_` — README.md:13). | 5 min | After P0-1/P0-2. A placeholder demo link in the first screenful is the worst possible first impression. |
| ☐ | **P0-5** | **Fill the submission form completely**: repo link, app link, video link, brief technical doc (README covers it — link the TxLINE endpoints table + docs/), and the **TxLINE feedback** section (already written in README — paste it). | 0.25d | The feedback question is a named requirement; ours is specific and credible (CPI byte-layout friction, `GameState` always "scheduled", `period=100` vs docs). Don't leave it generic. |

## 2. P1 — Live-settlement evidence capture (France v England, 2026-07-18 21:00 UTC)

The one genuine end-to-end artifact still missing: a **real Devnet `settle_market` with the CPI-verified proof, followed by a real `claim_winnings`**. Match ends ~23:00 UTC on the 18th → ~24h of slack before the deadline. Plan it like an ops runbook:

| Done | # | Item | Notes |
|:---:|---|------|------|
| ☐ | **P1-1** | **Pre-match checklist (by 20:00 UTC 07-18):** API + crons healthy, keeper wallet funded (>0.1 SOL for fees), RPC endpoint responsive, `/api/health` green, the 5 recreated markets confirmed `OPEN` with keys 1/2, `SETTLE_COMPUTE_UNIT_LIMIT=400_000` in place. | Everything on this list already exists — this is a verification pass, not work. |
| ☐ | **P1-2** | **Watch the settlement fire** (lifecycle cron, kickoff+15min after final). If the cron misses, run `settleOneMarket` manually — the helper was exported for exactly this. Capture: settle tx sig, CU consumed, fee. | If the match goes to ET/pens, `settle_after` may arrive before the final whistle — the `StaleOracleSnapshot` guard makes early attempts revert safely; just let the cron retry. |
| ☐ | **P1-3** | **Run `claim_winnings` live** from the keeper wallet (the `--rebet 0.05` YES bet on HOME_WIN exists for this) — closes the last "localnet-only" gap in the Honest Status paragraph. | If France doesn't win, the keeper bet loses — then demo `claim_refund`/no-winning-stake behavior instead and say so honestly. Either outcome is evidence. |
| ☐ | **P1-4** | **Update README evidence table** with the real settle + claim sigs and the measured CU stat ("settled on-chain in ~XXX,XXX CU"); update the Honest Status paragraph (localnet caveats shrink to zero). | ~30 min. This is the moment the README's story completes. |
| ☐ | **P1-5** | **Splice the real settlement into the demo video** (or record a 30s "and here it is live" addendum — judges accept a two-clip video better than a missing beat). | Only if time permits; P0-1's cut is already submittable. |
| ☐ | **P1-6** | **External bettor's 1.051 SOL refund** on the old cancelled HOME_WIN market: get the wallet to claim it — or **feature it in the demo**: a cancelled market where funds are refundable-not-stuck is escrow-safety evidence, not embarrassment. | Goalana's backend cannot do this on their behalf (by design — say that on camera). |

## 3. P2 — Cheap wins before the deadline (only after P0/P1)

| Done | # | Item | Effort | Why |
|:---:|---|------|:---:|-----|
| ☐ | **P2-1** | **RISKS.md** — content already exists in v2-todo.md's "Remaining risks" + "Known limitation": SSE reconnect has no backoff cap, no per-call RPC retry (cron self-heals), mock oracle scope, house cancel/lock powers (§4 A5), vault dust from floor division, position rent not reclaimable. Add the real CU numbers from the recorded proof-integrity txs. | 0.5h | Honest-scope trust points; Final Whistle / Quovra parity. A judge won't read v2-todo.md. |
| ☐ | **P2-2** | **Headline "permissionless settlement" in README + UI.** `settle_market` takes **no authority signer** — anyone with the genuine TxLINE proof can settle any market (verified: `SettleMarket` accounts = market + oracle program + daily-roots PDA, nothing else). This is the track's literal words — _"a user or keeper bot triggers your contract"_ — and it's currently invisible: README frames settlement as "the backend does it". One README paragraph + a "anyone can settle this market — the keeper is a convenience, not an authority" line on the proof receipt. | 1h | Strongest remaining positioning win, zero code risk. Same for `claim_*`: permissionless, user-pulled. |
| ☐ | **P2-3** | **"Judging-window" note in README + a banner rule in the app**: TxLINE free-tier access ends at the deadline, so during review the health indicator may show red and no new fixtures/odds flow; all proofs, evidence txs, and settled markets are **persisted** and fully inspectable. | 0.5h | Prevents a judge from reading a dead feed as a broken app — the single cheapest misjudgment insurance available. |
| ☐ | **P2-4** | **README screenshots** (home hero, proof receipt, Proof Integrity tab, positions). Quovra-style table, 4 images. | 0.5h | Competitors have them; we have better screens and show none. |
| ☐ | **P2-5** | Verify the **26/26 suite + typecheck still pass** on the final pushed commit (`anchor test`, `bun run typecheck`) so the badges aren't lies on the commit judges clone. | 0.5h | Code Quality is a scored criterion; a broken clone kills it. |

## 4. Anchor program — findings & fixes (from the 2026-07-17 program read)

**🚨 REDEPLOY GATE: no program deploy before the France v England settlement is captured.**
The 5 live markets + the external 1.051 SOL position sit on the deployed program; the headline
evidence event is <24h away. An upgrade the night before is unbounded downside for zero judge-visible
upside — every fix below is classified accordingly.

### A. Safe now (no deploy, or no code at all)

| Done | # | Finding | Fix |
|:---:|---|---------|-----|
| ☐ | **A1** | **`close_bet.rs` is a dead stub** — 5 lines, empty `handle_close_bet()`, **not wired into `lib.rs`**. A judge reading the program hits an instruction that does literally nothing and wonders what else is scaffolding. | Delete the file + its `instructions.rs` export. Repo-only change, deployed program untouched. Verify `anchor build` still passes. |
| ☐ | **A2** | **Permissionless settlement is real but unmarketed** (see P2-2). Also true of `claim_winnings`/`claim_refund` (user-signed pull, no house involvement) — the _only_ house-gated instructions are create/lock/cancel, and that's exactly the "house makes markets, cryptography settles them" story. | README/UI positioning only — this is P2-2. |
| ☐ | **A3** | **House trust surface is honest but undocumented**: `cancel_market` works on Open **and Locked** markets with no time gate — the house can cancel a market seconds before settlement (turning a losing pool into refunds). `lock_market` likewise has no `now >= locks_at` check, so the house could freeze betting early. Neither can steal (funds only ever exit via user-signed claims), but a judge who reads the program will find this in 5 minutes. | **Disclose in RISKS.md now** (A5 content): "the house can cancel/lock, never redirect funds; cancel ⇒ everyone refunds at face value." Honesty beats silence; the on-chain fix is B1/B2. |

### B. Post-settlement upgrades (only if P0–P2 all done AND the settle evidence is captured — realistically 07-19, judge-visible via a fresh deploy tx + README note "hardened after our live settlement")

| Done | # | Finding | Fix |
|:---:|---|---------|-----|
| ☐ | **B1** | `lock_market` is house-only and un-time-gated. | Make it **permissionless + time-gated**: drop the authority account, add `require!(now >= market.locks_at)`. Lock becomes a pure crank anyone can turn — one more "the clock, not the house" beat. (Note: `place_bet` already independently enforces `now < locks_at`, so this is trust-model polish, not a fund-safety fix — which is why it can wait.) |
| ☐ | **B2** | `cancel_market` usable on Locked markets at any time. | Restrict to `status == Open` (pre-kickoff), or add a "not within N minutes of `settle_after`" guard. Smaller cancel powers = smaller RISKS.md. |
| ☐ | **B3** | **Position rent is never reclaimable** — no close instruction exists (that's what `close_bet` was presumably scaffolded for). After claim, ~0.002 SOL stays locked per position forever. | Add `close_position` (`constraint = position.claimed`, `close = user`). Nice-to-have; skip without guilt. |
| ☐ | **B4** | **Vault dust**: floor-division payouts leave residual lamports in the vault with no sweep path; vault also never closes. | Document in RISKS.md (A5) now; a `close_vault` (all positions claimed) is post-hackathon work. |
| ☐ | **B5** | Consistency nit: `lock_market`/`cancel_market` take `market` without re-deriving PDA seeds (bet/claim/settle all do). Safe today — `Account<Market>` enforces owner+discriminator and both are authority-gated — but inconsistent. | Add the `seeds`/`bump` constraints when B1/B2 happen anyway. Not worth a deploy alone. |

**If any B-item ships: rerun `anchor test` (26/26), redeploy to Devnet, re-verify one full read path in the app, and note the upgrade honestly in README.** If in doubt, ship none of them — the program as deployed is already sound (payout math, PDA derivation, state machine, and escrow were audited clean in v2's production pass).

## 5. Demo video script (≤5 min — the single most important artifact)

Target: a judge who has watched 50 identical "TxLINE → escrow → CPI → claim" demos remembers ours because **they watched cryptography, not a claim**.

1. **0:00–0:30 — Problem.** "Every prediction market says 'trustless settlement.' Almost none can show it. Goalana settles World Cup markets with a TxLINE Merkle proof verified _inside the settlement transaction_ — a wrong proof physically cannot move the money."
2. **0:30–1:30 — Live app.** Home hero → a real fixture (live TxLINE scores/odds, movement chart, countdowns) → connect wallet → **place a real devnet bet** → lifecycle timeline shows the tx.
3. **1:30–3:00 — THE WEDGE.** Proof Integrity tab: genuine goals proof **accepted** (Explorer, on camera) → same proof, value forged 1→6 → **`InvalidStatProof`, transaction reverted** (Explorer, on camera) → one sibling-hash byte flipped → **reverted again**. Then: "same engine, corners and cards proofs, identical instruction — this settles _any_ TxLINE statistic."
4. **3:00–4:00 — Settlement receipt.** The three-stage Merkle visualization (stat leaf → event root → subtree → anchored daily root), the `daily_scores_roots` PDA link, and — if P1 landed — the real semifinal `settle_market` tx + `claim_winnings`. Say the CU number out loud.
5. **4:00–4:30 — Trust model.** "Settlement and claims are permissionless — our keeper is a convenience, not an authority. The house can create and cancel markets; it can never decide an outcome or move a coin." Show `/positions` + the cancelled-market refund (P1-6).
6. **4:30–5:00 — Close.** Architecture one-liner, TxLINE endpoints used, 26/26 tests, evidence table, repo/app links.

Record at 1080p+, readable font sizes, wallet with a clean tx history. **Upload unlisted YouTube (Loom links sometimes expire/paywall), test the link logged out.**

## 6. Explicitly NOT doing (unchanged from v2, plus v3 additions)

LMSR/AMM, permissionless creation, leaderboards/social/push/i18n/faucet — **plus (v3):**
Agent API (item 13), Protocol Inspector (item 14), client-side proof re-verification (item 15),
ET/penalty markets (item 17), user-requested markets (item 9). All were real ideas; none are
reachable by a judge who never sees them in a 5-minute video, and every hour they'd take is an
hour off the three things judges _do_ touch.

## 7. Timeline

| When (UTC) | Do |
|---|---|
| **07-17 evening** | P0-3 commit+push → A1 dead-stub delete → P0-2 Vercel deploy → P2-2/P2-3 README positioning → **P0-1 record the video** → P0-4 links. |
| **07-18 day** | P0-5 submission form (video already in hand) → P2-1 RISKS.md → P2-4 screenshots → P1-1 pre-match checklist by 20:00. |
| **07-18 21:00–23:30** | Match. P1-2 settle capture → P1-3 claim_winnings → P1-4 README evidence update. |
| **07-19** | P1-5 video splice → P2-5 final clone-and-verify → optional B-items **only if everything above is green** → final push, final form check, submit **hours before** 23:59, not minutes. |

### Progress log

_(append entries here as items land, v2-style)_
