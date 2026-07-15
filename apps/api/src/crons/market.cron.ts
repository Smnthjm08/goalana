import cron from "node-cron";
import { processMarketsForUpcomingFixtures } from "../services/market.service";
import { logger } from "../utils/logger";

let isRunning = false;

export async function createTodayMarket() {
  if (isRunning) {
    logger.warn("market.cron", "Previous market creation run still in progress. Skipping.");
    return;
  }

  isRunning = true;
  logger.info("market.cron", "Checking markets...");
  try {
    await processMarketsForUpcomingFixtures();
  } catch (error) {
    logger.error("market.cron", "Failed", error);
  } finally {
    isRunning = false;
  }
}

export function startMarketCron() {
  cron.schedule("*/10 * * * *", () => {
    void createTodayMarket();
  });
  logger.info("market.cron", "Scheduled every 10 minutes");
}
