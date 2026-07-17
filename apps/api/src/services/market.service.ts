import { prisma } from "@workspace/db";
import { OddsService, type OddsPayload } from "@workspace/txline";
import { type Predicate, TXLINE_STAT_KEYS } from "@workspace/goalana-sdk";
import { createMarketForFixture, initializeGoalanaConfig } from "./goalana.service";
import { SUPPORTED_MARKETS } from "./market-definitions";
import { logger } from "../utils/logger";
import { getActiveCompetitionId } from "../config/competition";

const oddsService = new OddsService();

export type GoalanaMarketType = keyof typeof SUPPORTED_MARKETS;

export interface DiscoveredMarket {
  fixtureId: bigint;
  type: GoalanaMarketType;
  question: string;
  referenceProbability: {
    yesPct: number;
    noPct: number;
  } | null;
  source: {
    messageId: string;
    timestamp: bigint;
    superOddsType: string;
    marketPeriod: string;
    marketParameters: string;
  };
  predicate: Predicate | null;
  supportedForCreation: boolean;
  unsupportedReason?: string;
}

function extractProbability(market: OddsPayload, yesKey: string, noKey: string) {
  if (!market.PriceNames || !market.Pct) return null;
  const yesIndex = market.PriceNames.indexOf(yesKey);
  const noIndex = market.PriceNames.indexOf(noKey);
  if (yesIndex === -1 || noIndex === -1) return null;
  
  return {
    yesPct: Number(market.Pct[yesIndex]),
    noPct: Number(market.Pct[noIndex]),
  };
}

function toBinaryProbability(yesPct: number) {
  return {
    yesPct,
    noPct: 100 - yesPct,
  };
}

function extract1X2Probability(market: OddsPayload, targetOutcome: "part1" | "draw" | "part2") {
  if (!market.PriceNames || !market.Pct) return null;
  const targetIndex = market.PriceNames.indexOf(targetOutcome);
  if (targetIndex === -1) return null;
  return toBinaryProbability(Number(market.Pct[targetIndex]));
}

/**
 * Computes a market's *current* TxLINE reference probability from its matching
 * `Odds` row (current-state table, one row per logical market identity).
 *
 * Reuses the same extraction logic as `discoverMarketsForFixture` so the
 * "opening" (at creation time) and "current" reference numbers are derived
 * identically — this is TxLINE reference data only, never Goalana's on-chain
 * pool split.
 */
export function computeCurrentReferenceProbability(
  marketType: string,
  odds: { priceNames: unknown; probabilities: unknown } | null | undefined
): { yesPct: number; noPct: number } | null {
  if (!odds) return null;

  const priceNames = odds.priceNames as string[] | null;
  const probabilities = odds.probabilities as string[] | null;
  if (!priceNames || !probabilities) return null;

  const row = { PriceNames: priceNames, Pct: probabilities } as Pick<OddsPayload, "PriceNames" | "Pct"> as OddsPayload;

  switch (marketType) {
    case "FULL_TIME_HOME_WIN":
      return extract1X2Probability(row, "part1");
    case "FULL_TIME_DRAW":
      return extract1X2Probability(row, "draw");
    case "FULL_TIME_AWAY_WIN":
      return extract1X2Probability(row, "part2");
    case "FULL_TIME_OVER_1_5":
    case "FULL_TIME_OVER_2_5":
    case "FULL_TIME_OVER_3_5":
      return extractProbability(row, "over", "under");
    default:
      return null;
  }
}

function generateQuestion(template: string, participant1: string, participant2: string) {
  return template
    .replace("{participant1}", participant1)
    .replace("{participant2}", participant2);
}

// Same safe predicate shape for every supported Over line: total goals (HOME_GOALS + AWAY_GOALS)
// compared against an integer threshold. Only the TxLINE line/threshold pair changes.
const OVER_UNDER_MARKETS = [
  SUPPORTED_MARKETS.FULL_TIME_OVER_1_5,
  SUPPORTED_MARKETS.FULL_TIME_OVER_2_5,
  SUPPORTED_MARKETS.FULL_TIME_OVER_3_5,
] as const;

