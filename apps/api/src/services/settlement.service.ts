import { prisma } from "@workspace/db";
import { PublicKey } from "@solana/web3.js";
import { BN } from "@coral-xyz/anchor";
import { ScoresService, type ScoresStatValidation, type ScoresStatValidationV2 } from "@workspace/txline";
import { getDailyScoresRootsPda } from "@workspace/goalana-sdk";
import { fetchMarketAccount, settleMarketOnChain, type SettleMarketParams } from "./goalana.service";
import { logger } from "../utils/logger";

const scoresService = new ScoresService();

type ProgramProofNode = { hash: number[]; isRightSibling: boolean };

function toProgramProofNode(node: { hash: number[]; isRightSibling: boolean }): ProgramProofNode {
  return { hash: node.hash, isRightSibling: node.isRightSibling };
}

/** TxLINE proof hashes are 32-byte arrays; hex is the compact, display-friendly form. */
function toHex(bytes: number[]): string {
  return bytes.map((b) => b.toString(16).padStart(2, "0")).join("");
}

function toDisplayProofNode(node: { hash: number[]; isRightSibling: boolean }) {
  return { hash: toHex(node.hash), isRightSibling: node.isRightSibling };
}

// TxLINE's ScoreStat is a typed interface (no index signature); Prisma's Json
// input requires a plain object, so flatten to the three fields we display.
function toDisplayStat(stat: { key: number; value: number; period: number }) {
  return { key: stat.key, value: stat.value, period: stat.period };
}

/**
 * Builds the persisted, display-friendly settlement receipt — the exact
 * three-stage Merkle chain (stat leaf → eventStatRoot → events-subtree root →
 * anchored daily batch root) the on-chain CPI verified. Rendered by the
 * frontend SettlementProofReceipt; kept in sync with that component's shape.
 */
function buildSettlementProofRecord(
  validation: ScoresStatValidation,
  outcome: boolean | null,
  fixtureId: bigint
) {
  const [dailyRootsPda] = getDailyScoresRootsPda(validation.ts);

  return {
    ts: validation.ts,
    outcome,
    fixtureId: Number(fixtureId),
    statToProve: toDisplayStat(validation.statToProve),
    statToProve2: validation.statToProve2 ? toDisplayStat(validation.statToProve2) : null,
    // Stage 1: stat leaf → eventStatRoot (this event's stat tree).
    eventStatRoot: toHex(validation.eventStatRoot),
    statProof: validation.statProof.map(toDisplayProofNode),
    statProof2: (validation.statProof2 ?? []).map(toDisplayProofNode),
    // Stage 2: eventStatRoot → events-subtree root (the fixture's day of events).
    eventsSubTreeRoot: toHex(validation.summary.eventStatsSubTreeRoot),
    subTreeProof: validation.subTreeProof.map(toDisplayProofNode),
    // Stage 3: subtree root → daily batch root, anchored on-chain in this PDA.
    mainTreeProof: validation.mainTreeProof.map(toDisplayProofNode),
    dailyRootsPda: dailyRootsPda.toBase58(),
  };
}

// `scores/stat-validation` returns the "V2" shape (statsToProve[]/statProofs[])
// only when called with the comma-separated `statKeys` param. We always call
// it with statKey/statKey2 (Goalana predicates only ever reference one or two
// stats), so the legacy shape is the only one settlement should ever see.
function isLegacyValidation(
  v: ScoresStatValidation | ScoresStatValidationV2
): v is ScoresStatValidation {
  return "statToProve" in v;
}

/**
 * Settles every Market whose fixture has reached a confirmed final state
 * (`Fixture.finalSeq`, set by scores.processor.ts) and whose settle_after
 * window has passed. Fetches TxLINE's Merkle proof for the market's exact
 * predicate stat(s) and submits `settle_market` — see
 * docs/MARKET_LIFECYCLE.md#7-proof-retrieval and #8-settlement.
 *
 * Idempotent: DB status pre-filters to OPEN/LOCKED, and the on-chain Market
 * is re-read before every submission — if it's already Settled/Cancelled
 * (e.g. a previous run submitted successfully but crashed before the DB
 * write), this syncs Postgres and skips instead of re-submitting.
 */
