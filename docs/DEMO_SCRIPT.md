# Demo Video Script — Goalana (TxLINE Track)

## Why this is shaped the way it is

The brief caps the required video at **"Up to 5 Minutes"** and says judging is _"heavily based
on the demo video."_ A judge reviewing this track then suggested:

> "How about you put together the first 5-min as the core summary part with further details in
> the rest?"

So this is recorded as **one continuous video in two acts**, with a hard chapter break at 5:00:

- **Part 1 (0:00–5:00)** is the official submission. It must stand on its own — everything the
  brief's "Submission Requirements" asks for (problem, live walkthrough, how TxLINE powers the
  backend) has to land inside these 5 minutes, because a judge who only watches Part 1 should
  come away with the full picture.
- **Part 2 (5:00–~12:00)** is bonus depth for a judge who wants to go further — architecture,
  code quality, the parametric prop markets, and the TxLINE feedback said out loud. Nothing in
  Part 2 is required to pass screening; it exists so the extra effort is inspectable without
  bloating the scored cut.

Upload as **one unlisted YouTube video** (not Loom — links can expire/paywall), with YouTube
chapter markers in the description:

```text
0:00 Part 1 — Core summary (required demo)
5:00 Part 2 — Extended walkthrough (bonus, optional)
```

Pin a comment on the video itself saying the same thing, in case the judge only reads the
description on a phone. Test the link **logged out**, in an incognito window, before submitting.

Recording notes: 1080p+, readable font size (zoom browser to ~125% for code/Explorer screenshots),
wallet with a clean tx history (no unrelated test spam), do a dry run once before the real take.

---

## Part 1 — Core summary (0:00–5:00, the required demo)

This block alone must satisfy: the problem, a live app walkthrough, and how TxLINE powers the
backend. Treat it as the whole submission — assume the judge stops watching at 5:00.

**0:00–0:30 — Problem.**

> "Every prediction market says 'trustless settlement.' Almost none can show it. Goalana settles
> World Cup markets with a TxLINE Merkle proof verified _inside the settlement transaction_ — a
> wrong proof physically cannot move the money."

Show: nothing fancy yet, just talking head or the README hero line on screen.

**0:30–1:30 — Live app, live data, a real bet.**
Open `https://goalana.smnthjm08.dev/` on screen.

- Home → a real fixture card showing live TxLINE odds/scores, the odds-movement chart, kickoff
  countdown.
- Click into the fixture detail page. Point out the lifecycle status strip
  (Scheduled → Live → Finished → Settled).
- Connect wallet (devnet). Place a real devnet bet on a live market. Show the toast, the pool
  totals update, the position appear on `/positions`.

Say once, on camera: _"That's a real devnet transaction, not a mock — I'll show you the signature
in a second."_

**1:30–3:00 — THE WEDGE: proof integrity, on camera.**
This is the differentiator beat — spend the most time here.

- Open the fixture's **Proof Integrity** tab.
- Genuine goals proof → **accepted** → click through to Explorer, show the successful tx.
- Same proof, value forged 1→6 → **`InvalidStatProof`, transaction reverted** → Explorer, show
  the failed tx.
- One sibling-hash byte flipped → **reverted again**.

> "Same engine verifies corners and cards proofs through the identical instruction — this
> settles _any_ TxLINE statistic, not just goals."

**3:00–4:00 — Settlement receipt.**

- Show the three-stage Merkle visualization (stat leaf → event root → subtree → anchored daily
  root) and the `daily_scores_roots` PDA link on Explorer.
- If the France v England semifinal already settled live by recording time: show the real
  `settle_market` tx and a `claim_winnings` payout, and say the compute-unit number out loud. If
  it hasn't settled yet, skip straight to Part 1's close — don't force it, the localnet suite
  already covers this path and Part 2 can caveat it honestly.

**4:00–4:30 — Trust model.**

> "Settlement and claims are permissionless — our keeper is a convenience, not an authority. The
> house can create and cancel markets; it can never decide an outcome or move a coin."
> Show `/positions` and, if relevant, a cancelled-market refund.

**4:30–5:00 — Close (this is the last thing a 5-minute-only viewer sees — make it count).**

> "That's core functionality — live TxLINE ingestion end to end. UX — a soccer fan's full
> bet-to-claim flow in one sitting. Code quality — 26/26 deterministic on-chain tests plus a
> public RISKS.md."
> Show on screen: architecture one-liner, the TxLINE endpoints used, repo link, live app link.
> State explicitly: _"Everything after this point is bonus depth for anyone who wants to go
> further — the core demo ends here."_

---

## Part 2 — Extended walkthrough (5:00–~12:00, optional bonus depth)

Clearly mark the start on screen ("Part 2 — Extended Walkthrough") so nobody mistakes it for
required content.

**5:00–6:30 — Architecture tour.**
Walk the monorepo layout on screen (`apps/web`, `apps/api`, `packages/txline`,
`packages/goalana-sdk`, `goalana_program`). Show the SSE workers (`odds.worker.ts`,
`scorer.worker.ts`) and the lifecycle cron (`lifecycle.cron.ts`) briefly in the editor — this is
where "TxLINE powers the backend" gets its technical proof, not just a claim.

**6:30–8:00 — Code quality.**
Run `anchor test` on screen, live or sped up, showing 26/26 passing. Open `RISKS.md` and
highlight one or two honestly-documented limitations (house trust surface, vault dust, SSE
reconnect behavior) — the point is that nothing is hidden.

**8:00–9:30 — Full lifecycle, technical depth.**
Re-walk `create_market` (house-only) → `place_bet` → `lock_market` → `settle_market` → `claim_*`,
this time pausing on PDA derivation and the Vault PDA holding real escrowed lamports (show a
balance-diff, not just a status change).

**9:30–11:00 — Parametric prop markets.**
Show the two unpriced pari-mutuel markets (Total corners > 9.5, Total cards > 3.5) on France v
England — TxLINE prices no corners/cards odds for this competition, so the pool itself is the
only price. Point out they settle through the _identical_ CPI path as every priced market — no
special-casing by stat key.

**11:00–12:00 — TxLINE feedback, said out loud.**

> "What we liked most: one normalized schema across fixtures, odds, and scores, and the
> three-stage Merkle proof with an on-chain anchored daily root — genuinely strong settlement
> primitive. Where we hit friction: the on-chain `validate_stat` CPI byte layout wasn't obvious
> from the prose docs, `GameState` is always `'scheduled'` so live/finished has to be derived
> ourselves, and every real proof we fetched came back `period=100` rather than the documented
> `0–5` range."

Close with thanks + repo/app links on screen again.

---

## Checklist tie-in

Once recorded and uploaded, update `README.md`'s `🎬 Demo` placeholder with the real YouTube link.
