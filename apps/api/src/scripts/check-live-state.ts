import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { FixtureService, OddsService } from "@workspace/txline";
import { logger } from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

const fixtureService = new FixtureService();
const oddsService = new OddsService();

async function run() {
  const worldCup = await fixtureService.getFixtureSnapshot(undefined);
  const franceEngland = worldCup.find(
    (f) =>
      (f.Participant1.includes("France") && f.Participant2.includes("England")) ||
      (f.Participant1.includes("England") && f.Participant2.includes("France"))
  );
  if (franceEngland) {
    const kickoff = new Date(Number(franceEngland.StartTime));
    const etaH = ((Number(franceEngland.StartTime) - Date.now()) / 3_600_000).toFixed(1);
    logger.info(
      "check-live-state",
      `France v England [${franceEngland.FixtureId}]: kickoff ${kickoff.toISOString()} (${etaH}h from now), gameState=${franceEngland.GameState}`
    );
  } else {
    logger.warn("check-live-state", "France v England fixture not found in World Cup snapshot");
  }

  process.exit(0);
}

run();
