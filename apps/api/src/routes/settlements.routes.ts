import { Router, type Router as RouterType } from "express";

import { prisma } from "@workspace/db";
import { getSettlementProofPreview } from "../services/settlement.service";
import { logger } from "../utils/logger";

export const settlementsRouter: RouterType = Router();

// Public settlement proof gallery (item #7) — every settled market with its
// persisted three-stage TxLINE Merkle proof, no wallet required. Pure
// read-aggregation over data already written by settlement.service.ts at
// settle time; adds no new writes and no on-chain reads.
settlementsRouter.get("/api/settlements", async (_req, res) => {
  try {
    // settlementProof is always written in the same update that sets
    // status: "SETTLED" (settlement.service.ts) — no separate not-null filter needed.
    const markets = await prisma.market.findMany({
      where: { status: "SETTLED" },
      orderBy: { settledAt: "desc" },
      select: {
        id: true,
        marketPda: true,
        marketType: true,
        question: true,
        settlementTx: true,
        settledAt: true,
        oracleTsMs: true,
        settlementProof: true,
        fixture: {
          select: {
            fixtureId: true,
            competition: true,
            participant1: true,
            participant2: true,
            participant1IsHome: true,
            startTime: true,
            homeScore: true,
            awayScore: true,
          },
        },
      },
    });

    // Defensive: a market settled before proof-retention shipped could in
    // principle have status SETTLED with no persisted proof (see the
    // fallback branch in market-card.tsx) — the gallery only shows fully
    // verifiable entries.
    const withProof = markets
      .filter((m) => m.settlementProof !== null)
      .map((m) => ({ ...m, mode: "settled" as const }));

    // Fallback so the gallery is never empty just because none of our own
    // on-chain markets have been settled yet: for any closed fixture with no
    // settled market of its own, fall back to the same live TxLINE proof
    // preview settlement-proof-panel.tsx already renders per-fixture
    // (getSettlementProofPreview — no settle tx, but the same anchored daily
    // batch root, independently reproducible). Bounded by how many fixtures
    // are actually tracked (a handful for one tournament), so no fan-out risk.
    const fixtureIdsWithProof = new Set(
      withProof.map((m) => m.fixture.fixtureId.toString())
    );
    const closedFixtures = await prisma.fixture.findMany({
      where: { finalSeq: { not: null } },
      select: {
        fixtureId: true,
        competition: true,
        participant1: true,
        participant2: true,
        participant1IsHome: true,
        startTime: true,
        homeScore: true,
        awayScore: true,
      },
    });

    const previews = await Promise.all(
      closedFixtures
        .filter((f) => !fixtureIdsWithProof.has(f.fixtureId.toString()))
        .map(async (fixture) => {
          const preview = await getSettlementProofPreview(fixture.fixtureId).catch(
            () => null
          );
          if (!preview) return null;
          return {
            id: `preview-${fixture.fixtureId}`,
            mode: "preview" as const,
            marketPda: null,
            marketType: null,
            question: "Total goals over 1.5 — live TxLINE proof",
            settlementTx: null,
            settledAt: null,
            oracleTsMs: null,
            settlementProof: preview.proof,
            fixture,
          };
        })
    );

    const data = [...withProof, ...previews.filter((p) => p !== null)];

    return res.status(200).json({ data });
  } catch (error) {
    logger.error("api", "Error fetching settlements", error);
    return res.status(500).json({ error: "internal server error" });
  }
});
