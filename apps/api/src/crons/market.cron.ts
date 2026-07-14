import cron from "node-cron";
import { processMarketsForUpcomingFixtures } from "../services/market.service";
import { logger } from "../utils/logger";

export async function createTodayMarket() {
  logger.info("market.cron", "Checking markets...");
  try {
    await processMarketsForUpcomingFixtures();
  } catch (error) {
    logger.error("market.cron", "Failed", error);
  }
}

export function startMarketCron() {
  cron.schedule("*/10 * * * *", () => {
    void createTodayMarket();
  });
  logger.info("market.cron", "Scheduled every 10 minutes");
}