export async function settleFinishedFixtures(): Promise<void> {
  const now = new Date();

  const candidates = await prisma.market.findMany({
    where: {
      status: { in: ["OPEN", "LOCKED"] },
      settleAfter: { lte: now },
      fixture: { finalSeq: { not: null } },
    },
    include: { fixture: true },
  });

  if (candidates.length === 0) {
    logger.info("settlement.service", "No markets ready to settle.");
    return;
  }

  logger.info("settlement.service", `Attempting settlement for ${candidates.length} market(s)...`);

  for (const market of candidates) {
    if (market.fixture.finalSeq === null) continue; // guarded by the query, but keep TS honest

    try {
      await settleOneMarket(market.id, market.marketPda, market.fixtureId, market.fixture.finalSeq);
    } catch (error) {
      logger.error("settlement.service", `Settlement failed for market ${market.marketPda}`, error);
    }
  }
}

async function settleOneMarket(
  marketId: string,
  marketPdaStr: string,
  fixtureId: bigint,
  finalSeq: number
): Promise<void> {
  const marketPda = new PublicKey(marketPdaStr);
  const onChain = await fetchMarketAccount(marketPda);

  if (onChain.status !== "Open" && onChain.status !== "Locked") {
    await prisma.market.update({
      where: { id: marketId },
      data: { status: onChain.status.toUpperCase() },
    });
    logger.info(
      "settlement.service",
      `Market ${marketPdaStr} already ${onChain.status} on-chain — synced DB, skipping.`
    );
    return;
  }

  const statKey = onChain.predicate.statAKey;
  const statKey2 = onChain.predicate.statBKey ?? undefined;

  const validation = await scoresService.getScoresStatValidation({
    fixtureId: Number(fixtureId),
    seq: finalSeq,
    statKey,
    statKey2,
  });

  if (!isLegacyValidation(validation)) {
    throw new Error(
      `Unexpected V2 stat-validation response shape for market ${marketPdaStr} (statKey/statKey2 request should return legacy shape)`
    );
  }

  const fixtureProof = validation.subTreeProof.map(toProgramProofNode);
  const mainTreeProof = validation.mainTreeProof.map(toProgramProofNode);

  const statA: SettleMarketParams["statA"] = {
    statToProve: validation.statToProve,
    eventStatRoot: validation.eventStatRoot,
    statProof: validation.statProof.map(toProgramProofNode),
  };

  const statB: SettleMarketParams["statB"] =
    statKey2 !== undefined && validation.statToProve2
      ? {
          statToProve: validation.statToProve2,
          eventStatRoot: validation.eventStatRoot,
          statProof: (validation.statProof2 ?? []).map(toProgramProofNode),
        }
      : null;

  const fixtureSummary: SettleMarketParams["fixtureSummary"] = {
    fixtureId: new BN(validation.summary.fixtureId),
    updateStats: {
      updateCount: validation.summary.updateStats.updateCount,
      minTimestamp: new BN(validation.summary.updateStats.minTimestamp),
      maxTimestamp: new BN(validation.summary.updateStats.maxTimestamp),
    },
    eventsSubTreeRoot: validation.summary.eventStatsSubTreeRoot,
  };

  logger.info(
    "settlement.service",
    `Submitting settle_market for ${marketPdaStr} (fixture ${fixtureId}, seq ${finalSeq})...`
  );

  const { txSignature, outcome } = await settleMarketOnChain({
    marketPda,
    oracleTsMs: new BN(validation.ts),
    fixtureSummary,
    fixtureProof,
    mainTreeProof,
    statA,
    statB,
  });

  await prisma.market.update({
    where: { id: marketId },
    data: {
      status: "SETTLED",
      settlementTx: txSignature,
      oracleTsMs: BigInt(validation.ts),
      settlementProof: buildSettlementProofRecord(validation, outcome, fixtureId),
    },
  });

  logger.success(
    "settlement.service",
    `Settled ${marketPdaStr}: outcome=${outcome} tx=${txSignature}`
  );
}
