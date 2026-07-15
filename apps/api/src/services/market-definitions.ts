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
