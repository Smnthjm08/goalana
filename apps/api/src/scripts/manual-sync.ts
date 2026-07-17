import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { syncFixtures } from "../crons/fixtures.cron.js";
import { createTodayMarket } from "../crons/market.cron.js";
import { logger } from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

async function run() {
  logger.info("manual-sync", "Starting explicit manual sync...");

  try {
    logger.info("manual-sync", "1. Syncing fixtures...");
    await syncFixtures();
    logger.info("manual-sync", "Fixtures synced successfully.");
  } catch (error) {
    logger.error("manual-sync", "Fixture sync failed", error);
  }

  try {
    logger.info("manual-sync", "2. Creating today's markets...");
    await createTodayMarket();
    logger.info("manual-sync", "Markets created successfully.");
  } catch (error) {
    logger.error("manual-sync", "Market creation failed", error);
  }

  logger.info("manual-sync", "Manual sync complete. Exiting...");
  process.exit(0);
}

run();
