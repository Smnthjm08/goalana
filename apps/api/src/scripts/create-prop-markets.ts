/**
 * Create parametric prop markets on France v England (fixture 18257865) —
 * v2-todo.md item 18. "Total corners > 9.5" and "Total cards > 3.5", using
 * the identical `add + greaterThan` predicate shape as the goals Over/Under
 * markets, just on the already-validated corners (7/8) and cards (3/4) stat
 * keys (see v2-todo.md's stat-key validation section).
 *
 * These are UNPRICED: item 11's blocker was market.service.ts's own
 * odds-gate (TxLINE prices no corners/cards odds), not the protocol — the
 * predicate stat keys are plain instruction args, so the frozen settlement
 * path and program need no change. `initialYesPct`/`initialNoPct` are left
 * null (schema made nullable in migration `nullable_initial_odds`); the
 * frontend renders "Unpriced — the pool sets the price" instead of a
 * TxLINE-derived percentage for these two markets.
 *
 * SAFE BY DEFAULT: dry-run unless --execute is passed.
 *
 *   bun src/scripts/create-prop-markets.ts            # dry run
 *   bun src/scripts/create-prop-markets.ts --execute   # do it
 */
import { prisma } from "@workspace/db";
import { TXLINE_STAT_KEYS, type Predicate } from "@workspace/goalana-sdk";
import { initializeGoalanaConfig, createMarketForFixture } from "../services/goalana.service";

const FIXTURE_ID = 18257865n; // France v England
const UNPRICED_SOURCE_ID = "unpriced-parametric-v1";
const explorerTx = (s: string) => `https://explorer.solana.com/tx/${s}?cluster=devnet`;

const PROP_MARKETS: Array<{ marketType: string; question: string; predicate: Predicate }> = [
  {
    marketType: "TOTAL_CORNERS_OVER_9_5",
    question: "Will total corners exceed 9.5?",
    predicate: {
      statAKey: TXLINE_STAT_KEYS.HOME_CORNERS,
      statBKey: TXLINE_STAT_KEYS.AWAY_CORNERS,
      op: { add: {} },
      threshold: 9,
      comparison: { greaterThan: {} },
    },
  },
  {
    marketType: "TOTAL_CARDS_OVER_3_5",
    question: "Will total (yellow) cards exceed 3.5?",
    predicate: {
      statAKey: TXLINE_STAT_KEYS.HOME_YELLOW_CARDS,
      statBKey: TXLINE_STAT_KEYS.AWAY_YELLOW_CARDS,
      op: { add: {} },
      threshold: 3,
      comparison: { greaterThan: {} },
    },
  },
];

async function main() {
  const execute = process.argv.includes("--execute");
  console.log(`\n=== France v England (${FIXTURE_ID}) prop markets — ${execute ? "EXECUTE" : "DRY RUN"} ===`);

  // Reuse an existing market's locksAt/settleAfter so the props share the
  // exact same lifecycle window as the already-recreated goals markets.
  const reference = await prisma.market.findFirst({
    where: { fixtureId: FIXTURE_ID, status: "OPEN" },
    orderBy: { marketType: "asc" },
  });
  if (!reference) throw new Error("No OPEN France v England market found to source locksAt/settleAfter from.");
  console.log(`Reference lifecycle window: locksAt=${reference.locksAt.toISOString()} settleAfter=${reference.settleAfter.toISOString()}\n`);

  if (execute) await initializeGoalanaConfig();

  for (const prop of PROP_MARKETS) {
    console.log(`▸ ${prop.marketType} — "${prop.question}"`);
    console.log(`   predicate: A:${prop.predicate.statAKey} B:${prop.predicate.statBKey} add > ${prop.predicate.threshold}`);

    if (!execute) {
      console.log(`   [dry run] would: create_market → insert DB row (initialYesPct/NoPct = null, sourceOddsMessageId="${UNPRICED_SOURCE_ID}")\n`);
      continue;
    }

    const created = await createMarketForFixture(FIXTURE_ID, prop.predicate, reference.locksAt, reference.settleAfter);
    console.log(`   create_market: ${created.txSignature ?? "(already existed)"}${created.txSignature ? `\n     ${explorerTx(created.txSignature)}` : ""}`);
    console.log(`   PDA ${created.marketPda.toBase58()}`);

    await prisma.market.upsert({
      where: { marketPda: created.marketPda.toBase58() },
      update: {},
      create: {
        fixtureId: FIXTURE_ID,
        marketPda: created.marketPda.toBase58(),
        predicateHash: Array.from(created.predicateHash || []).join(","),
        marketType: prop.marketType,
        question: prop.question,
        locksAt: reference.locksAt,
        settleAfter: reference.settleAfter,
        creationTx: created.txSignature,
        sourceOddsMessageId: UNPRICED_SOURCE_ID,
        initialYesPct: null,
        initialNoPct: null,
        status: "OPEN",
      },
    });
    console.log(`   DB row upserted.\n`);
  }

  console.log(execute ? "Done." : "Dry run complete — pass --execute to apply.");
}

main()
  .catch((err) => {
    console.error("create-prop-markets failed:", err);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
