import { TXLINE_STAT_KEYS } from "@workspace/goalana-sdk";

export const SUPPORTED_MARKETS = {
  FULL_TIME_OVER_1_5: {
    type: "FULL_TIME_OVER_1_5",
    label: "Will total goals exceed 1.5?",
    txline: {
      superOddsType: "OVERUNDER_PARTICIPANT_GOALS",
      marketParameters: "line=1.5",
      marketPeriod: "", // In DB, it's stored as empty string if null
    },
    // Goals are integers, so "over 1.5" === "sum > 1".
    threshold: 1,
    supportedForCreation: true,
  },
  FULL_TIME_OVER_2_5: {
    type: "FULL_TIME_OVER_2_5",
    label: "Will total goals exceed 2.5?",
    txline: {
      superOddsType: "OVERUNDER_PARTICIPANT_GOALS",
      marketParameters: "line=2.5",
      marketPeriod: "", // In DB, it's stored as empty string if null
    },
    threshold: 2,
    supportedForCreation: true,
  },
  FULL_TIME_OVER_3_5: {
    type: "FULL_TIME_OVER_3_5",
    label: "Will total goals exceed 3.5?",
    txline: {
      superOddsType: "OVERUNDER_PARTICIPANT_GOALS",
      marketParameters: "line=3.5",
      marketPeriod: "", // In DB, it's stored as empty string if null
    },
    threshold: 3,
    supportedForCreation: true,
  },
  FULL_TIME_HOME_WIN: {
    type: "FULL_TIME_HOME_WIN",
    label: "Will {participant1} win the match?",
    txline: {
      superOddsType: "1X2_PARTICIPANT_RESULT",
      marketParameters: "",
      marketPeriod: "",
    },
    supportedForCreation: true,
  },
  FULL_TIME_DRAW: {
    type: "FULL_TIME_DRAW",
    label: "Will the match end in a draw?",
    txline: {
      superOddsType: "1X2_PARTICIPANT_RESULT",
      marketParameters: "",
      marketPeriod: "",
    },
    supportedForCreation: true,
  },
  FULL_TIME_AWAY_WIN: {
    type: "FULL_TIME_AWAY_WIN",
    label: "Will {participant2} win the match?",
    txline: {
      superOddsType: "1X2_PARTICIPANT_RESULT",
      marketParameters: "",
      marketPeriod: "",
    },
    supportedForCreation: true,
  },

  // Half-time (1st-half) markets. Real TxLINE odds exist for these today
  // (marketPeriod: "half=1" — confirmed live against fixture 18257865's odds
  // feed), so discovery/pricing works. `supportedForCreation` stays false:
  // settlement proves a stat via a Merkle proof fetched with no period
  // parameter (`getScoresStatValidation` in @workspace/txline), and every
  // proof observed in the wild comes back as period=100/"Full match" (see
  // TXLINE_PERIOD_LABELS in @workspace/goalana-sdk's txline-stats.ts) —
  // non-full-match periods are explicitly unverified against `settle_market`.
  // A market created today would settle against the FULL-match score, not
  // the half-time score — same reason extra-time/penalty markets aren't
  // supported either. Revisit once a period-aware stat proof is wired up
  // (see todo.md, "2026-07-19 — Half-time markets").
  HALF_TIME_HOME_WIN: {
    type: "HALF_TIME_HOME_WIN",
    label: "Will {participant1} be leading at half-time?",
    txline: {
      superOddsType: "1X2_PARTICIPANT_RESULT",
      marketParameters: "",
      marketPeriod: "half=1",
    },
    supportedForCreation: false,
    unsupportedReason: "half-time settlement proof (period=1) is unverified against settle_market",
  },
  HALF_TIME_DRAW: {
    type: "HALF_TIME_DRAW",
    label: "Will the first half end level?",
    txline: {
      superOddsType: "1X2_PARTICIPANT_RESULT",
      marketParameters: "",
      marketPeriod: "half=1",
    },
    supportedForCreation: false,
    unsupportedReason: "half-time settlement proof (period=1) is unverified against settle_market",
  },
  HALF_TIME_AWAY_WIN: {
    type: "HALF_TIME_AWAY_WIN",
    label: "Will {participant2} be leading at half-time?",
    txline: {
      superOddsType: "1X2_PARTICIPANT_RESULT",
      marketParameters: "",
      marketPeriod: "half=1",
    },
    supportedForCreation: false,
    unsupportedReason: "half-time settlement proof (period=1) is unverified against settle_market",
  },
  HALF_TIME_OVER_0_5: {
    type: "HALF_TIME_OVER_0_5",
    label: "Will there be a goal in the first half?",
    txline: {
      superOddsType: "OVERUNDER_PARTICIPANT_GOALS",
      marketParameters: "line=0.5",
      marketPeriod: "half=1",
    },
    threshold: 0,
    supportedForCreation: false,
    unsupportedReason: "half-time settlement proof (period=1) is unverified against settle_market",
  },
  HALF_TIME_OVER_1_5: {
    type: "HALF_TIME_OVER_1_5",
    label: "Will first-half goals exceed 1.5?",
    txline: {
      superOddsType: "OVERUNDER_PARTICIPANT_GOALS",
      marketParameters: "line=1.5",
      marketPeriod: "half=1",
    },
    threshold: 1,
    supportedForCreation: false,
    unsupportedReason: "half-time settlement proof (period=1) is unverified against settle_market",
  },
  HALF_TIME_OVER_2_5: {
    type: "HALF_TIME_OVER_2_5",
    label: "Will first-half goals exceed 2.5?",
    txline: {
      superOddsType: "OVERUNDER_PARTICIPANT_GOALS",
      marketParameters: "line=2.5",
      marketPeriod: "half=1",
    },
    threshold: 2,
    supportedForCreation: false,
    unsupportedReason: "half-time settlement proof (period=1) is unverified against settle_market",
  },
} as const;

/**
 * Parametric prop markets — no TxLINE reference odds exist for corners/cards
 * (only 1X2 / OVERUNDER / ASIANHANDICAP goals odds are priced), so unlike
 * SUPPORTED_MARKETS above these are created unconditionally for every
 * upcoming fixture, independent of any Odds row. The pari-mutuel pool is
 * the only price ("unpriced" — initialYesPct/initialNoPct stay null).
 * Same `add + greaterThan` predicate shape as the goals Over/Under markets,
 * just on the already-validated corners (7/8) and cards (3/4) stat keys.
 */
export const PARAMETRIC_PROP_MARKETS = [
  {
    type: "TOTAL_CORNERS_OVER_9_5",
    label: "Will total corners exceed 9.5?",
    statAKey: TXLINE_STAT_KEYS.HOME_CORNERS,
    statBKey: TXLINE_STAT_KEYS.AWAY_CORNERS,
    threshold: 9,
  },
  {
    type: "TOTAL_CARDS_OVER_3_5",
    label: "Will total (yellow) cards exceed 3.5?",
    statAKey: TXLINE_STAT_KEYS.HOME_YELLOW_CARDS,
    statBKey: TXLINE_STAT_KEYS.AWAY_YELLOW_CARDS,
    threshold: 3,
  },
] as const;
