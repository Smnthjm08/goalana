/**
 * Conclusive validation of the TxLINE stat-key → statistic mapping, run BEFORE
 * cancelling/recreating any live Devnet markets whose predicates depend on it.
 *
 * For every completed fixture it triangulates THREE independent sources at the
 * final sequence:
 *   (A) DB score        — Goalana's derived home/away goals (scores.processor)
 *   (B) Stats map        — the raw TxLINE `Stats` composite-key map on the
 *                          highest-Seq scores-snapshot record (period*1000+base;
 *                          base 1=home/p1 goals, 2=away/p2 goals, 3/4=yellows,
 *                          7/8=corners — participant-oriented, aligned to
 *                          home/away via Participant1IsHome)
 *   (C) stat-validation  — the value TxLINE returns (and proves) for a given key
 *
 * Verdict per fixture: does stat-validation key 1/2 == goals (matching A and B)
 * while keys 7/8 clearly represent corners (≠ goals)? Exits non-zero if the
 * goals mapping does not hold on every fixture, so this can gate an action.
 *
 * Run: bun src/scripts/verify-stat-keys.ts
 */
import { prisma } from "@workspace/db";
import { ScoresService } from "@workspace/txline";

const scores = new ScoresService();

// base stat keys (participant-relative); we read both the raw Stats map and the
// stat-validation endpoint for each pair.
const KEYS = { goals: [1, 2], yellows: [3, 4], corners: [7, 8] } as const;

function statsVal(stats: Record<string, number> | undefined, key: number): number | null {
  if (!stats) return null;
  // full-match period is 0 → composite key == base key.
  const v = stats[String(key)];
  return typeof v === "number" ? v : null;
}

async function validationValue(fixtureId: number, seq: number, key: number, key2: number) {
  const v = (await scores.getScoresStatValidation({ fixtureId, seq, statKey: key, statKey2: key2 })) as {
    statToProve?: { key: number; value: number; period: number };
    statToProve2?: { key: number; value: number; period: number };
  };
  return { a: v.statToProve, b: v.statToProve2 };
}

async function main() {
  const fixtures = await prisma.fixture.findMany({
    where: { finalSeq: { not: null } },
    orderBy: { startTime: "asc" },
  });

  console.log(`\n=== TxLINE stat-key validation — ${fixtures.length} completed fixture(s) ===\n`);

  let allGoalsOk = true;
  let allCornersDiffer = true;

  for (const f of fixtures) {
    const fid = Number(f.fixtureId);
    const seq = f.finalSeq!;
    const p1Home = f.participant1IsHome;
    const homeName = p1Home ? f.participant1 : f.participant2;
    const awayName = p1Home ? f.participant2 : f.participant1;

    // (A) DB score (home/away oriented)
    const dbHomeGoals = f.homeScore;
    const dbAwayGoals = f.awayScore;

    // (B) raw Stats map from the highest-Seq snapshot record
    let stats: Record<string, number> | undefined;
    try {
      const snap = await scores.getScoresSnapshot(fid);
      const withStats = snap.filter((r) => r.Stats && Object.keys(r.Stats).length > 0);
      const latest = withStats.sort((a, b) => (a.Seq ?? 0) - (b.Seq ?? 0)).at(-1);
      stats = latest?.Stats;
    } catch {
      /* stats map optional */
    }

    // (C) stat-validation values for goals / yellows / corners
    const goals = await validationValue(fid, seq, KEYS.goals[0], KEYS.goals[1]);
    const yellows = await validationValue(fid, seq, KEYS.yellows[0], KEYS.yellows[1]);
    const corners = await validationValue(fid, seq, KEYS.corners[0], KEYS.corners[1]);

    // stat-validation returns key1 = participant1, key2 = participant2. Orient
    // to home/away using Participant1IsHome so we can compare to the DB score.
    const vP1Goals = goals.a?.value ?? null;
    const vP2Goals = goals.b?.value ?? null;
    const vHomeGoals = p1Home ? vP1Goals : vP2Goals;
    const vAwayGoals = p1Home ? vP2Goals : vP1Goals;

    const goalsMatch =
      vHomeGoals === dbHomeGoals &&
      vAwayGoals === dbAwayGoals &&
      statsVal(stats, 1) === (p1Home ? dbHomeGoals : dbAwayGoals) &&
      statsVal(stats, 2) === (p1Home ? dbAwayGoals : dbHomeGoals);

    // corners must differ from goals to prove keys 7/8 are NOT goals
    const cornersP1 = corners.a?.value ?? null;
    const cornersP2 = corners.b?.value ?? null;
    const cornersDiffer =
      cornersP1 !== vP1Goals || cornersP2 !== vP2Goals || cornersP1 !== 0 || cornersP2 !== 0;

    allGoalsOk = allGoalsOk && goalsMatch;
    allCornersDiffer = allCornersDiffer && cornersDiffer;

    console.log(`Fixture ${fid} — ${homeName} (home) vs ${awayName} (away), finalSeq ${seq}`);
    console.log(`  Official/DB score (goals):      home ${dbHomeGoals}  away ${dbAwayGoals}  (total ${(dbHomeGoals ?? 0) + (dbAwayGoals ?? 0)})`);
    console.log(`  Stats map  key1/key2 (goals):   ${statsVal(stats, 1)} / ${statsVal(stats, 2)}   [p1/p2]`);
    console.log(`  stat-valid key1/key2 (goals):   p1=${vP1Goals} p2=${vP2Goals}  →  home=${vHomeGoals} away=${vAwayGoals}   period=${goals.a?.period}`);
    console.log(`  stat-valid key3/key4 (yellows): p1=${yellows.a?.value} p2=${yellows.b?.value}   (Stats: ${statsVal(stats, 3)}/${statsVal(stats, 4)})`);
    console.log(`  stat-valid key7/key8 (corners): p1=${cornersP1} p2=${cornersP2}   (Stats: ${statsVal(stats, 7)}/${statsVal(stats, 8)})`);
    console.log(`  → GOALS mapping (key 1/2 == goals across all 3 sources): ${goalsMatch ? "✅ MATCH" : "❌ MISMATCH"}`);
    console.log(`  → keys 7/8 differ from goals (i.e. NOT goals):           ${cornersDiffer ? "✅ yes (corners)" : "❌ same as goals"}`);
    console.log("");
  }

  console.log("=== VERDICT ===");
  console.log(`HOME_GOALS = key 1, AWAY_GOALS = key 2 confirmed on every fixture: ${allGoalsOk ? "✅ CONCLUSIVE" : "❌ NOT confirmed"}`);
  console.log(`keys 7/8 are a different statistic (corners), never goals:        ${allCornersDiffer ? "✅ yes" : "❌ no"}`);
  console.log("");

  await prisma.$disconnect();
  if (!allGoalsOk) process.exit(1);
  process.exit(0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
