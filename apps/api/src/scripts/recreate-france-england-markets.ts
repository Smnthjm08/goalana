/**
 * Cancel → recreate the France v England (fixture 18257865) markets with the
 * CORRECTED TxLINE stat keys (goals = 1/2, not corners = 7/8). The old markets
 * baked keys 7/8 immutably into their on-chain Market accounts, so they would
 * settle on corners; recreating changes the predicate → a new predicate hash →
 * a fresh Market PDA. All other metadata (marketType, question, locksAt,
 * settleAfter, opening reference probabilities, source odds id) is preserved
 * verbatim from the existing DB rows — only the predicate stat keys change.
 *
 * Mapping conclusively verified first — see verify-stat-keys.ts (goals = 1/2
 * confirmed across every completed fixture, keys 7/8 are corners).
 *
 * SAFE BY DEFAULT: dry-run unless --execute is passed. Dry-run prints the exact
 * plan and touches nothing on-chain or in the DB.
 *
 *   bun src/scripts/recreate-france-england-markets.ts            # dry run
 *   bun src/scripts/recreate-france-england-markets.ts --execute  # do it
 *   bun src/scripts/recreate-france-england-markets.ts --execute --rebet 0.05
 *       ^ also places a fresh keeper-wallet YES bet on the new HOME_WIN market
 *
 * ⚠️ Any external wallet holding a bet on an OLD market must call claim_refund
 * itself after cancellation — this script cannot refund a position it doesn't
 * own. It reports which markets have live pools so you know which need a refund.
 */
import { PublicKey, LAMPORTS_PER_SOL } from "@solana/web3.js";
import { prisma } from "@workspace/db";
import { TXLINE_STAT_KEYS, type Predicate } from "@workspace/goalana-sdk";
import {
  initializeGoalanaConfig,
  createMarketForFixture,
  cancelMarketOnChain,
  placeBetOnChain,
  fetchMarketAccount,
} from "../services/goalana.service";

const FIXTURE_ID = 18257865n; // France v England
const explorerTx = (s: string) => `https://explorer.solana.com/tx/${s}?cluster=devnet`;

// Corrected predicates by market type — keys now come from TXLINE_STAT_KEYS
// (HOME_GOALS=1, AWAY_GOALS=2). Shapes are identical to market.service's
// discovery; only the stat keys differ from what's baked on-chain today.
const H = TXLINE_STAT_KEYS.HOME_GOALS;
const A = TXLINE_STAT_KEYS.AWAY_GOALS;
const PREDICATES: Record<string, Predicate> = {
  FULL_TIME_HOME_WIN: { statAKey: H, statBKey: A, op: { subtract: {} }, threshold: 0, comparison: { greaterThan: {} } },
  FULL_TIME_DRAW: { statAKey: H, statBKey: A, op: { subtract: {} }, threshold: 0, comparison: { equalTo: {} } },
  FULL_TIME_AWAY_WIN: { statAKey: H, statBKey: A, op: { subtract: {} }, threshold: 0, comparison: { lessThan: {} } },
  FULL_TIME_OVER_1_5: { statAKey: H, statBKey: A, op: { add: {} }, threshold: 1, comparison: { greaterThan: {} } },
  FULL_TIME_OVER_2_5: { statAKey: H, statBKey: A, op: { add: {} }, threshold: 2, comparison: { greaterThan: {} } },
  FULL_TIME_OVER_3_5: { statAKey: H, statBKey: A, op: { add: {} }, threshold: 3, comparison: { greaterThan: {} } },
};

