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
          const event = JSON.parse(
            frame.data,
          ) as ScoresRecordWithSoccer;

          const statusId =
            typeof event.dataSoccer?.StatusId === "number"
              ? event.dataSoccer.StatusId
              : null;

          await prisma.matchEvent.upsert({
            where: {
              fixtureId_seq: {
                fixtureId: BigInt(event.fixtureId),
                seq: event.seq,
              },
            },

            update: {
              action: event.action,
              timestamp: BigInt(event.ts),
              statusId,
              confirmed: event.confirmed,
              payload: event as any,
            },

            create: {
              fixtureId: BigInt(event.fixtureId),
              seq: event.seq,
              action: event.action,
              timestamp: BigInt(event.ts),
              statusId,
              confirmed: event.confirmed,
              payload: event as any,
            },
          });

          logger.event(
            "scores.worker",
            `Saved seq=${event.seq} fixture=${event.fixtureId} action=${event.action} confirmed=${event.confirmed}`,
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