import { prisma } from "@workspace/db";
import { OddsService, type OddsPayload } from "@workspace/txline";
import { processOddsUpdate } from "./odds.processor";

const oddsService = new OddsService();

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function getActiveFixtures() {
  const now = BigInt(Date.now());
  // Find fixtures that have a market and have not finished (e.g. start time in the future or within the last 3 hours)
  const threeHoursAgo = BigInt(Date.now() - 3 * 60 * 60 * 1000);
  
  const markets = await prisma.market.findMany({
    where: {
      status: "OPEN",
    },
    select: {
      fixtureId: true,
    }
  });

  const fixtureIds = markets.map(m => m.fixtureId);

  if (fixtureIds.length === 0) return [];

  return prisma.fixture.findMany({
    where: {
      fixtureId: { in: fixtureIds },
      startTime: { gt: threeHoursAgo },
    },
  });
}

function isRelevantOddsMarket(odds: OddsPayload) {
  return (
    odds.SuperOddsType === "OVERUNDER_PARTICIPANT_GOALS" &&
    odds.MarketParameters === "line=2.5" &&
    !odds.MarketPeriod // null or undefined
  );
}

export async function syncFixtureOdds(fixtureId: bigint) {
  const odds = await oddsService.getOddsSnapshots(Number(fixtureId));
  
  if (!odds) return;

  const relevant = odds.filter(isRelevantOddsMarket);

  for (const update of relevant) {
    await processOddsUpdate(update);
  }
}

export async function startOddsWorker() {
  console.log("[odds-worker] Started");

  while (true) {
    try {
      const fixtures = await getActiveFixtures();

      for (const fixture of fixtures) {
        await syncFixtureOdds(fixture.fixtureId);
      }
    } catch (error) {
      console.error("[odds-worker] Error:", error);
    }

    await sleep(10_000);
  }
}
