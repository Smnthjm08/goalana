import { prisma } from "@workspace/db";

export type MatchEventTeam = "HOME" | "AWAY" | null;

export interface NormalizedMatchEvent {
  id: string;
  fixtureId: string;
  type: string;
  team: MatchEventTeam;
  minute: number | null;
  minuteLabel: string | null;
  title: string;
  description: string | null;
  confirmed: boolean;
  discarded: boolean;
  timestamp: string;
}

/**
 * Actions that are actually worth showing to a user watching a match, as
 * opposed to internal/stat-tracking noise (possession family, `possible`,
 * throw-ins, shots, corners, goal kicks, free kicks, clock_adjustment,
 * standby, connected/disconnected, comment, injury). All observed in
 * fixture 18237038's real feed — everything not in this set was excluded
 * deliberately, not by omission.
 */
const MEANINGFUL_ACTIONS = new Set([
  "kickoff",
  "goal",
  "yellow_card",
  "red_card",
  "substitution",
  "halftime_finalised",
  "game_finalised",
  "var_end",
  "penalty_outcome",
]);

// Only statusId 2 → "Kick Off" and 4 → "Second Half Kick Off" are verified
// against fixture 18237038's real data. 7/9/12 follow the documented
// StatusId enum (ET1/ET2/Penalty Shootout) but have not been observed live.
const KICKOFF_LABELS: Record<number, string> = {
  2: "Kick Off",
  4: "Second Half Kick Off",
  7: "Extra Time Kick Off",
  9: "Extra Time Second Half Kick Off",
  12: "Penalty Shootout",
};

function teamFromParticipant(participant: unknown, participant1IsHome: boolean): MatchEventTeam {
  if (participant === 1) return participant1IsHome ? "HOME" : "AWAY";
  if (participant === 2) return participant1IsHome ? "AWAY" : "HOME";
  return null;
}

/**
 * Clock.Seconds is a single continuous counter from kickoff (0) through
 * full time — it does NOT reset at half time (verified against fixture
 * 18237038: second-half kickoff starts at Seconds=2700 (=45:00) and a later
 * H2 goal sits at Seconds=3455 (=57:35)). So the display minute is simply
 * floor(seconds / 60), with standard "45+N" / "90+N" stoppage-time notation
 * once a half's clock has been observed to already start past its nominal
 * length at HT/FT for that half.
 */
export function formatMinute(seconds: number | null, statusId: number | null): { minute: number | null; label: string | null } {
  if (seconds === null) return { minute: null, label: null };

  const minute = Math.floor(seconds / 60);

  if (statusId === 2 && minute > 45) return { minute, label: `45+${minute - 45}'` };
  if (statusId === 4 && minute > 90) return { minute, label: `90+${minute - 90}'` };
  return { minute, label: `${minute}'` };
}

function describeGoal(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null;
  const parts: string[] = [];
  if (typeof data.PlayerId === "number") parts.push(`Player #${data.PlayerId}`);
  if (data.GoalType === "Own") parts.push("(own goal)");
  else if (typeof data.GoalType === "string") parts.push(`(${data.GoalType})`);
  return parts.length ? parts.join(" ") : null;
}

function describeCard(data: Record<string, unknown> | undefined): string | null {
  if (!data?.PlayerId || typeof data.PlayerId !== "number") return null;
  return `Player #${data.PlayerId}`;
}

function describeSubstitution(data: Record<string, unknown> | undefined): string | null {
  if (!data) return null;
  const out = data.PlayerOutId;
  const inn = data.PlayerInId;
  if (typeof out !== "number" || typeof inn !== "number") return null;
  return `Player #${out} → Player #${inn}`;
}

/**
 * Builds the user-facing timeline for a fixture from raw MatchEvent rows.
 *
 * Two corrections are applied that a naive "one row = one timeline entry"
 * approach would get wrong (both verified against real data for fixture
 * 18237038):
 *
 *  1. De-duplication by the wire event's own `Id` (not `Seq`, not the DB
 *     row id) — the same logical event is delivered multiple times as it
 *     goes unconfirmed → confirmed → confirmed+enriched. Only the
 *     highest-Seq revision of each `Id` becomes a timeline entry.
 *
 *  2. Retraction via `action_discarded` — TxLINE reuses the discarded
 *     action's own `Id` on the discard message. Any meaningful event whose
 *     `Id` was later discarded is kept in the timeline but flagged
 *     `discarded: true` (e.g. a VAR-overturned goal) instead of either
 *     silently vanishing or staying shown as a normal goal.
 */
