import { prisma } from "@workspace/db";
import { OddsService, type OddsPayload } from "@workspace/txline";
import { type Predicate, TXLINE_STAT_KEYS } from "@workspace/goalana-sdk";
import { createMarketForFixture, initializeGoalanaConfig } from "./goalana.service";
import { SUPPORTED_MARKETS } from "./market-definitions";

const oddsService = new OddsService();

export interface GoalanaReferenceOdds {
  fixtureId: bigint;
  marketType: "TOTAL_GOALS_OVER_2_5";
  yesPct: number;
  noPct: number;
  sourceMessageId: string;
  sourceTimestamp: bigint;
}

export function mapOver25Odds(market: OddsPayload): GoalanaReferenceOdds {
  if (!market.PriceNames || !market.Pct) {
    throw new Error("Missing PriceNames or Pct in market");
  }

  const overIndex = market.PriceNames.indexOf("over");
  const underIndex = market.PriceNames.indexOf("under");

  if (overIndex === -1 || underIndex === -1) {
    throw new Error("Invalid Over/Under market");
  }

  return {
    fixtureId: BigInt(market.FixtureId),
    marketType: "TOTAL_GOALS_OVER_2_5",
    yesPct: Number(market.Pct[overIndex]),
    noPct: Number(market.Pct[underIndex]),
    sourceMessageId: market.MessageId,
    sourceTimestamp: BigInt(market.Ts),
  };
}

export async function createMarketForUpcomingFixture() {
  await initializeGoalanaConfig();

  const now = BigInt(Date.now());

  // 1. Find upcoming fixture
  const fixture = await prisma.fixture.findFirst({
    where: {
      startTime: { gt: now },
    },
    orderBy: {
      startTime: "asc",
    },
  });

  if (!fixture) {
    console.log("[market] No upcoming fixture");
    return;
  }

  console.log(`[market] Fixture: ${fixture.fixtureId} ${fixture.participant1} vs ${fixture.participant2}`);

  // 2. Fetch TxLINE odds
  const odds = await oddsService.getOddsSnapshots(Number(fixture.fixtureId));

  if (!odds || odds.length === 0) {
    console.log("[market] No odds found for fixture");
    return;
  }

  // 3. Find supported market
  const over25 = odds.find(
    (market) =>
      market.SuperOddsType === "OVERUNDER_PARTICIPANT_GOALS" &&
      market.MarketParameters === "line=2.5" &&
      !market.MarketPeriod && // MarketPeriod might be null or undefined
      market.InRunning === false
  );

  if (!over25) {
    console.log("[market] No full-time Over 2.5 market available");
    return;
  }

  console.log("[market] Found Over 2.5 market:", {
    messageId: over25.MessageId,
    timestamp: over25.Ts,
    prices: over25.Prices,
    percentages: over25.Pct,
  });

  // Map odds
  const refOdds = mapOver25Odds(over25);

  // 4. Construct settlement predicate
  const predicate: Predicate = {
    statAKey: TXLINE_STAT_KEYS.HOME_GOALS,
    statBKey: TXLINE_STAT_KEYS.AWAY_GOALS,
    op: { add: {} },
    threshold: 2,
    comparison: { greaterThan: {} },
  };

  // 5. Determine market times
  const locksAt = new Date(Number(fixture.startTime));
  const settleAfter = new Date(locksAt.getTime() + 3 * 60 * 60 * 1000);

  // 6. Create market on Solana
  const result = await createMarketForFixture(
    fixture.fixtureId,
    predicate,
    locksAt,
    settleAfter
  );

  console.log("[market] Result:", {
    marketPda: result.marketPda.toBase58(),
    transaction: result.txSignature,
  });

  // 7. Store market in DB
  if (result.marketPda) {
    await prisma.market.upsert({
      where: { marketPda: result.marketPda.toBase58() },
      update: {},
      create: {
        fixtureId: fixture.fixtureId,
        marketPda: result.marketPda.toBase58(),
        predicateHash: Array.from(result.predicateHash || []).join(','),
        marketType: refOdds.marketType,
        question: SUPPORTED_MARKETS.TOTAL_GOALS_OVER_2_5.label,
        locksAt,
        settleAfter,
        creationTx: result.txSignature,
        sourceOddsMessageId: refOdds.sourceMessageId,
        initialYesPct: refOdds.yesPct,
        initialNoPct: refOdds.noPct,
        status: "OPEN"
      }
    });
  }

  return {
    fixture,
    referenceOdds: over25,
    ...result,
  };
}
