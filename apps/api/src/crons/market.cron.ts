import cron from "node-cron";
import { processMarketsForUpcomingFixtures } from "../services/market.service";

export async function createTodayMarket() {
  console.log("[market.cron] Checking markets...");
  try {
    await processMarketsForUpcomingFixtures();
  } catch (error) {
    console.error("[market.cron] Failed:", error);
  }
}

export function startMarketCron() {
  cron.schedule("*/10 * * * *", () => {
    void createTodayMarket();
  });
  console.log("[market.cron] Scheduled every 10 minutes");
}
