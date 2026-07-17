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
  },
  FULL_TIME_HOME_WIN: {
    type: "FULL_TIME_HOME_WIN",
    label: "Will {participant1} win the match?",
    txline: {
      superOddsType: "1X2_PARTICIPANT_RESULT",
      marketParameters: "",
      marketPeriod: "",
    },
  },
  FULL_TIME_DRAW: {
    type: "FULL_TIME_DRAW",
    label: "Will the match end in a draw?",
    txline: {
      superOddsType: "1X2_PARTICIPANT_RESULT",
      marketParameters: "",
      marketPeriod: "",
    },
  },
  FULL_TIME_AWAY_WIN: {
    type: "FULL_TIME_AWAY_WIN",
    label: "Will {participant2} win the match?",
    txline: {
      superOddsType: "1X2_PARTICIPANT_RESULT",
      marketParameters: "",
      marketPeriod: "",
    },
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
