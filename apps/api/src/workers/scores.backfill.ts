import { ScoresService } from "@workspace/txline";
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
