import { OddsService, type SSEEvent, type OddsPayload } from "@workspace/txline";
import { prisma } from "@workspace/db";
import { processOddsUpdate } from "./odds.processor";
import {
  markStreamConnected,
  markStreamDisconnected,
  markStreamFrame,
} from "../services/stream-health.service";
import { logger } from "../utils/logger";

const oddsService = new OddsService();

const RECONNECT_BASE_DELAY_MS = 5_000;
const RECONNECT_MAX_DELAY_MS = 60_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

// TxLINE's /odds/stream isn't scoped to a single competition, so only persist
// updates for fixtures Goalana actually tracks (World Cup, synced into Postgres).
async function isTrackedFixture(fixtureId: number): Promise<boolean> {
  const fixture = await prisma.fixture.findUnique({
    where: { fixtureId: BigInt(fixtureId) },
    select: { fixtureId: true },
  });
  return fixture !== null;
}

/**
 * Live odds freshness via TxLINE's SSE stream. Snapshot-based sync
 * (odds.cron.ts, chained off fixtures.cron.ts) remains the recovery/
 * reconciliation mechanism — this worker only keeps things fresh in between.
 *
 * Persists through the same canonical `processOddsUpdate` path used by
 * snapshot sync, so Odds/OddsHistory dedup behavior is identical either way.
 */
export async function startOddsWorker(signal: AbortSignal): Promise<void> {
  logger.info("odds.worker", "Starting...");

  let lastEventId: string | undefined;
  let reconnectDelayMs = RECONNECT_BASE_DELAY_MS;

  while (!signal.aborted) {
    try {
      const stream = await oddsService.streamOddsUpdates(undefined, {
        signal,
        lastEventId,
      });

      logger.success("odds.worker", "Connected to TxLINE odds stream");
      markStreamConnected("odds");
      // A successful connection means any prior outage is over — reset so
      // the next disconnect retries quickly again instead of inheriting a
      // stale backoff delay from an unrelated earlier failure streak.
      reconnectDelayMs = RECONNECT_BASE_DELAY_MS;

      for await (const frame of stream as AsyncIterable<SSEEvent>) {
        if (frame.id) {
          lastEventId = frame.id;
        }

        if (frame.event === "heartbeat") {
          markStreamFrame("odds", false);
          continue;
        }

        markStreamFrame("odds", true);

        if (!frame.data?.trim()) {
          continue;
        }

        try {
          const event = JSON.parse(frame.data) as OddsPayload;

          if (!event.FixtureId || !event.MessageId) {
            continue;
          }

          if (!(await isTrackedFixture(event.FixtureId))) {
            continue;
          }

          await processOddsUpdate(event);

          logger.event(
            "odds.worker",
            `Saved fixture=${event.FixtureId} type=${event.SuperOddsType} msg=${event.MessageId}`,
          );
        } catch (error) {
          logger.error("odds.worker", "Failed to parse or save odds event", error);
        }
      }

      if (!signal.aborted) {
        logger.warn("odds.worker", "Stream ended. Reconnecting...");
      }
    } catch (error) {
      if (!signal.aborted) {
        logger.error("odds.worker", "Stream connection failed", error);
      }
    } finally {
      // Covers both exits: the stream ending normally and a connection throw.
      markStreamDisconnected("odds");
    }

    if (signal.aborted) {
      break;
    }

    logger.info("odds.worker", `Reconnecting in ${reconnectDelayMs}ms...`);
    await sleep(reconnectDelayMs);
    reconnectDelayMs = Math.min(reconnectDelayMs * 2, RECONNECT_MAX_DELAY_MS);
  }

  logger.info("odds.worker", "Stopped.");
}
