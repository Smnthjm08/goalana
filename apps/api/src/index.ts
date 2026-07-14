import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { prisma } from "@workspace/db";
import { startFixtureCron, syncFixtures } from "./crons/fixtures.cron";
import { createTodayMarket, startMarketCron } from "./crons/market.cron";
import { startScoresWorker } from "./workers/scorer.worker";
import { startOddsWorker } from "./workers/odds.worker";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "./utils/logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const requiredEnv = [
  "DATABASE_URL",
  "TXLINE_ENV",
  "SOLANA_RPC_URL",
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
app.use(cors({ origin: "http://localhost:3000" }));

app.get("/", async (req, res) => {
  res.json({ status: "healthy!" });
});

app.get("/health", async (req, res) => {
  res.status(200).json({ status: "UP", timestamp: new Date().toISOString() });
});

app.get(["/api/data/", "/api/fixtures"], async (_req, res) => {
  try {
    const data = await prisma.fixture.findMany({
      include: {
        odds: true,

        oddsHistories: {
          orderBy: {
            createdAt: "desc",
          },
          take: 100,
        },
      },
    });

    return res.status(200).json({ data });
  } catch (error) {
    logger.error("api", "Internal server error", error);

    return res.status(500).json({
      error: "internal server error",
    });
  }
});

app.post("/api/fixtures/sync", async (_req, res) => {
  await syncFixtures();

  res.json({
    success: true,
  });
});

async function bootstrap() {
  logger.info("bootstrap", "Starting Goalana backend");

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

  // 3. Start scheduled fixture refresh
  startFixtureCron();

  // 4. Periodically discover/create missing markets
  startMarketCron();

  // 5. Start live workers
  void startOddsWorker().catch((error) => {
    logger.error("odds-worker", "Fatal error", error);
  });

  void startScoresWorker().catch((error) => {
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