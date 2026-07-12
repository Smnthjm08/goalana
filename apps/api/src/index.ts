import express from "express";
import cors from "cors";
import dotenv from "dotenv";

import { prisma } from "@workspace/db";
import { startFixtureCron, syncFixtures } from "./crons/fixtures.cron";
import { startScoresWorker } from "./workers/scorer.worker";
import { startOddsWorker } from "./workers/odds.worker";

dotenv.config({ path: "../../.env" });

const app = express();
const port = process.env.BE_PORT ?? 8080;

// Serialize Prisma BigInt values globally
app.set("json replacer", (_key: string, value: unknown) => {
  return typeof value === "bigint" ? value.toString() : value;
});

app.use(express.json());
app.use(cors({ origin: "http://localhost:3000" }));

console.log("sssss", process.env.TXLINE_ENV);

app.get("/", async (req, res) => {
  res.json({ status: "healthy!" });
});

app.get("/api/data/", async (_req, res) => {
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
    console.error(error);

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

app.listen(port, async () => {
  console.log(`Listening on port ${port}...`);

  await syncFixtures();
  startFixtureCron();

  void startScoresWorker();
  void startOddsWorker();
});