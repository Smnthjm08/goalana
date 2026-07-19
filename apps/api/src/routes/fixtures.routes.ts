import { Router, type Router as RouterType } from "express";

import { prisma } from "@workspace/db";
import { syncFixtures } from "../crons/fixtures.cron";
import { computeCurrentReferenceProbability } from "../services/market.service";
import { getSettlementProofPreview } from "../services/settlement.service";
import { SUPPORTED_MARKETS } from "../services/market-definitions";
import { getMatchTimeline, getCornerTally, formatMinute } from "../services/match-timeline.service";
import { parseFixtureId } from "../utils/parse-fixture-id";
import { logger } from "../utils/logger";

export const fixturesRouter: RouterType = Router();

fixturesRouter.get("/api/fixtures", async (_req, res) => {
  try {
    const data = await prisma.fixture.findMany({
      orderBy: {
        startTime: "asc",
      },
      // proofIntegrity carries full program logs per case — useful on a single
      // fixture, pure dead weight on a list nothing renders it from.
      omit: {
        proofIntegrity: true,
      },
      include: {
        _count: {
          select: { markets: true },
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

fixturesRouter.get("/api/fixtures/:id", async (req, res) => {
  try {
    const fixtureIdStr = req.params.id;
    const fixtureId = parseFixtureId(fixtureIdStr);
    if (fixtureId === null) {
      return res.status(400).json({ error: "fixture id must be numeric" });
    }

    const fixture = await prisma.fixture.findUnique({
      where: {
        fixtureId,
      },
      include: {
        markets: true,
        odds: {
          orderBy: {
            ts: "desc",
          }
        },
      },
    });

    if (!fixture) {
      return res.status(404).json({ error: "Fixture not found" });
    }

    // Live score/status/clock come from the canonical fields scores.processor
    // maintains on Fixture — never from counting/serializing raw MatchEvent
    // rows. The normalized, deduplicated timeline is a separate read built
    // from those raw rows by match-timeline.service, but raw rows themselves
    // are never sent to the client (audit-only).
    const isFinal = fixture.finalSeq !== null;
    const minuteLabel = isFinal
      ? "FT"
      : fixture.livePeriodLabel === "HT"
        ? "HT"
        : formatMinute(fixture.clockSeconds, fixture.liveStatusId).label;

    const liveScore = {
      homeScore: fixture.homeScore,
      awayScore: fixture.awayScore,
      statusId: fixture.liveStatusId,
      periodLabel: fixture.livePeriodLabel,
      clockSeconds: fixture.clockSeconds,
      clockRunning: fixture.clockRunning,
      minuteLabel,
      isFinal,
      lastUpdate: fixture.lastEventTs !== null ? fixture.lastEventTs.toString() : null,
    };

    const events = await getMatchTimeline(fixtureId);
    const corners = await getCornerTally(fixtureId);

    // Attach each market's *current* TxLINE reference probability (from the
    // already-fetched `odds` current-state rows) alongside the frozen
    // `initialYesPct`/`initialNoPct` captured at creation time. No extra
    // query — `odds` is already included above.
    const marketsWithLiveReference = fixture.markets.map((market) => {
      const marketDef = (SUPPORTED_MARKETS as Record<string, { txline: { superOddsType: string; marketParameters: string; marketPeriod: string } }>)[market.marketType];

      const liveOdds = marketDef
        ? fixture.odds.find(
            (odds) =>
              odds.superOddsType === marketDef.txline.superOddsType &&
              odds.marketParameters === marketDef.txline.marketParameters &&
              odds.marketPeriod === marketDef.txline.marketPeriod
          )
        : undefined;

      const reference = computeCurrentReferenceProbability(market.marketType, liveOdds);

      return {
        ...market,
        currentYesPct: reference?.yesPct ?? market.initialYesPct,
        currentNoPct: reference?.noPct ?? market.initialNoPct,
      };
    });

    return res.status(200).json({
      data: { ...fixture, markets: marketsWithLiveReference, liveScore, events, corners },
    });
  } catch (error) {
    logger.error("api", `Error fetching fixture ${req.params.id}`, error);
    return res.status(500).json({ error: "internal server error" });
  }
});

fixturesRouter.get("/api/fixtures/:id/odds/history", async (req, res) => {
  try {
    const fixtureIdStr = req.params.id;
    const fixtureId = parseFixtureId(fixtureIdStr);
    if (fixtureId === null) {
      return res.status(400).json({ error: "fixture id must be numeric" });
    }

    // Fetch all odds histories for this fixture
    const histories = await prisma.oddsHistory.findMany({
      where: { fixtureId },
      orderBy: { ts: "asc" }
    });

    // Find the 1X2 market (Home, Draw, Away) - Full Time
    const firstMatch = histories.find(h => {
       const names = h.priceNames as string[];
       return h.superOddsType === "1X2_PARTICIPANT_RESULT" && h.marketPeriod === "";
    });

    if (!firstMatch) {
       return res.status(200).json({ data: null });
    }

    const targetType = firstMatch.superOddsType;
    const filteredHistories = histories.filter(h =>
      h.superOddsType === targetType &&
      h.marketPeriod === "" &&
      !(h.probabilities as string[]).includes("NA")
    );

    // Map and parse probabilities
    const historyData = filteredHistories.map(h => {
       const probs = h.probabilities as string[];
       const names = h.priceNames as string[];

       // TXLine uses part1, draw, part2 for 1X2 markets
       const idx1 = names.indexOf("part1");
       const idxX = names.indexOf("draw");
       const idx2 = names.indexOf("part2");

       return {
         timestamp: Number(h.ts),
         home: parseFloat(probs[idx1] || "0"),
         draw: parseFloat(probs[idxX] || "0"),
         away: parseFloat(probs[idx2] || "0")
       };
    });

    // Remove duplicates based on consecutive identical probabilities
    const deduplicated = [];
    let lastProbs = "";
    for (const h of historyData) {
       const currentProbs = `${h.home.toFixed(4)}-${h.draw.toFixed(4)}-${h.away.toFixed(4)}`;
       if (currentProbs !== lastProbs) {
          deduplicated.push(h);
          lastProbs = currentProbs;
       }
    }

    if (deduplicated.length === 0) {
      return res.status(200).json({ data: null });
    }

    const opening = deduplicated[0]!;
    const latest = deduplicated[deduplicated.length - 1]!;

    return res.status(200).json({
      data: {
        fixtureId: fixtureIdStr,
        market: "MATCH_RESULT",
        opening: { home: opening.home, draw: opening.draw, away: opening.away },
        latest: { home: latest.home, draw: latest.draw, away: latest.away },
        history: deduplicated
      }
    });

  } catch (error) {
    logger.error("api", `Error fetching odds history for fixture ${req.params.id}`, error);
    return res.status(500).json({ error: "internal server error" });
  }
});

// Live TxLINE Merkle-proof preview for a finished fixture — the exact proof
// our settle_market CPI verifies on-chain, fetched fresh from TxLINE and
// returned in the settlement-receipt shape (no on-chain settle involved). Lets
// the frontend render a verifiable proof for any final match even when none of
// our own markets settled it. See settlement.service.getSettlementProofPreview.
fixturesRouter.get("/api/fixtures/:id/proof-preview", async (req, res) => {
  try {
    const fixtureId = parseFixtureId(req.params.id);
    if (fixtureId === null) {
      return res.status(400).json({ error: "fixture id must be numeric" });
    }
    const preview = await getSettlementProofPreview(fixtureId);

    if (!preview) {
      return res.status(404).json({ error: "No proof available (fixture not final or unpriced by TxLINE)" });
    }

    return res.status(200).json({ data: preview });
  } catch (error) {
    logger.error("api", `Error building proof preview for fixture ${req.params.id}`, error);
    return res.status(500).json({ error: "internal server error" });
  }
});

// Manual ops trigger only — no cron or frontend code calls this in-process
// (crons import syncFixtures() directly). Left open it's a free way for
// anyone to burn TxLINE API quota, so it's gated behind the same secret an
// operator already has to configure the deploy with.
fixturesRouter.post("/api/fixtures/sync", async (req, res) => {
  const adminSecret = process.env.ADMIN_SYNC_SECRET;
  if (adminSecret && req.headers["x-admin-secret"] !== adminSecret) {
    return res.status(401).json({ success: false, error: "unauthorized" });
  }

  try {
    const result = await syncFixtures();

    if (!result.success) {
      return res.status(502).json({
        success: false,
        error: result.reason ?? "Fixture sync failed",
      });
    }

    return res.json({ success: true });
  } catch (error) {
    logger.error("api", "Error syncing fixtures", error);
    return res.status(500).json({ success: false, error: "internal server error" });
  }
});
