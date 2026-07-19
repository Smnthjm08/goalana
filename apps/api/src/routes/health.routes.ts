import { Router, type Router as RouterType } from "express";

import { getHealthSnapshot } from "../services/stream-health.service";
import { logger } from "../utils/logger";

export const healthRouter: RouterType = Router();

healthRouter.get("/", async (_req, res) => {
  res.json({ status: "healthy!" });
});

// Infra liveness probe — deliberately trivial and dependency-free so a
// platform health check never fails on a slow DB/RPC round-trip.
healthRouter.get("/health", async (_req, res) => {
  res.status(200).json({ status: "UP", timestamp: new Date().toISOString() });
});

// Rich status for the UI's "TxLINE Connected" indicator: live SSE state, last
// event, tracked fixtures, and RPC reachability. Lives under /api because only
// /api/* is proxied to this service by the frontend (apps/web/next.config.ts).
// Always 200 — "degraded" is a payload state, not a transport error, so the
// indicator can render *why* rather than just failing to load.
healthRouter.get("/api/health", async (_req, res) => {
  try {
    const snapshot = await getHealthSnapshot();
    return res.status(200).json({ data: snapshot });
  } catch (error) {
    logger.error("api", "Error building health snapshot", error);
    return res.status(500).json({ error: "internal server error" });
  }
});
