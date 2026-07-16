import { prisma } from "@workspace/db";
import { connection } from "./goalana.service";

// ─── Live TxLINE stream status (in-memory) ───────────────────────────────────
// Observability only: the SSE workers report their connection state here so
// `GET /api/health` can prove the feed is live. Nothing in this module
// influences ingestion, persistence, or settlement — it is written to by the
// workers and read by the health endpoint, and that is all.
//
// In-memory (not persisted) on purpose: this describes *this process's* live
// socket state, which is meaningless once the process restarts. The durable
// facts (last odds row, last match event) are read from Postgres below.

export type StreamName = "odds" | "scores";

interface StreamState {
  connected: boolean;
  /** When the current SSE connection was established (ms epoch). */
  connectedSince: number | null;
  /** Last frame of any kind, including heartbeats (ms epoch). */
  lastFrameAt: number | null;
  /** Last frame that carried actual match/odds data, not a heartbeat (ms epoch). */
  lastEventAt: number | null;
  /** Data frames processed since this process started. */
  eventCount: number;
}

function emptyState(): StreamState {
  return {
    connected: false,
    connectedSince: null,
    lastFrameAt: null,
    lastEventAt: null,
    eventCount: 0,
  };
}

const streams: Record<StreamName, StreamState> = {
  odds: emptyState(),
  scores: emptyState(),
};

export function markStreamConnected(name: StreamName): void {
  const state = streams[name];
  state.connected = true;
  state.connectedSince = Date.now();
  state.lastFrameAt = Date.now();
}

export function markStreamDisconnected(name: StreamName): void {
  const state = streams[name];
  state.connected = false;
  state.connectedSince = null;
}

/**
 * A frame arrived. `isData` distinguishes a real odds/scores payload from an
 * SSE heartbeat — heartbeats prove the socket is alive (which matters when no
 * match is in play and no data is flowing), but they are not "events".
 */
export function markStreamFrame(name: StreamName, isData: boolean): void {
  const state = streams[name];
  const now = Date.now();
  state.lastFrameAt = now;
  if (isData) {
    state.lastEventAt = now;
    state.eventCount += 1;
  }
}

// The frontend polls health on an interval; a Solana RPC round-trip per poll
// (per viewer) is wasteful, so the result is briefly shared across callers.
const RPC_CACHE_MS = 5_000;
const RPC_TIMEOUT_MS = 2_500;

let rpcCache: { at: number; healthy: boolean; slot: number | null } | null = null;

async function checkRpc(): Promise<{ healthy: boolean; slot: number | null }> {
  if (rpcCache && Date.now() - rpcCache.at < RPC_CACHE_MS) {
    return { healthy: rpcCache.healthy, slot: rpcCache.slot };
  }

  let result: { healthy: boolean; slot: number | null };
  try {
    const slot = await Promise.race([
      connection.getSlot(),
      new Promise<never>((_, reject) =>
        setTimeout(() => reject(new Error("RPC timeout")), RPC_TIMEOUT_MS),
      ),
    ]);
    result = { healthy: true, slot };
  } catch {
    result = { healthy: false, slot: null };
  }

  rpcCache = { at: Date.now(), ...result };
  return result;
}

export interface HealthSnapshot {
  status: "UP" | "DEGRADED";
  timestamp: string;
  txline: {
    /** True only when both SSE streams hold a live connection. */
    connected: boolean;
    streams: Record<StreamName, StreamState>;
    /** Most recent data event across both streams (ms epoch). */
    lastEventAt: number | null;
    /** `ts` of the newest persisted Odds row (ms epoch) — survives restarts. */
    lastOddsUpdateAt: number | null;
  };
  fixtures: {
    tracked: number;
    live: number;
    markets: number;
  };
  rpc: {
    healthy: boolean;
    slot: number | null;
  };
}

export async function getHealthSnapshot(): Promise<HealthSnapshot> {
  const [trackedFixtures, liveFixtures, markets, latestOdds, rpc] = await Promise.all([
    prisma.fixture.count(),
    prisma.fixture.count({ where: { finalSeq: null, liveStatusId: { not: null } } }),
    prisma.market.count(),
    prisma.odds.aggregate({ _max: { ts: true } }),
    checkRpc(),
  ]);

  const lastOddsUpdateAt = latestOdds._max.ts !== null ? Number(latestOdds._max.ts) : null;

  const lastEventAt = [streams.odds.lastEventAt, streams.scores.lastEventAt]
    .filter((ts): ts is number => ts !== null)
    .reduce<number | null>((max, ts) => (max === null || ts > max ? ts : max), null);

  const connected = streams.odds.connected && streams.scores.connected;

  return {
    status: connected && rpc.healthy ? "UP" : "DEGRADED",
    timestamp: new Date().toISOString(),
    txline: {
      connected,
      streams: { odds: { ...streams.odds }, scores: { ...streams.scores } },
      lastEventAt,
      lastOddsUpdateAt,
    },
    fixtures: { tracked: trackedFixtures, live: liveFixtures, markets },
    rpc,
  };
}