export function discoverMarketsForFixture(
  fixture: { fixtureId: bigint; participant1: string; participant2: string },
  oddsRows: OddsPayload[]
): DiscoveredMarket[] {
  // 1. Group by logical market identity
  const logicalMarkets = new Map<string, OddsPayload>();

  for (const row of oddsRows) {
    if (row.InRunning) continue; // Only process pre-match odds for creation

    const period = row.MarketPeriod || "";
    const params = row.MarketParameters || "";
    const key = `${row.SuperOddsType}|${period}|${params}`;

    const existing = logicalMarkets.get(key);
    // 2. Select latest row by Ts
    if (!existing || row.Ts > existing.Ts) {
      logicalMarkets.set(key, row);
    }
  }

  const discovered: DiscoveredMarket[] = [];

  for (const row of logicalMarkets.values()) {
    const period = row.MarketPeriod || "";
    const params = row.MarketParameters || "";

    const baseSource = {
      messageId: row.MessageId,
      timestamp: BigInt(row.Ts),
      superOddsType: row.SuperOddsType,
      marketPeriod: period,
      marketParameters: params,
    };

    // FULL_TIME_OVER_1_5 / 2_5 / 3_5 — identical predicate shape, only the line/threshold differs.
    for (const marketDef of OVER_UNDER_MARKETS) {
      if (
        row.SuperOddsType === marketDef.txline.superOddsType &&
        params === marketDef.txline.marketParameters &&
        period === marketDef.txline.marketPeriod
      ) {
        discovered.push({
          fixtureId: fixture.fixtureId,
          type: marketDef.type,
          question: marketDef.label,
          referenceProbability: extractProbability(row, "over", "under"),
          source: baseSource,
          predicate: {
            statAKey: TXLINE_STAT_KEYS.HOME_GOALS,
            statBKey: TXLINE_STAT_KEYS.AWAY_GOALS,
            op: { add: {} },
            threshold: marketDef.threshold,
            comparison: { greaterThan: {} },
          },
          supportedForCreation: true,
        });
      }
    }

    // 1X2 FULL TIME (Home Win, Draw, Away Win)
    if (
      row.SuperOddsType === SUPPORTED_MARKETS.FULL_TIME_HOME_WIN.txline.superOddsType &&
      params === SUPPORTED_MARKETS.FULL_TIME_HOME_WIN.txline.marketParameters &&
      period === SUPPORTED_MARKETS.FULL_TIME_HOME_WIN.txline.marketPeriod
    ) {
      // Home Win
      discovered.push({
        fixtureId: fixture.fixtureId,
        type: "FULL_TIME_HOME_WIN",
        question: generateQuestion(SUPPORTED_MARKETS.FULL_TIME_HOME_WIN.label, fixture.participant1, fixture.participant2),
        referenceProbability: extract1X2Probability(row, "part1"),
        source: baseSource,
        predicate: {
          statAKey: TXLINE_STAT_KEYS.HOME_GOALS,
          statBKey: TXLINE_STAT_KEYS.AWAY_GOALS,
          op: { subtract: {} },
          threshold: 0,
          comparison: { greaterThan: {} },
        },
        supportedForCreation: true,
      });

      // Draw
      discovered.push({
        fixtureId: fixture.fixtureId,
        type: "FULL_TIME_DRAW",
        question: generateQuestion(SUPPORTED_MARKETS.FULL_TIME_DRAW.label, fixture.participant1, fixture.participant2),
        referenceProbability: extract1X2Probability(row, "draw"),
        source: baseSource,
        predicate: {
          statAKey: TXLINE_STAT_KEYS.HOME_GOALS,
          statBKey: TXLINE_STAT_KEYS.AWAY_GOALS,
          op: { subtract: {} },
          threshold: 0,
          comparison: { equalTo: {} },
        },
        supportedForCreation: true,
      });

      // Away Win
      discovered.push({
        fixtureId: fixture.fixtureId,
        type: "FULL_TIME_AWAY_WIN",
        question: generateQuestion(SUPPORTED_MARKETS.FULL_TIME_AWAY_WIN.label, fixture.participant1, fixture.participant2),
        referenceProbability: extract1X2Probability(row, "part2"),
        source: baseSource,
        predicate: {
          statAKey: TXLINE_STAT_KEYS.HOME_GOALS,
          statBKey: TXLINE_STAT_KEYS.AWAY_GOALS,
          op: { subtract: {} },
          threshold: 0,
          comparison: { lessThan: {} },
        },
        supportedForCreation: true,
      });
    }
  }

  return discovered;
}

