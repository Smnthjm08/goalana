import cron from "node-cron";
import { lockDueMarkets } from "../services/lock.service";
import { settleFinishedFixtures } from "../services/settlement.service";
import { logger } from "../utils/logger";

let isRunning = false;

// Locking and settlement are both time-sensitive (kickoff, full-time) and
// cheap to check (a handful of markets today), so both run on the same
// tighter cadence — unlike market discovery's 10-minute cron, which only
// needs to catch newly-announced fixtures.
export async function runLifecycleTick() {
  if (isRunning) {
    logger.warn("lifecycle.cron", "Previous lifecycle tick still in progress. Skipping.");
    return;
  }

  isRunning = true;
  try {
    await lockDueMarkets();
    await settleFinishedFixtures();
  } catch (error) {
    logger.error("lifecycle.cron", "Failed", error);
  } finally {
    isRunning = false;
  }
}

export function startLifecycleCron() {
  cron.schedule("* * * * *", () => {
    void runLifecycleTick();
  });
  logger.info("lifecycle.cron", "Scheduled every 1 minute");
}
