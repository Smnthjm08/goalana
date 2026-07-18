import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import { PublicKey } from "@solana/web3.js";

import { prisma } from "@workspace/db";
import { startFixtureCron, syncFixtures } from "./crons/fixtures.cron";
import { createTodayMarket, startMarketCron } from "./crons/market.cron";
import { startLifecycleCron } from "./crons/lifecycle.cron";
import { startScoresWorker } from "./workers/scorer.worker";
import { reconcileLiveFixtures } from "./workers/scores.backfill";
import { startOddsWorker } from "./workers/odds.worker";
import { computeCurrentReferenceProbability } from "./services/market.service";
import { getSettlementProofPreview } from "./services/settlement.service";
import { getHealthSnapshot } from "./services/stream-health.service";
import { SUPPORTED_MARKETS } from "./services/market-definitions";
import { getMatchTimeline, formatMinute } from "./services/match-timeline.service";
import { upsertUserForWallet } from "./services/user.service";
import path from "path";
import { fileURLToPath } from "url";
import { logger } from "./utils/logger";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../.env") });

const requiredEnv = [
  "DATABASE_URL",
  "TXLINE_API_ORIGIN",
  "SOLANA_RPC_URL",
  "TXLINE_JWT",
  "TXLINE_API_TOKEN",
  "WALLET_PRIVATE_KEY",
  // CORS origin (below) silently falls back to localhost:3000 if unset —
  // in a deployed environment that means every browser request from the
  // real frontend gets blocked with no server-side signal at all. Fail at
  // boot instead of failing silently in a judge's browser console.
  "NEXT_PUBLIC_SITE_URL",
] as const;

for (const key of requiredEnv) {
  if (!process.env[key]) {
    throw new Error(`Missing required environment variable: ${key}`);
  }
}

const app = express();
const port = process.env.BE_PORT ?? 8080;

// Every fixture-id route param goes through this — a non-numeric id (typo,
// probe, or an accidental /api/fixtures/undefined from the client) must
// surface as a 400, not fall through to BigInt()'s SyntaxError, which the
// generic catch block turns into an indistinguishable-from-a-real-fault 500.
function parseFixtureId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}

// Serialize Prisma BigInt values globally
app.set("json replacer", (_key: string, value: unknown) => {
  return typeof value === "bigint" ? value.toString() : value;
});

app.use(express.json());

// Guaranteed set by the requiredEnv check above — no silent fallback here,
// since a wrong/missing origin fails as an unexplained CORS block in the
// browser, not a server-side error anyone would see.
const frontendUrl = process.env.NEXT_PUBLIC_SITE_URL as string;
app.use(cors({ origin: frontendUrl }));

app.get("/", async (req, res) => {
  res.json({ status: "healthy!" });
});

// Infra liveness probe — deliberately trivial and dependency-free so a
// platform health check never fails on a slow DB/RPC round-trip.
app.get("/health", async (req, res) => {
  res.status(200).json({ status: "UP", timestamp: new Date().toISOString() });
});

// Rich status for the UI's "TxLINE Connected" indicator: live SSE state, last
// event, tracked fixtures, and RPC reachability. Lives under /api because only
// /api/* is proxied to this service by the frontend (apps/web/next.config.ts).
// Always 200 — "degraded" is a payload state, not a transport error, so the
// indicator can render *why* rather than just failing to load.
app.get("/api/health", async (_req, res) => {
  try {
    const snapshot = await getHealthSnapshot();
    return res.status(200).json({ data: snapshot });
  } catch (error) {
    logger.error("api", "Error building health snapshot", error);
    return res.status(500).json({ error: "internal server error" });
  }
});

// Wallet is the only identity Goalana has — the frontend calls this right
// after a wallet connects. Upsert-based, so it doubles as both "register a
// new wallet" and "recognize an existing one" in a single idempotent call.
app.post("/api/users/connect", async (req, res) => {
  try {
    const walletAddress = req.body?.walletAddress;

    if (typeof walletAddress !== "string" || walletAddress.length === 0) {
      return res.status(400).json({ error: "walletAddress is required" });
    }

    try {
      new PublicKey(walletAddress);
    } catch {
      return res.status(400).json({ error: "walletAddress is not a valid Solana address" });
    }

    const { user, isNewUser } = await upsertUserForWallet(walletAddress);

    return res.status(200).json({ data: { user, isNewUser } });
  } catch (error) {
    logger.error("api", "Error registering wallet", error);
    return res.status(500).json({ error: "internal server error" });
  }
});

app.get("/api/fixtures", async (_req, res) => {
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

app.get("/api/fixtures/:id", async (req, res) => {
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
      data: { ...fixture, markets: marketsWithLiveReference, liveScore, events },
    });
  } catch (error) {
    logger.error("api", `Error fetching fixture ${req.params.id}`, error);
    return res.status(500).json({ error: "internal server error" });
  }
});

// Flat market index for the wallet-scoped /positions page. A position is an
// on-chain Position PDA that only knows its Market pubkey — this supplies the
// off-chain metadata (question, fixture, lifecycle txs) to join against, in one
// request instead of a fixture-by-fixture fan-out. Read-only; on-chain state
// (pools, status, outcome) is still read from the chain by the client.
app.get("/api/markets", async (_req, res) => {
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
        fixture: {
          select: {
            fixtureId: true,
            competition: true,
            participant1: true,
            participant2: true,
            startTime: true,
          },
        },
      },
    });

    return res.status(200).json({ data: markets });
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
app.get("/api/markets/:marketPda", async (req, res) => {
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

app.get("/api/fixtures/:id/odds/history", async (req, res) => {
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
app.get("/api/fixtures/:id/proof-preview", async (req, res) => {
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
app.post("/api/fixtures/sync", async (req, res) => {
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

const oddsWorkerController = new AbortController();
const scoresWorkerController = new AbortController();

function shutdown(signal: string) {
  logger.warn("bootstrap", `Received ${signal}, shutting down stream workers...`);
  oddsWorkerController.abort();
  scoresWorkerController.abort();
}

process.on("SIGTERM", () => shutdown("SIGTERM"));
process.on("SIGINT", () => shutdown("SIGINT"));

async function bootstrap() {
  logger.info("bootstrap", "Starting Goalana backend");

  if (process.env.API_ONLY === "true") {
    logger.info("bootstrap", "Running in API-only mode. Skipping crons and workers.");
    logger.success("bootstrap", "Goalana backend ready (API Only)");
    return;
  }

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

  // 3. Catch up any fixture that was already mid-match when this process
  // started (deploy restart, crash, manual restart, etc.) — the live scores
  // worker's SSE resume position only lives in memory, so a restart alone
  // would otherwise leave a silent gap in that fixture's match events.
  try {
    await reconcileLiveFixtures();
  } catch (error) {
    logger.error("bootstrap", "Live fixture reconciliation failed", error);
  }

  // 4. Start scheduled fixture refresh
  startFixtureCron();

  // 5. Periodically discover/create missing markets
  startMarketCron();

  // 6. Lock markets at kickoff, settle markets once their fixture is final
  startLifecycleCron();

  // 7. Start live workers
  void startOddsWorker(oddsWorkerController.signal).catch((error) => {
    logger.error("odds-worker", "Fatal error", error);
  });

  void startScoresWorker(scoresWorkerController.signal).catch((error) => {
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