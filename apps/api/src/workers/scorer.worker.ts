import { ScoresService, type SSEEvent, type ScoresRecord } from "@workspace/txline";
import { processScoresUpdate } from "./scores.processor";
import {
  markStreamConnected,
  markStreamDisconnected,
  markStreamFrame,
} from "../services/stream-health.service";
import { logger } from "../utils/logger";

const scoresService = new ScoresService();

const RECONNECT_DELAY_MS = 5_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

/**
 * Live scores freshness via TxLINE's SSE stream. All persistence goes
 * through `processScoresUpdate` — the same canonical processor used by the
 * snapshot backfill path (see scores.backfill.ts) — so raw storage,
 * idempotency, and canonical fixture-state derivation behave identically
 * regardless of which path an event arrived through.
 *
 * Mirrors odds.worker.ts's reconnect pattern: `AbortSignal` for graceful
 * shutdown, `Last-Event-ID` so a reconnect resumes from where the stream
 * left off instead of silently skipping whatever happened during the gap.
 */
export async function startScoresWorker(signal: AbortSignal): Promise<void> {
  logger.info("scores.worker", "Starting...");

  let lastEventId: string | undefined;

  while (!signal.aborted) {
    try {
      const stream = await scoresService.streamScoresUpdates(undefined, {
        signal,
        lastEventId,
      });

      logger.success("scores.worker", "Connected to TxLINE scores stream");
      markStreamConnected("scores");

      for await (const frame of stream as AsyncIterable<SSEEvent>) {
        if (frame.id) {
          lastEventId = frame.id;
        }

        if (frame.event === "heartbeat") {
          markStreamFrame("scores", false);
          continue;
        }

        markStreamFrame("scores", true);

        if (!frame.data?.trim()) {
          continue;
        }

        try {
          const record = JSON.parse(frame.data) as ScoresRecord;
          await processScoresUpdate(record);

          logger.event(
            "scores.worker",
            `Saved seq=${record.Seq} fixture=${record.FixtureId} action=${record.Action}`,
          );
        } catch (error) {
          logger.error("scores.worker", "Failed to parse or save event", error);
        }
      }

      if (!signal.aborted) {
        logger.warn("scores.worker", "Stream ended. Reconnecting...");
      }
    } catch (error) {
      if (!signal.aborted) {
        logger.error("scores.worker", "Stream connection failed", error);
      }
    } finally {
      // Covers both exits: the stream ending normally and a connection throw.
      markStreamDisconnected("scores");
    }

    if (signal.aborted) {
      break;
    }

    await sleep(RECONNECT_DELAY_MS);
  }

  logger.info("scores.worker", "Stopped.");
}
