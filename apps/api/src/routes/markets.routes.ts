import { Router, type Router as RouterType } from "express";

import { prisma } from "@workspace/db";
import { computeCurrentReferenceProbability } from "../services/market.service";
import { SUPPORTED_MARKETS } from "../services/market-definitions";
import { logger } from "../utils/logger";

export const marketsRouter: RouterType = Router();

// Flat market index for the wallet-scoped /positions page. A position is an
// on-chain Position PDA that only knows its Market pubkey — this supplies the
// off-chain metadata (question, fixture, lifecycle txs) to join against, in one
// request instead of a fixture-by-fixture fan-out. Read-only; on-chain state
// (pools, status, outcome) is still read from the chain by the client.
marketsRouter.get("/api/markets", async (_req, res) => {
  try {
    const markets = await prisma.market.findMany({
      orderBy: { locksAt: "asc" },
      select: {
        id: true,
        marketPda: true,
        marketType: true,
        question: true,
        locksAt: true,
        settleAfter: true,
        creationTx: true,
        lockTx: true,
        settlementTx: true,
        status: true,
        initialYesPct: true,
        initialNoPct: true,
        fixedStakeLamports: true,
        slotsPerSide: true,
        fixture: {
          select: {
            fixtureId: true,
            competition: true,
            participant1: true,
            participant2: true,
            startTime: true,
            odds: {
              orderBy: { ts: "desc" },
              take: 20,
            },
          },
        },
      },
    });

    // Cross-market liquidity dashboard (item #3) needs the same "current
    // TxLINE reference probability" every other market view already shows —
    // computed here identically to /api/fixtures/:id and
    // /api/markets/:marketPda so all three surfaces agree. No new data
    // source: `fixture.odds` is the same current-state table those already
    // read, just fetched once per market's own fixture here.
    const withReference = markets.map((market) => {
      const { odds, ...fixtureRest } = market.fixture;
      const marketDef = (SUPPORTED_MARKETS as Record<string, { txline: { superOddsType: string; marketParameters: string; marketPeriod: string } }>)[market.marketType];
      const liveOdds = marketDef
        ? odds.find(
            (o) =>
              o.superOddsType === marketDef.txline.superOddsType &&
              o.marketParameters === marketDef.txline.marketParameters &&
              o.marketPeriod === marketDef.txline.marketPeriod
          )
        : undefined;
      const reference = computeCurrentReferenceProbability(market.marketType, liveOdds);

      return {
        ...market,
        currentYesPct: reference?.yesPct ?? market.initialYesPct,
        currentNoPct: reference?.noPct ?? market.initialNoPct,
        fixture: fixtureRest,
      };
    });

    return res.status(200).json({ data: withReference });
  } catch (error) {
    logger.error("api", "Error fetching markets", error);
    return res.status(500).json({ error: "internal server error" });
  }
});

// Single market by its on-chain PDA — the market details/share page's only
// off-chain read. Attaches the same live TxLINE reference probability as
// GET /api/fixtures/:id (computed from the fixture's current Odds row), so
// the page shows the same numbers whether it got here via the fixture or
// directly via a shared /market/:marketPda link.
marketsRouter.get("/api/markets/:marketPda", async (req, res) => {
  try {
    const { marketPda } = req.params;

    const market = await prisma.market.findUnique({
      where: { marketPda },
      include: {
        fixture: {
          include: {
            odds: {
              orderBy: { ts: "desc" },
            },
          },
        },
      },
    });

    if (!market) {
      return res.status(404).json({ error: "Market not found" });
    }

    const { odds, ...fixtureRest } = market.fixture;

    const marketDef = (SUPPORTED_MARKETS as Record<string, { txline: { superOddsType: string; marketParameters: string; marketPeriod: string } }>)[market.marketType];

    const liveOdds = marketDef
      ? odds.find(
          (o) =>
            o.superOddsType === marketDef.txline.superOddsType &&
            o.marketParameters === marketDef.txline.marketParameters &&
            o.marketPeriod === marketDef.txline.marketPeriod
        )
      : undefined;

    const reference = computeCurrentReferenceProbability(market.marketType, liveOdds);

    return res.status(200).json({
      data: {
        ...market,
        currentYesPct: reference?.yesPct ?? market.initialYesPct,
        currentNoPct: reference?.noPct ?? market.initialNoPct,
        fixture: fixtureRest,
      },
    });
  } catch (error) {
    logger.error("api", `Error fetching market ${req.params.marketPda}`, error);
    return res.status(500).json({ error: "internal server error" });
  }
});
