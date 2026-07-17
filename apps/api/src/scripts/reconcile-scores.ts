import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { reconcileLiveFixtures } from "../workers/scores.backfill.js";
import { logger } from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

// Also runs automatically on every API process boot (see bootstrap() in
// index.ts) — this standalone entry point exists so `deploy.sh` can run it
// explicitly right after `pm2 reload` and show the result in the deploy
// log, rather than relying on scrolling through app logs to confirm a
// restart didn't drop any in-progress match's events.
async function run() {
  logger.info("reconcile-scores", "Reconciling all in-progress fixtures...");

  try {
    await reconcileLiveFixtures();
    logger.success("reconcile-scores", "Reconciliation complete.");
  } catch (error) {
    logger.error("reconcile-scores", "Reconciliation failed", error);
    process.exit(1);
  }

  process.exit(0);
}

run();
