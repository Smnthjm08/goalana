import {
  ScoresService,
  type SSEEvent,
  type ScoresRecord,
} from "@workspace/txline";
import { prisma } from "@workspace/db";
import { logger } from "../utils/logger";

const scoresService = new ScoresService();

type ScoresRecordWithSoccer = ScoresRecord & {
  dataSoccer?: {
    StatusId?: number;
  };
};

const RECONNECT_DELAY_MS = 5_000;

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

export async function startScoresWorker() {
  logger.info("scores.worker", "Starting...");

  while (true) {
    try {
      const stream = await scoresService.streamScoresUpdates();

      logger.success("scores.worker", "Connected to TxLINE scores stream");

      for await (const frame of stream as AsyncIterable<SSEEvent>) {
        if (frame.event === "heartbeat") {
          continue;
        }

        if (!frame.data?.trim()) {
          continue;
        }

        try {
          const rawEvent = JSON.parse(frame.data) as ScoresRecord;

          const fixtureId = rawEvent.FixtureId;
          const seq = rawEvent.Seq;
          const action = rawEvent.Action;
          const ts = rawEvent.Ts;
          const confirmed = rawEvent.Confirmed ?? false;
          
          // StatusId is at the root for Soccer events in the TxLINE stream
          const statusId = typeof rawEvent.StatusId === "number" ? rawEvent.StatusId : null;

          if (!fixtureId || seq === undefined) {
             throw new Error("Missing FixtureId or Seq");
          }

          await prisma.matchEvent.upsert({
            where: {
              fixtureId_seq: {
                fixtureId: BigInt(fixtureId),
                seq: seq,
              },
            },

            update: {
              action: action,
              timestamp: BigInt(ts),
              statusId,
              confirmed: confirmed,
              payload: rawEvent as any,
            },

            create: {
              fixtureId: BigInt(fixtureId),
              seq: seq,
              action: action,
              timestamp: BigInt(ts),
              statusId,
              confirmed: confirmed,
              payload: rawEvent as any,
            },
          });

          logger.event(
            "scores.worker",
            `Saved seq=${seq} fixture=${fixtureId} action=${action} confirmed=${confirmed}`,
          );
        } catch (error) {
          logger.error("scores.worker", "Failed to parse or save event", error);
        }
      }

      logger.warn("scores.worker", "Stream ended. Reconnecting...");
    } catch (error) {
      logger.error("scores.worker", "Stream connection failed", error);
    }

    await sleep(RECONNECT_DELAY_MS);
  }
}