export interface CornerTally {
  home: number;
  away: number;
}

/**
 * Live corner count per team, counted directly from raw `corner` rows —
 * deliberately kept out of `getMatchTimeline` (corners are excluded from
 * `MEANINGFUL_ACTIONS` as play-by-play noise) but still worth surfacing as a
 * running tally since Goalana prices corner-count markets (see
 * `TXLINE_STAT_KEYS.HOME_CORNERS`/`AWAY_CORNERS`). Those TxOracle stat proofs
 * are settlement-only (gated on `finalSeq`), so mid-match this raw-row count
 * is the only live source.
 */
export async function getCornerTally(fixtureId: bigint): Promise<CornerTally> {
  const fixture = await prisma.fixture.findUnique({
    where: { fixtureId },
    select: { participant1IsHome: true },
  });

  if (!fixture) return { home: 0, away: 0 };

  const rows = await prisma.matchEvent.findMany({
    where: { fixtureId, action: { in: ["corner", "action_discarded"] } },
    orderBy: { seq: "asc" },
  });

  const discardedIds = new Set<number>();
  const latestById = new Map<number, (typeof rows)[number]>();

  for (const row of rows) {
    const payload = row.payload as Record<string, unknown>;
    const wireId = payload.Id;
    if (typeof wireId !== "number") continue;

    if (row.action === "action_discarded") {
      discardedIds.add(wireId);
      continue;
    }

    // rows are ordered by seq asc, so the last write per Id wins.
    latestById.set(wireId, row);
  }

  const tally: CornerTally = { home: 0, away: 0 };

  for (const [wireId, row] of latestById) {
    if (discardedIds.has(wireId)) continue;
    const payload = row.payload as Record<string, unknown>;
    const team = teamFromParticipant(payload.Participant, fixture.participant1IsHome);
    if (team === "HOME") tally.home += 1;
    else if (team === "AWAY") tally.away += 1;
  }

  return tally;
}