async function main() {
  const execute = process.argv.includes("--execute");
  const rebetIdx = process.argv.indexOf("--rebet");
  const rebetSol = rebetIdx !== -1 ? Number(process.argv[rebetIdx + 1]) : 0;

  console.log(`\n=== France v England (${FIXTURE_ID}) market recreation — ${execute ? "EXECUTE" : "DRY RUN"} ===`);
  if (H !== 1 || A !== 2) throw new Error(`TXLINE_STAT_KEYS not corrected (HOME=${H} AWAY=${A}); expected 1/2. Aborting.`);
  console.log(`Corrected keys in use: HOME_GOALS=${H}, AWAY_GOALS=${A}\n`);

  const oldMarkets = await prisma.market.findMany({ where: { fixtureId: FIXTURE_ID }, orderBy: { marketType: "asc" } });
  if (oldMarkets.length === 0) throw new Error("No France v England markets found in DB.");

  if (execute) await initializeGoalanaConfig();

  for (const old of oldMarkets) {
    const pda = new PublicKey(old.marketPda);
    const oc = await fetchMarketAccount(pda);
    const pool = (Number(await pool_of(pda)) / LAMPORTS_PER_SOL).toFixed(3);
    const predicate = PREDICATES[old.marketType];

    console.log(`\n▸ ${old.marketType}`);
    console.log(`   old PDA ${old.marketPda}  status=${oc.status}  pooled=${pool} SOL`);
    console.log(`   old predicate keys A:${oc.predicate.statAKey} B:${oc.predicate.statBKey}  →  corrected A:${predicate?.statAKey} B:${predicate?.statBKey}`);
    console.log(`   preserve: question="${old.question}" locksAt=${old.locksAt.toISOString()} settleAfter=${old.settleAfter.toISOString()} yes%=${old.initialYesPct} no%=${old.initialNoPct}`);

    if (!predicate) {
      console.log(`   ⚠ no corrected predicate for ${old.marketType} — SKIPPING`);
      continue;
    }
    if (pool !== "0.000") console.log(`   ⚠ has a live pool — its bettor must claim_refund after cancel (external wallet if not the keeper).`);

    if (!execute) {
      console.log(`   [dry run] would: cancel old → create new (keys ${predicate.statAKey}/${predicate.statBKey}) → mark old CANCELLED, insert new row`);
      continue;
    }

    // 1. Cancel the old market (authority-gated, unconditional) if still active.
    if (oc.status === "Open" || oc.status === "Locked") {
      const { txSignature } = await cancelMarketOnChain(pda);
      console.log(`   cancel_market: ${txSignature}\n     ${explorerTx(txSignature)}`);
    } else {
      console.log(`   cancel_market: skipped (already ${oc.status})`);
    }
    await prisma.market.update({ where: { id: old.id }, data: { status: "CANCELLED" } });

    // 2. Recreate with the corrected predicate (same times → same lifecycle).
    const created = await createMarketForFixture(FIXTURE_ID, predicate, old.locksAt, old.settleAfter);
    console.log(`   create_market: ${created.txSignature ?? "(already existed)"}${created.txSignature ? `\n     ${explorerTx(created.txSignature)}` : ""}`);
    console.log(`   new PDA ${created.marketPda.toBase58()}`);

    // 3. Insert the new DB row, preserving all metadata but the corrected hash.
    await prisma.market.upsert({
      where: { marketPda: created.marketPda.toBase58() },
      update: {},
      create: {
        fixtureId: FIXTURE_ID,
        marketPda: created.marketPda.toBase58(),
        predicateHash: Array.from(created.predicateHash || []).join(","),
        marketType: old.marketType,
        question: old.question,
        locksAt: old.locksAt,
        settleAfter: old.settleAfter,
        creationTx: created.txSignature,
        sourceOddsMessageId: old.sourceOddsMessageId,
        initialYesPct: old.initialYesPct,
        initialNoPct: old.initialNoPct,
        status: "OPEN",
      },
    });

    // 4. Optional: repopulate the demo bet on the new HOME_WIN market.
    if (rebetSol > 0 && old.marketType === "FULL_TIME_HOME_WIN") {
      const lamports = Math.round(rebetSol * LAMPORTS_PER_SOL);
      const { txSignature } = await placeBetOnChain(created.marketPda, "yes", lamports);
      console.log(`   place_bet (keeper, ${rebetSol} SOL YES): ${txSignature}\n     ${explorerTx(txSignature)}`);
    }
  }

  console.log(`\n${execute ? "✅ Done." : "Dry run complete — re-run with --execute to apply."}`);
  await prisma.$disconnect();
  process.exit(0);
}

// Total pooled lamports on a market's vault (best-effort; 0 if none).
async function pool_of(marketPda: PublicKey): Promise<number> {
  const { getVaultPda } = await import("@workspace/goalana-sdk");
  const { connection } = await import("../services/goalana.service");
  const [vault] = getVaultPda(marketPda);
  const info = await connection.getAccountInfo(vault);
  return info?.lamports ?? 0;
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
