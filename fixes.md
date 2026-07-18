# Goalana — Code fixes before v1 deployment

Code-only pass, 2026-07-18. Docs/video/submission-form work is tracked separately
in `v3-todo.md` and deliberately **not** repeated here. This file only covers
things that could actually break behavior or fail the track's judging criteria
(Core Functionality / Code Quality & Logic / deterministic resolution) — read
directly from the Anchor instructions and the API route list, not carried over
from prior audits.

Legend: 🔴 must fix/verify before deploying · 🟡 verify (code already looks
correct, confirm with a real run) · 🟢 audited this pass, no action · ⏸ real
fix, correctly held behind the redeploy gate (see `v3-todo.md` §4).

---

## 🔴 Must fix / verify before deploying

### 1. CORS origin depends on an env var the API deployment may not have set — ✅ FIXED 2026-07-18

`apps/api/src/index.ts:66`:

```ts
const frontendUrl = process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000";
app.use(cors({ origin: frontendUrl }));
```

This changed from the previously-unused `FRONTEND_URL` to `NEXT_PUBLIC_SITE_URL`
in the last round of commits (`64e6664`). `NEXT_PUBLIC_*` is a Next.js
build-time-inlining convention — it reads as a **frontend** var, and
`.env.production.example`'s comment for it (lines 10-13) only talks about
`next.config.ts`'s rewrite destination, never mentioning that the **API**
process also consumes it for CORS.

**Failure mode if missed:** the API falls back to `http://localhost:3000`,
which will never match the real deployed frontend origin. Every
wallet-connect / place-bet / claim request from the deployed app gets
silently blocked by CORS in the browser console — the app will look
completely broken to a tester, in a way that has nothing to do with TxLINE
being live or dead.

**Fix applied:** `apps/api/src/index.ts` — added `NEXT_PUBLIC_SITE_URL` to the
existing `requiredEnv` fail-fast list (same pattern already used for
`TXLINE_API_ORIGIN`) and removed the silent `|| "http://localhost:3000"`
fallback on the CORS origin. A deployment that forgets to set it now refuses
to boot instead of booting and quietly blocking every cross-origin request
in a judge's browser with no server-side signal.

**Verified, not just typechecked:** `bun run --filter=api typecheck` clean.
The already-running local `bun --watch` dev process picked up the change
live and stayed up (proving `NEXT_PUBLIC_SITE_URL` is genuinely present
locally and the new required-env check passes), and
`curl -H "Origin: http://example.com" .../api/health` shows
`Access-Control-Allow-Origin: http://localhost:3000` — the real configured
value, not a hardcoded default. Still needs the one thing no local test can
cover: confirm the var is actually set to the real deployed frontend origin
on the **deployed API's** environment specifically (not just the frontend's
build env) before going live — if it's missing there, the app now fails to
boot at all rather than serving broken CORS, which is a much louder and
easier failure to catch during deploy.

---

## 🟡 Verify before deploying (code already looks correct — confirm, don't assume)

### 2. TxLINE-outage resilience — traced, not yet run for real

Two places make a **live** TxLINE call on a request path a tester can hit
directly (not cron-populated DB reads):

- `GET /api/fixtures/:id/proof-preview` (`apps/api/src/index.ts:416`)
- called only from `SettlementProofPanel` (`apps/web/components/fixtures/settlement-proof-panel.tsx`)

Traced both: the panel wraps the call in `.catch(() => setState("empty"))` —
a TxLINE failure renders an empty-state message, not a crash. `server-api.ts`'s
`fetchApi()` (used for share-page metadata) also never throws — a fetch
failure falls back to `null` and generic metadata. Both are resilient
**by construction**. Given judges will likely be reviewing after the TxLINE
free-tier token expires (§ Core Functionality criterion explicitly allows
"live or simulated" feeds — this is the expected case, not an edge case),
this is worth one real end-to-end check before deploying: point
`TXLINE_API_TOKEN`/`TXLINE_JWT` at something invalid (or wait for the real
expiry) and click through `/`, `/fixtures/:id` (all tabs), `/positions`,
`/inspector`, and the new `/market/:id` / `/share/*` pages. Confirmed
correct by reading; not yet confirmed by running.

### 3. `.env.production.example` still references deleted code

Lines 59-61 document a `COMPETITION_ID` override against `competition.ts` —
that file was deleted in `869f520` (the multi-competition hedge revert).
Not a runtime bug (it's a commented-out example line, nothing reads it), but
worth a one-line delete so the next person deploying doesn't go looking for
a file that no longer exists.

---

## 🟢 Audited this pass — no code change needed

Read every instruction handler end to end looking for correctness bugs, not
just re-confirming prior audits:

- **`place_bet.rs`** — zero-stake guard (`require!(amount > 0, InvalidBetAmount)`,
  line 52) **is present and correct**. `todo.md`'s old note that this is
  "code-inspection only, not re-attempted" is about it never being fired as a
  live Devnet transaction — the check itself is sound and already covered by
  the localnet suite. No fix needed, just a stale caveat in `todo.md` (left
  alone per this file's docs-only scope note above).
- **`claim_winnings.rs` / `claim_refund.rs`** — u128 intermediate payout math,
  checked arithmetic throughout, vault rent-exempt reserve protected before
  every transfer, double-claim guarded via `!position.claimed`. No issues.
- **`create_market.rs`** — predicate hash is recomputed on-chain and compared
  against the client-supplied hash (can't submit a mismatched predicate);
  `locks_at > now` and `settle_after > locks_at` are both enforced; duplicate
  markets are prevented structurally via the PDA's `init` (same seeds ⇒
  account-already-exists, not a separate check to get wrong).
- **`settle_market.rs`** — a market can technically be settled straight from
  `Open` (never `Locked`) if `settle_after` has passed, but since
  `settle_after > locks_at` is enforced at creation, `locks_at` (and so
  `place_bet`'s own `now < locks_at` gate) will always have already passed by
  then too — functionally equivalent to going through `Locked` first. Not a
  bug, just confirms `lock_market` is cosmetic/off-chain-informational by
  design, which is already the documented A3 finding.

## ⏸ Real fixes, correctly not shipped yet

`lock_market`/`cancel_market`'s missing time-gates (B1/B2 in `v3-todo.md`
§4) are genuine trust-model improvements, already written as code changes to
make, but correctly held behind the redeploy gate until the France v England
settlement evidence is captured — an Anchor upgrade the night before that
match is unbounded downside for zero judge-visible upside. Nothing in this
pass changes that call. `close_position` (B3) and the seed-constraint
tightening (B5) are already written, tested (26/26), and sitting in the same
queue.
