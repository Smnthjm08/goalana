import type { Express } from "express";

import { healthRouter } from "./health.routes";
import { usersRouter } from "./users.routes";
import { fixturesRouter } from "./fixtures.routes";
import { marketsRouter } from "./markets.routes";
import { settlementsRouter } from "./settlements.routes";
import { marketRequestsRouter } from "./market-requests.routes";

export function registerRoutes(app: Express) {
  app.use(healthRouter);
  app.use(usersRouter);
  app.use(fixturesRouter);
  app.use(marketsRouter);
  app.use(settlementsRouter);
  app.use(marketRequestsRouter);
}
