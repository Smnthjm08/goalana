import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { startFixtureCron, syncFixtures } from "./crons/fixtures.cron";
import { createTodayMarket, startMarketCron } from "./crons/market.cron";
import { startLifecycleCron } from "./crons/lifecycle.cron";
import { startScoresWorker } from "./workers/scorer.worker";
import { reconcileLiveFixtures } from "./workers/scores.backfill";
import { startOddsWorker } from "./workers/odds.worker";
import { registerRoutes } from "./routes";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "./utils/logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const requiredEnv = [
  "DATABASE_URL",
  "TXLINE_API_ORIGIN",
  "SOLANA_RPC_URL",
  "TXLINE_JWT",
  "TXLINE_API_TOKEN",
  "WALLET_PRIVATE_KEY",
  // CORS origin (below) silently falls back to localhost:3000 if unset —
  // in a deployed environment that means every browser request from the
  // real frontend gets blocked with no server-side signal at all. Fail at
  // boot instead of failing silently in a judge's browser console.
  "NEXT_PUBLIC_SITE_URL",
] as const;

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const app = express();
const port = process.env.BE_PORT ?? 8080;

// Serialize Prisma BigInt values globally
app.set("json replacer", (_key: string, value: unknown) => {
  return typeof value === "bigint" ? value.toString() : value;
});

app.use(express.json());

// Guaranteed set by the requiredEnv check above — no silent fallback here,
// since a wrong/missing origin fails as an unexplained CORS block in the
// browser, not a server-side error anyone would see.
const frontendUrl = process.env.NEXT_PUBLIC_SITE_URL as string;
app.use(cors({ origin: frontendUrl }));

registerRoutes(app);

const oddsWorkerController = new AbortController();
const scoresWorkerController = new AbortController();

function shutdown(signal: string) {
  logger.warn("bootstrap", `Received ${signal}, shutting down stream workers...`);
  oddsWorkerController.abort();
  scoresWorkerController.abort();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

async function bootstrap() {
  logger.info("bootstrap", "Starting Goalana backend");

  if (process.env.API_ONLY === "true") {
    logger.info("bootstrap", "Running in API-only mode. Skipping crons and workers.");
    logger.success("bootstrap", "Goalana backend ready (API Only)");
    return;
  }

  // 1. Fixture snapshot
  try {
    await syncFixtures();
  } catch (error) {
    logger.error("bootstrap", "Fixture sync failed", error);
  }

  // 2. Fetch odds and create supported Goalana markets
  try {
    await createTodayMarket();
  } catch (error) {
    logger.error("bootstrap", "Market creation failed", error);
  }

  // 3. Catch up any fixture that was already mid-match when this process
  // started (deploy restart, crash, manual restart, etc.) — the live scores
  // worker's SSE resume position only lives in memory, so a restart alone
  // would otherwise leave a silent gap in that fixture's match events.
  try {
    await reconcileLiveFixtures();
  } catch (error) {
    logger.error("bootstrap", "Live fixture reconciliation failed", error);
  }

  // 4. Start scheduled fixture refresh
  startFixtureCron();

  // 5. Periodically discover/create missing markets
  startMarketCron();

  // 6. Lock markets at kickoff, settle markets once their fixture is final
  startLifecycleCron();

  // 7. Start live workers
  void startOddsWorker(oddsWorkerController.signal).catch((error) => {
    logger.error("odds-worker", "Fatal error", error);
  });

  void startScoresWorker(scoresWorkerController.signal).catch((error) => {
    logger.error("scores-worker", "Fatal error", error);
  });

  logger.success("bootstrap", "Goalana backend ready");
}

app.listen(port, () => {
  logger.info("api", `Listening on port ${port}...`);

  void bootstrap().catch((error) => {
    logger.error("bootstrap", "Fatal", error);
    process.exit(1);
  });
});