export async function getMatchTimeline(fixtureId: bigint): Promise<NormalizedMatchEvent[]> {
  const fixture = await prisma.fixture.findUnique({
    where: { fixtureId },
    select: { participant1IsHome: true },
  });

  if (!fixture) return [];

  const rows = await prisma.matchEvent.findMany({
    where: { fixtureId },
    orderBy: { seq: "asc" },
  });

  const discardedIds = new Set<number>();
  // Latest revision (by Seq) per wire event Id.
  const latestById = new Map<number, (typeof rows)[number]>();

  for (const row of rows) {
    const payload = row.payload as Record<string, unknown>;
    const wireId = payload.Id;
    if (typeof wireId !== "number") continue;

    if (row.action === "action_discarded") {
      discardedIds.add(wireId);
      continue;
    }

    if (!MEANINGFUL_ACTIONS.has(row.action)) continue;

    // rows are already ordered by seq asc, so the last write per Id wins.
    latestById.set(wireId, row);
  }

  const events: NormalizedMatchEvent[] = [];

  // TxLINE emits a "kickoff" action every time play resumes — the actual
  // period start (H1/H2/ET1/...) AND every restart-after-goal. Only the
  // first kickoff seen for each distinct statusId is a period boundary;
  // any later kickoff at the same statusId is a goal-restart and isn't
  // meaningful on its own (verified against fixture 18237038: kickoff
  // Id=554 immediately follows a confirmed goal at the same H2 statusId as
  // kickoff Id=430, which was the actual second-half start).
  const periodKickoffSeen = new Set<number>();
  const sortedByRowSeq = [...latestById.entries()].sort((a, b) => a[1].seq - b[1].seq);

  for (const [wireId, row] of sortedByRowSeq) {
    const payload = row.payload as Record<string, unknown>;
    const data = payload.Data as Record<string, unknown> | undefined;
    const clock = payload.Clock as { Seconds?: number } | undefined;
    const statusId = row.statusId;
    const discarded = discardedIds.has(wireId);

    if (row.action === "kickoff") {
      if (statusId !== null && periodKickoffSeen.has(statusId)) continue;
      if (statusId !== null) periodKickoffSeen.add(statusId);
    }

    let { minute, label } = formatMinute(clock?.Seconds ?? null, statusId);
    // Substitution's team lives under Data.Participant, not the top-level
    // Participant field every other action uses (per the doc's "Substitution"
    // table) — verified against real substitution payloads, which had no
    // top-level Participant at all.
    const team =
      row.action === "substitution"
        ? teamFromParticipant(data?.Participant, fixture.participant1IsHome)
        : teamFromParticipant(payload.Participant, fixture.participant1IsHome);

    let type = row.action;
    let title: string;
    let description: string | null = null;

    switch (row.action) {
      case "kickoff":
        // Only H1 (2) and H2 (4) start-of-period kickoffs are verified
        // against real data for this fixture. Extra-time/penalty kickoffs
        // are mapped by documented StatusId but unverified — confirm
        // against a live match that goes to extra time.
        type = statusId === 2 ? "kickoff" : "period_start";
        title = KICKOFF_LABELS[statusId ?? -1] ?? "Kick Off";
        break;
      case "goal":
        title = discarded ? "Goal Disallowed" : "Goal";
        description = describeGoal(data);
        break;
      case "yellow_card":
        title = "Yellow Card";
        description = describeCard(data);
        break;
      case "red_card":
        title = "Red Card";
        description = describeCard(data);
        break;
      case "substitution":
        title = "Substitution";
        description = describeSubstitution(data);
        break;
      case "halftime_finalised":
        type = "half_time";
        title = "Half Time";
        // halftime_finalised carries no Clock field — fall back to the
        // nominal 45' so it sorts correctly relative to H1/H2 events.
        minute = 45;
        label = "HT";
        break;
      case "game_finalised":
        type = "full_time";
        title = "Full Time";
        // game_finalised carries no Clock field either, and is always the
        // chronologically last event — sort it above every numbered minute.
        minute = 9999;
        label = "FT";
        break;
      case "var_end": {
        const outcome = data?.Outcome;
        if (outcome !== "Overturned") continue; // VAR review that changed nothing isn't worth a timeline entry
        type = "var_overturned";
        title = "VAR Overturned";
        description = "Decision overturned after review";
        break;
      }
      case "penalty_outcome":
        title = data?.Outcome === "Scored" ? "Penalty Scored" : "Penalty Missed";
        description = describeCard(data);
        break;
      default:
        title = row.action;
    }

    // halftime_finalised/game_finalised never carry a `Confirmed` field at
    // all (undocumented actions, not in the doc's per-action Confirmed
    // table either) — they're structural period markers, not pending
    // facts, so `row.confirmed ?? false` would wrongly show them as
    // "pending" forever.
    const confirmed =
      row.action === "halftime_finalised" || row.action === "game_finalised"
        ? true
        : (row.confirmed ?? false);

    events.push({
      id: `${row.action}-${wireId}`,
      fixtureId: fixtureId.toString(),
      type,
      team,
      minute,
      minuteLabel: label,
      title,
      description,
      confirmed,
      discarded,
      timestamp: new Date(Number(row.timestamp)).toISOString(),
    });
  }

  // Newest first, matching the fixture page's other reverse-chronological
  // feeds (odds movement chart tooltips read oldest→newest on the X axis,
  // but a discrete event list reads better newest-first).
  events.sort((a, b) => {
    if (a.minute !== b.minute) return (b.minute ?? -1) - (a.minute ?? -1);
    // Same displayed minute (e.g. HT and the second-half kickoff both show
    // 45') — break the tie by real wall-clock order, not by id, so the
    // later real-world event still sorts first.
    return b.timestamp.localeCompare(a.timestamp);
  });

  return events;
}
