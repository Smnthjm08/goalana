import { ScoresService } from "@workspace/txline";
import { prisma } from "@workspace/db";
import { processScoresUpdate } from "./scores.processor";
import { logger } from "../utils/logger";

const scoresService = new ScoresService();

/**
 * Replays a fixture's full scores history through the same canonical
 * processor the live SSE worker uses (`processScoresUpdate`). This is the
 * "initial/current TxLINE snapshot" ingestion path required alongside live
 * SSE — both paths converge on identical normalization, idempotency, and
 * canonical-state derivation.
 *
 * Safe to call multiple times (e.g. once when a fixture starts being
 * tracked, and again as a manual reconciliation after a worker outage):
 * every record goes through the same (fixtureId, Seq) idempotent upsert and
 * the same lastEventSeq staleness guard as live events, so replaying
 * already-processed history is a no-op.
 */
export async function backfillFixtureScores(fixtureId: number): Promise<{ processed: number; failed: number }> {
  const records = await scoresService.getHistoricalScores(fixtureId);

  // Historical endpoint has no ordering guarantee documented — sort
  // ascending so canonical state ends up derived from the true latest event
  // even though the Seq guard alone would already make this order-safe.
  const sorted = [...records].sort((a, b) => a.Seq - b.Seq);

  let processed = 0;
  let failed = 0;

  for (const record of sorted) {
    try {
      await processScoresUpdate(record);
      processed++;
    } catch (error) {
      failed++;
      logger.error(
        "scores.backfill",
        `Failed to process seq=${record.Seq} action=${record.Action} for fixture=${fixtureId}`,
        error,
      );
    }
  }

  logger.success(
    "scores.backfill",
    `Backfilled fixture=${fixtureId}: ${processed} processed, ${failed} failed (${sorted.length} total)`,
  );

  return { processed, failed };
}

/**
 * Re-syncs every fixture that isn't finished yet (`finalSeq` still null) and
 * has already kicked off (`startTime` in the past).
 *
 * Why this exists: `scorer.worker.ts` keeps its SSE resume position
 * (`lastEventId`) purely in memory. Every process restart — a deploy via
 * `deploy.sh`'s `pm2 reload`, a crash, a manual restart — throws that away,
 * so the worker reconnects and only sees events emitted *after* it comes
 * back up. `backfillFixtureScores` was previously only ever called once, at
 * the moment a fixture was first created (fixtures.cron.ts) — nothing
 * re-ran it for a fixture that was already being tracked and happened to be
 * mid-match when the process restarted. Any events TxLINE sent during that
 * restart window were silently and permanently lost.
 *
 * This closes that gap: call it once on every process boot (see
 * bootstrap() in index.ts) so a restart mid-match self-heals via the same
 * idempotent `processScoresUpdate` path instead of leaving a silent hole in
 * the match-event history.
 */
export async function reconcileLiveFixtures(): Promise<void> {
  const now = BigInt(Date.now());

  const liveFixtures = await prisma.fixture.findMany({
    where: {
      startTime: { lte: now },
      finalSeq: null,
    },
    select: { fixtureId: true },
  });

  if (liveFixtures.length === 0) {
    logger.info("scores.backfill", "No in-progress fixtures to reconcile.");
    return;
  }

  logger.info(
    "scores.backfill",
    `Reconciling ${liveFixtures.length} in-progress fixture(s) after restart...`,
  );

  for (const { fixtureId } of liveFixtures) {
    try {
      await backfillFixtureScores(Number(fixtureId));
    } catch (error) {
      logger.error("scores.backfill", `Reconciliation failed for fixture=${fixtureId}`, error);
    }
  }
}
