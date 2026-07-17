export const marketTypeLabels: Record<string, string> = {
  FULL_TIME_HOME_WIN: "MATCH RESULT / FULL TIME",
  FULL_TIME_DRAW: "MATCH RESULT / FULL TIME",
  FULL_TIME_AWAY_WIN: "MATCH RESULT / FULL TIME",
  FULL_TIME_OVER_1_5: "TOTAL GOALS / FULL TIME",
  FULL_TIME_OVER_2_5: "TOTAL GOALS / FULL TIME",
  FULL_TIME_OVER_3_5: "TOTAL GOALS / FULL TIME",
  TOTAL_CORNERS_OVER_9_5: "PARAMETRIC PROP / FULL TIME",
  TOTAL_CARDS_OVER_3_5: "PARAMETRIC PROP / FULL TIME",
}

// Section grouping for the Markets tab — keeps the six supported markets
// organized as MATCH RESULT / TOTAL GOALS instead of one flat, unlabeled grid.
const MARKET_GROUPS: Record<string, string> = {
  FULL_TIME_HOME_WIN: "MATCH RESULT",
  FULL_TIME_DRAW: "MATCH RESULT",
  FULL_TIME_AWAY_WIN: "MATCH RESULT",
  FULL_TIME_OVER_1_5: "TOTAL GOALS",
  FULL_TIME_OVER_2_5: "TOTAL GOALS",
  FULL_TIME_OVER_3_5: "TOTAL GOALS",
  TOTAL_CORNERS_OVER_9_5: "PARAMETRIC PROPS",
  TOTAL_CARDS_OVER_3_5: "PARAMETRIC PROPS",
}
const MARKET_GROUP_ORDER = ["MATCH RESULT", "TOTAL GOALS", "PARAMETRIC PROPS", "OTHER"]

export function groupMarkets(
  markets: any[]
): Array<{ group: string; markets: any[] }> {
  const byGroup = new Map<string, any[]>()

  for (const market of markets) {
    const group = MARKET_GROUPS[market.marketType] ?? "OTHER"
    const bucket = byGroup.get(group) ?? []
    bucket.push(market)
    byGroup.set(group, bucket)
  }

  return MARKET_GROUP_ORDER.map((group) => ({
    group,
    markets: byGroup.get(group) ?? [],
  })).filter((entry) => entry.markets.length > 0)
}
