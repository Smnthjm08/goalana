/**
 * Reconcile fixture 18257865 (France v England) markets: for every market
 * `discoverMarketsForFixture` finds as supported, create it on-chain if its
 * PDA doesn't exist yet, and (re)write its DB row either way — using the
 * *current* predicate logic from `market.service.ts`, not a hand-copied
 * predicate. Hand-copying predicates into a one-off script is exactly how
 * the earlier corners/goals stat-key duplication happened (see
 * `recreate-france-england-markets.ts`) — reusing the real functions makes
 * that class of bug impossible here.
 *
 * This fixture's kickoff (2026-07-18T21:00Z) has already passed, so it no
 * longer falls in `processMarketsForUpcomingFixtures`'s "upcoming fixtures"
 * window and will never be reconciled by the normal cron again. This script
 * is the one-off equivalent for this specific fixture, callable from the API
 * server directly.
 *
 * Known state going in (verified live against devnet before writing this):
 * FULL_TIME_HOME_WIN/DRAW/AWAY_WIN/OVER_2_5/OVER_3_5 + both parametric
 * markets already exist on-chain AND have a DB row — for those this script
 * only rewrites the DB row (harmless, `update: {}` no-ops metadata) and
 * changes nothing on-chain. FULL_TIME_OVER_1_5 does not exist on-chain —
 * this is the only market this script would actually create.
 *
 * SAFE BY DEFAULT: dry-run unless --execute is passed.
 *
 *   bun src/scripts/sync-france-england-markets.ts            # dry run
 *   bun src/scripts/sync-france-england-markets.ts --execute  # do it
 */
import { prisma } from "@workspace/db";
import { OddsService, type OddsPayload } from "@workspace/txline";
import {
  discoverMarketsForFixture,
  createParametricPropMarketsForFixture,
} from "../services/market.service";
import { createMarketForFixture, initializeGoalanaConfig, connection } from "../services/goalana.service";
import { PARAMETRIC_PROP_MARKETS } from "../services/market-definitions";
import { getMarketPda, derivePredicateHash } from "@workspace/goalana-sdk";
import * as dotenv from 'dotenv';

const FIXTURE_ID = 18257865n;
const oddsService = new OddsService();

dotenv.config({path: "../../../../.env"})

async function main() {
  const execute = process.argv.includes("--execute");
  console.log(`\n=== France v England (${FIXTURE_ID}) market sync — ${execute ? "EXECUTE" : "DRY RUN"} ===\n`);

  const fixture = await prisma.fixture.findUnique({ where: { fixtureId: FIXTURE_ID } });
  if (!fixture) throw new Error(`Fixture ${FIXTURE_ID} not found in DB.`);

  const locksAt = new Date(Number(fixture.startTime));
  const settleAfter = new Date(locksAt.getTime() + 15 * 60 * 1000);

  if (execute) await initializeGoalanaConfig();

  // 1. Parametric markets (corners/cards) — always-on, no odds required.
  console.log("▸ Parametric markets (corners/cards)");
  for (const prop of PARAMETRIC_PROP_MARKETS) {
    const predicate = { statAKey: prop.statAKey, statBKey: prop.statBKey, op: { add: {} }, threshold: prop.threshold, comparison: { greaterThan: {} } };
    const predicateHash = derivePredicateHash(predicate);
    const [pda] = getMarketPda(FIXTURE_ID, predicateHash);
    const onChain = await connection.getAccountInfo(pda);
    const dbRow = await prisma.market.findUnique({ where: { marketPda: pda.toBase58() } });
    console.log(`   ${prop.type.padEnd(22)} PDA ${pda.toBase58()}  on-chain=${!!onChain}  db=${!!dbRow}`);
  }
  if (execute) {
    await createParametricPropMarketsForFixture(fixture, locksAt, settleAfter);
    console.log("   (created/reconciled via createParametricPropMarketsForFixture)");
  }

  // 2. Odds-driven full-time markets — reuse the real discovery logic verbatim.
  console.log("\n▸ Odds-driven markets (1X2 / Over-Under)");
  const oddsRows = (await oddsService.getOddsSnapshots(Number(FIXTURE_ID))) as OddsPayload[];
  if (!oddsRows || oddsRows.length === 0) {
    console.log("   No odds rows returned — nothing to discover.");
  } else {
    const discovered = discoverMarketsForFixture(fixture, oddsRows);

    for (const market of discovered) {
      if (!market.supportedForCreation || !market.predicate || !market.referenceProbability) {
        console.log(`   ${market.type.padEnd(22)} skipped (unsupported/malformed: ${market.unsupportedReason ?? "no reference probability"})`);
        continue;
      }

      const predicateHash = derivePredicateHash(market.predicate);
      const [pda] = getMarketPda(FIXTURE_ID, predicateHash);
      const onChain = await connection.getAccountInfo(pda);
      const dbRow = await prisma.market.findUnique({ where: { marketPda: pda.toBase58() } });

      console.log(`   ${market.type.padEnd(22)} PDA ${pda.toBase58()}  on-chain=${!!onChain}  db=${!!dbRow}  ref%=${market.referenceProbability.yesPct}/${market.referenceProbability.noPct}`);

      if (!execute) continue;

      try {
        const result = await createMarketForFixture(FIXTURE_ID, market.predicate, locksAt, settleAfter);
        console.log(`      create_market: ${result.txSignature ?? "(already existed on-chain)"}`);

        await prisma.market.upsert({
          where: { marketPda: result.marketPda.toBase58() },
          update: {
            initialYesPct: market.referenceProbability.yesPct,
            initialNoPct: market.referenceProbability.noPct,
            sourceOddsMessageId: market.source.messageId,
          },
          create: {
            fixtureId: FIXTURE_ID,
            marketPda: result.marketPda.toBase58(),
            predicateHash: Array.from(result.predicateHash || []).join(","),
            marketType: market.type,
            question: market.question,
            locksAt,
            settleAfter,
            creationTx: result.txSignature,
            sourceOddsMessageId: market.source.messageId,
            initialYesPct: market.referenceProbability.yesPct,
            initialNoPct: market.referenceProbability.noPct,
            status: "OPEN",
          },
        });
        console.log(`      DB row upserted.`);
      } catch (error) {
        console.error(`      FAILED for ${market.type}:`, error);
      }
    }
  }

  console.log(`\n${execute ? "Done." : "Dry run complete — re-run with --execute to create/sync."}`);
  await prisma.$disconnect();
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
