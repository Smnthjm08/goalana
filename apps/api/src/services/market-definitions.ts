export const SUPPORTED_MARKETS = {
  TOTAL_GOALS_OVER_2_5: {
    type: "TOTAL_GOALS_OVER_2_5",
    label: "Will total goals exceed 2.5?",
    txline: {
      superOddsType: "OVERUNDER_PARTICIPANT_GOALS",
      marketParameters: "line=2.5",
      marketPeriod: null,
    },
  },
} as const;
