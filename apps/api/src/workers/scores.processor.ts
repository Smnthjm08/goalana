import { prisma } from "@workspace/db";
import type { ScoresRecord } from "@workspace/txline";
import { logger } from "../utils/logger";

/**
 * Soccer StatusId → period label.
 *
 * 1-18 are the documented values (TxLINE Scores Product API doc, "Status Id").
 * 100 is NOT documented anywhere — it is what fixture 18237038's real feed
 * actually sends (paired with the equally undocumented action
 * "game_finalised") to mark full-time, instead of the documented 5/10/13.
 * Both are mapped to "FT" here; verify against a live match whether 100 is
 * this feed's standard terminal code or a one-off before relying on it.
 */
const STATUS_LABELS: Record<number, string> = {
  1: "NS",
  2: "H1",
  3: "HT",
  4: "H2",
  5: "FT",
  6: "WET",
  7: "ET1",
  8: "HTET",
  9: "ET2",
  10: "FET",
  11: "WPE",
  12: "PE",
  13: "FPE",
  14: "SUSPENDED",
  15: "ABANDONED",
  16: "CANCELLED",
  17: "TX_COVERAGE_CANCELLED",
  18: "TX_COVERAGE_SUSPENDED",
  100: "FT", // observed-only, see comment above
};

// Documented terminal StatusIds (5=F, 10=FET, 13=FPE) plus the observed-only
// 100. `game_finalised` is treated as terminal regardless of StatusId since
// it's the one signal that reliably showed up as the very last event in the
// real fixture 18237038 stream.
const TERMINAL_STATUS_IDS = new Set([5, 10, 13, 100]);

function isTerminal(action: string, statusId: number | null): boolean {
  return action === "game_finalised" || (statusId !== null && TERMINAL_STATUS_IDS.has(statusId));
}

/**
 * The wire format's `Score` object is nested per participant/period exactly
 * as documented (Participant1/Participant2 → H1/H2/HT/Total → Goals/...).
 *
 * NOTE: the txline package's `ScoresRecord` type declares this field as
 * `ScoreSoccer` (sport-specific) with a generic `Score` reserved for US
 * Football — but the real Soccer feed for fixture 18237038 sends the field
 * literally named `Score`, not `ScoreSoccer`. Read defensively from the raw
 * payload rather than trusting the declared type.
 */
function deriveGoals(raw: Record<string, unknown>): { home: number; away: number } | null {
  const score = (raw.Score ?? raw.ScoreSoccer) as
    | { Participant1?: { Total?: { Goals?: number } }; Participant2?: { Total?: { Goals?: number } } }
    | undefined;

  if (!score || typeof score !== "object") return null;

  const p1Goals = score.Participant1?.Total?.Goals ?? 0;
  const p2Goals = score.Participant2?.Total?.Goals ?? 0;
  const participant1IsHome = raw.Participant1IsHome !== false;

  return participant1IsHome
    ? { home: p1Goals, away: p2Goals }
    : { home: p2Goals, away: p1Goals };
}

/**
 * The single canonical entry point for a raw TxLINE scores event, whether it
 * arrived over the live SSE stream or a snapshot/backfill fetch. Both paths
 * MUST call this function — it is the only place that writes MatchEvent rows
 * or mutates a Fixture's live score/status/clock.
 *
 * Idempotency & ordering:
 *  - Raw storage is keyed by (fixtureId, Seq) — redelivering the same Seq is
 *    a harmless upsert no-op (at-least-once delivery safe).
 *  - Canonical fixture state is only advanced when the incoming Seq is
 *    strictly greater than the last Seq that touched it (`lastEventSeq`
 *    guard in the WHERE clause) — a reordered/replayed older event can never
 *    regress score/status/clock.
 *  - The score itself is never derived by counting "goal" actions. It is
 *    always taken from the `Score` object of whichever event currently has
 *    the highest Seq — TxLINE's own snapshot already reflects VAR overturns,
 *    action_discarded corrections, etc. (verified against fixture 18237038,
 *    where a VAR-overturned goal's Score rolled back from 3 to 2 goals and
 *    this rule reproduces that without any special-casing of "discarded").
 */
export async function processScoresUpdate(raw: ScoresRecord): Promise<void> {
  const record = raw as unknown as Record<string, unknown>;

  const fixtureIdNum = record.FixtureId as number | undefined;
  const seq = record.Seq as number | undefined;
  const action = record.Action as string | undefined;
  const ts = record.Ts as number | undefined;

  if (fixtureIdNum === undefined || seq === undefined || !action || ts === undefined) {
    logger.warn("scores.processor", `Skipping invalid score event (missing FixtureId, Seq, Action, or Ts)`);
    return;
  }

  const fixtureId = BigInt(fixtureIdNum);
  const confirmed = (record.Confirmed as boolean | undefined) ?? false;
  const statusId = typeof record.StatusId === "number" ? (record.StatusId as number) : null;

  // 1. Raw/audit storage — every wire message, unconditionally, keyed by Seq.
  await prisma.matchEvent.upsert({
    where: { fixtureId_seq: { fixtureId, seq } },
    update: {
      action,
      timestamp: BigInt(ts),
      statusId,
      confirmed,
      payload: raw as any,
    },
    create: {
      fixtureId,
      seq,
      action,
      timestamp: BigInt(ts),
      statusId,
      confirmed,
      payload: raw as any,
    },
  });

  // 2. Canonical fixture-state update, guarded against stale/out-of-order delivery.
  const clock = record.Clock as { Running?: boolean; Seconds?: number } | undefined;
  const goals = deriveGoals(record);
  const terminal = isTerminal(action, statusId);

  const data: Record<string, unknown> = {
    lastEventSeq: seq,
    lastEventTs: BigInt(ts),
  };

  if (goals) {
    data.homeScore = goals.home;
    data.awayScore = goals.away;
  }
  if (statusId !== null) {
    data.liveStatusId = statusId;
    data.livePeriodLabel = STATUS_LABELS[statusId] ?? String(statusId);
  } else if (action === "halftime_finalised") {
    // halftime_finalised (undocumented action) carries StatusId=3 in every
    // observed instance, but guard for the case where it doesn't.
    data.livePeriodLabel = "HT";
  } else if (action === "game_finalised") {
    data.livePeriodLabel = "FT";
  }
  if (clock?.Seconds !== undefined) data.clockSeconds = clock.Seconds;
  if (clock?.Running !== undefined) data.clockRunning = clock.Running;
  if (terminal) data.finalSeq = seq;

  const result = await prisma.fixture.updateMany({
    where: {
      fixtureId,
      OR: [{ lastEventSeq: null }, { lastEventSeq: { lt: seq } }],
    },
    data,
  });

  if (result.count === 0) {
    // Either the fixture hasn't been synced yet by fixtures.cron (raw event
    // is still safely stored above, ready to be picked up by a future
    // backfill/snapshot pass), or a newer Seq already advanced the canonical
    // state — both are expected, non-error conditions.
    logger.event(
      "scores.processor",
      `Skipped canonical update for fixture=${fixtureIdNum} seq=${seq} (fixture untracked or stale seq)`,
    );
  }
}