export async function processMarketsForUpcomingFixtures() {
  await initializeGoalanaConfig();

  const competitionId = await getActiveCompetitionId();
  const now = Date.now();
  const until = now + 24 * 60 * 60 * 1000;

  // 1. Find upcoming fixtures (next 24 hours)
  const fixtures = await prisma.fixture.findMany({
    where: {
      competitionId,
      startTime: {
        gt: BigInt(now),
        lte: BigInt(until),
      },
    },
    orderBy: {
      startTime: "asc",
    },
    take: 10, // Process in batches
  });

  if (fixtures.length === 0) {
    logger.info("market.service", "No upcoming fixtures found in window");
    return [];
  }

  const results = [];

  for (const fixture of fixtures) {
    logger.info("market.service", `Processing Fixture: ${fixture.fixtureId} ${fixture.participant1} vs ${fixture.participant2}`);

    // 2. Fetch TxLINE odds
    const oddsRows = await oddsService.getOddsSnapshots(Number(fixture.fixtureId));

    if (!oddsRows || oddsRows.length === 0) {
      logger.info("market.service", `No odds found for fixture ${fixture.fixtureId}`);
      continue;
    }

    // 3. Discover markets
    const discoveredMarkets = discoverMarketsForFixture(fixture, oddsRows);
    
    // 4. Create supported markets
    for (const market of discoveredMarkets) {
      if (!market.supportedForCreation || !market.predicate || !market.referenceProbability) {
        continue; // Skip unsupported or malformed markets
      }

      logger.event("market.service", `Discovered market: ${market.type} (${market.question})`);

      try {
        // Determine market times.
        //
        // settle_after only needs to rule out a pre-match/stale proof — it is
        // NOT what decides *whether* a match is over (that's finalSeq, set by
        // scores.processor.ts once the live feed confirms a terminal event,
        // and checked off-chain before settlement is ever attempted). The
        // on-chain check (`oracle_ts_secs >= market.settle_after`,
        // settle_market.rs) tests the *proof's own* stat-event timestamp —
        // confirmed empirically against a completed fixture (18241006,
        // England 1-2 Argentina): TxLINE's stat-validation `ts` exactly
        // equals the underlying goal event's own timestamp, not a later
        // root-computation time. A real match's last scoring event lands
        // well within ~2h of kickoff, so a 3h buffer made the check
        // impossible to ever satisfy with a genuine proof. A small
        // post-kickoff buffer is enough to reject a pre-match proof while
        // staying satisfiable by any real in-match event.
        const locksAt = new Date(Number(fixture.startTime));
        const settleAfter = new Date(locksAt.getTime() + 15 * 60 * 1000);

        // Create market on Solana
        const result = await createMarketForFixture(
          fixture.fixtureId,
          market.predicate,
          locksAt,
          settleAfter
        );

        logger.success("market.service", `Created on-chain PDA: ${result.marketPda.toBase58()} (already exists: ${result.alreadyExists})`);

        // Store market in DB
        if (result.marketPda) {
          await prisma.market.upsert({
            where: { marketPda: result.marketPda.toBase58() },
            update: {
              initialYesPct: market.referenceProbability.yesPct,
              initialNoPct: market.referenceProbability.noPct,
              sourceOddsMessageId: market.source.messageId,
            }, // Could update probabilities or metadata if needed
            create: {
              fixtureId: fixture.fixtureId,
              marketPda: result.marketPda.toBase58(),
              predicateHash: Array.from(result.predicateHash || []).join(','),
              marketType: market.type,
              question: market.question,
              locksAt,
              settleAfter,
              creationTx: result.txSignature,
              sourceOddsMessageId: market.source.messageId,
              initialYesPct: market.referenceProbability.yesPct,
              initialNoPct: market.referenceProbability.noPct,
              status: "OPEN"
            }
          });
        }

        results.push({ fixtureId: fixture.fixtureId, market, result });
      } catch (error) {
        // One market/fixture failing to create (RPC hiccup, transient
        // on-chain error) must not abort discovery for the rest of the
        // batch — already-created markets are skipped next tick via the
        // on-chain existence check in createMarketForFixture, so retrying
        // is safe and cheap.
        logger.error(
          "market.service",
          `Failed to create market ${market.type} for fixture ${fixture.fixtureId}`,
          error
        );
      }
    }
  }

  return results;
}
