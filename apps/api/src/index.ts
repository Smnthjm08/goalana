dotenv.config({ path: "../../.env" })

import express from "express"
import cors from "cors"
import { startFixtureCron, syncFixtures } from "./crons/fixtures.cron";
import { startScoresWorker } from "./workers/scorer.worker";
import { prisma } from "@workspace/db";
import { FixtureService } from "@workspace/txline";
import dotenv from "dotenv";



import { startOddsWorker } from "./workers/odds.worker";

const app = express();
const port = process.env.BE_PORT ?? 8080


app.use(express.json());
app.use(cors({ origin: "http://localhost:3000" }))

console.log("sssss", process.env.TXLINE_ENV)

app.get("/", async (req, res) => {
  res.json({ status: "healthy!" })
})

app.post("/api/fixtures/sync", async (req, res) => {
  await syncFixtures();

  res.json({
    success: true,
  });
});


app.listen(port, async () => {
  console.log(`Listening on port ${port}...`)

  // Bootstrap first
  await syncFixtures();

  // Then schedule future syncs
  startFixtureCron();

  // Then connect live streams
  void startScoresWorker();
  void startOddsWorker();
})
