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
  const friendlies = await fixtureService.getFixtureSnapshot(undefined, 430);
  logger.info("check-live-state", `Friendlies fixtures: ${friendlies.length}`);
  for (const f of friendlies) {
    const kickoff = new Date(Number(f.StartTime));
    const etaH = ((Number(f.StartTime) - Date.now()) / 3_600_000).toFixed(1);
    console.log(`  [${f.FixtureId}] ${f.Participant1} v ${f.Participant2} — kickoff ${kickoff.toISOString()} (${etaH}h from now), gameState=${f.GameState}`);
  }

  const vnMy = friendlies.find(
    (f) => f.Participant1.includes("Vietnam") || f.Participant2.includes("Vietnam")
  );
  if (vnMy) {
    const odds = await oddsService.getOddsSnapshots(vnMy.FixtureId);
    logger.info("check-live-state", `Vietnam fixture ${vnMy.FixtureId} odds rows: ${odds.length}`);
    const preMatch = odds.filter((o) => !o.InRunning);
    console.log(`  pre-match rows: ${preMatch.length}`);
    for (const row of preMatch.slice(0, 10)) {
      console.log(`    SuperOddsType=${row.SuperOddsType} Period=${row.MarketPeriod} Params=${row.MarketParameters}`);
    }
  } else {
    logger.warn("check-live-state", "Vietnam v Myanmar fixture not found in Friendlies snapshot");
  }

  const worldCup = await fixtureService.getFixtureSnapshot(undefined, 72);
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
