import { Router, type Router as RouterType } from "express";

import {
  createChallengeRequest,
  listChallengeRequests,
  approveChallengeRequest,
  rejectChallengeRequest,
  ChallengeRequestError,
  type ChallengeStat,
} from "../services/market-request.service";
import { parseFixtureId } from "../utils/parse-fixture-id";
import { logger } from "../utils/logger";

// ─── Challenge Pools (final-features.md #1) ─────────────────────────────────
// User-proposed fixed-stake N-vs-N pools. Submit is open (anyone can propose);
// approve/reject are house-gated with the same admin secret as /fixtures/sync,
// because approval signs a real authority-gated create_market on-chain.

export const marketRequestsRouter: RouterType = Router();

marketRequestsRouter.post("/api/market-requests", async (req, res) => {
  try {
    const { fixtureId, requesterWallet, stat, threshold, fixedStakeSol, slotsPerSide } =
      req.body ?? {};

    const parsedFixtureId = typeof fixtureId === "string" || typeof fixtureId === "number"
      ? parseFixtureId(String(fixtureId))
      : null;
    if (!parsedFixtureId) {
      return res.status(400).json({ success: false, error: "invalid fixtureId" });
    }

    const request = await createChallengeRequest({
      fixtureId: parsedFixtureId,
      requesterWallet: String(requesterWallet ?? ""),
      stat: stat as ChallengeStat,
      threshold: Number(threshold),
      fixedStakeSol: Number(fixedStakeSol),
      slotsPerSide: Number(slotsPerSide),
    });

    // Auto-approve by default: createChallengeRequest already validated the
    // stat (whitelisted against real-fixture-verified keys), threshold,
    // stake bounds, slots, and pre-kickoff timing above — approval is a
    // mechanical re-derivation of the same create_market call the house's
    // own market cron already makes unattended for standard markets, not a
    // human judgment call. Set CHALLENGE_POOL_AUTO_APPROVE=false to fall
    // back to manual review via POST /:id/review (still house-secret-gated,
    // still available to reject/override).
    if (process.env.CHALLENGE_POOL_AUTO_APPROVE !== "false") {
      try {
        const approved = await approveChallengeRequest(request.id);
        return res.status(201).json({ success: true, request: approved });
      } catch (err) {
        // Chain call failed (RPC hiccup, etc.) — leave the request PENDING
        // rather than lose it; a later manual /review retries the same path.
        logger.error(
          "api",
          `Auto-approve failed for challenge request ${request.id}, left PENDING`,
          err
        );
      }
    }

    return res.status(201).json({ success: true, request });
  } catch (error) {
    if (error instanceof ChallengeRequestError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    logger.error("api", "Error creating challenge request", error);
    return res.status(500).json({ success: false, error: "internal server error" });
  }
});

marketRequestsRouter.get("/api/market-requests", async (req, res) => {
  try {
    const fixtureIdRaw = typeof req.query.fixtureId === "string" ? req.query.fixtureId : undefined;
    const statusRaw = typeof req.query.status === "string" ? req.query.status : undefined;

    const fixtureId = fixtureIdRaw ? parseFixtureId(fixtureIdRaw) ?? undefined : undefined;
    if (fixtureIdRaw && !fixtureId) {
      return res.status(400).json({ success: false, error: "invalid fixtureId" });
    }

    const requests = await listChallengeRequests({ fixtureId, status: statusRaw });
    return res.json({ success: true, requests });
  } catch (error) {
    logger.error("api", "Error listing challenge requests", error);
    return res.status(500).json({ success: false, error: "internal server error" });
  }
});

marketRequestsRouter.post("/api/market-requests/:id/review", async (req, res) => {
  const adminSecret = process.env.ADMIN_SYNC_SECRET;
  if (adminSecret && req.headers["x-admin-secret"] !== adminSecret) {
    return res.status(401).json({ success: false, error: "unauthorized" });
  }

  try {
    const { action, reviewNote } = req.body ?? {};
    if (action !== "approve" && action !== "reject") {
      return res.status(400).json({ success: false, error: "action must be 'approve' or 'reject'" });
    }

    const request =
      action === "approve"
        ? await approveChallengeRequest(req.params.id, reviewNote)
        : await rejectChallengeRequest(req.params.id, reviewNote);

    return res.json({ success: true, request });
  } catch (error) {
    if (error instanceof ChallengeRequestError) {
      return res.status(400).json({ success: false, error: error.message });
    }
    logger.error("api", "Error reviewing challenge request", error);
    return res.status(500).json({ success: false, error: "internal server error" });
  }
});
