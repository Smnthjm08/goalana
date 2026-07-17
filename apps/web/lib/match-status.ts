// Single definition of "is the ball in play?", shared by the home cards, the
// fixture header, the lifecycle strip, and the match-time countdown. Previously
// copy-pasted into each — they must agree, or one surface shows LIVE while
// another shows a kickoff time for the same fixture.

/**
 * Soccer StatusId values meaning the ball is (or was very recently) in play:
 * H1, HT, H2 and the extra-time/penalty equivalents. Matches the documented
 * Status Id table; only H1/HT/H2 (2/3/4) are exercised by real fixture data so far.
 */
export const IN_PROGRESS_STATUS_IDS = new Set([2, 3, 4, 6, 7, 8, 9, 11, 12])

/** The minimum shape every live-status surface needs. */
export interface LiveScoreLike {
  statusId: number | null
  minuteLabel?: string | null
  isFinal: boolean
}

export type MatchPhase = "upcoming" | "live" | "final"

/**
 * Which of the three states a fixture is in. `isFinal` wins over an
 * in-progress StatusId: the feed can report a terminal fixture with a
 * non-standard StatusId (100 via "game_finalised" — see scores.processor.ts),
 * and a finished match must never render as LIVE.
 */
export function getMatchPhase(
  liveScore: LiveScoreLike | null | undefined
): MatchPhase {
  if (!liveScore || liveScore.statusId === null) return "upcoming"
  if (liveScore.isFinal) return "final"
  return IN_PROGRESS_STATUS_IDS.has(liveScore.statusId) ? "live" : "upcoming"
}
