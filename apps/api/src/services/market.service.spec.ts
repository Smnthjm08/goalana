import { describe, it, expect } from "bun:test";
import { discoverMarketsForFixture } from "./market.service";
import type { OddsPayload } from "@workspace/txline";
import { TXLINE_STAT_KEYS } from "@workspace/goalana-sdk";
import { SUPPORTED_MARKETS } from "./market-definitions";

describe("Market Discovery Service", () => {
  const fixture = {
    fixtureId: 18237038n,
    participant1: "Home Team",
    participant2: "Away Team",
  };

  it("should deduplicate logical markets and select the latest Ts", () => {
    const oddsRows: OddsPayload[] = [
      {
        FixtureId: 18237038,
        MessageId: "msg-1",
        Ts: 1000,
        Bookmaker: "Test",
        BookmakerId: 1,
        SuperOddsType: "OVERUNDER_PARTICIPANT_GOALS",
        MarketParameters: "line=2.5",
        MarketPeriod: undefined,
        InRunning: false,
        GameState: undefined,
        PriceNames: ["over", "under"],
        Prices: [100, 200],
        Pct: ["50", "50"],
      },
      {
        FixtureId: 18237038,
        MessageId: "msg-2",
        Ts: 2000, // Latest
        Bookmaker: "Test",
        BookmakerId: 1,
        SuperOddsType: "OVERUNDER_PARTICIPANT_GOALS",
        MarketParameters: "line=2.5",
        MarketPeriod: undefined,
        InRunning: false,
        GameState: undefined,
        PriceNames: ["over", "under"],
        Prices: [150, 150],
        Pct: ["60", "40"],
      },
    ];

    const discovered = discoverMarketsForFixture(fixture, oddsRows);
    
    expect(discovered.length).toBe(1);
    const market = discovered[0]!;
    expect(market.type).toBe("FULL_TIME_OVER_2_5");
    expect(market.source.messageId).toBe("msg-2");
    expect(market.referenceProbability?.yesPct).toBe(60);
    expect(market.referenceProbability?.noPct).toBe(40);
  });

  it("should discover FULL_TIME_HOME_WIN and generate the correct predicate", () => {
    const oddsRows: OddsPayload[] = [
      {
        FixtureId: 18237038,
        MessageId: "msg-1",
        Ts: 1000,
        Bookmaker: "Test",
        BookmakerId: 1,
        SuperOddsType: "1X2_PARTICIPANT_RESULT",
        MarketParameters: undefined,
        MarketPeriod: undefined,
        InRunning: false,
        GameState: undefined,
        PriceNames: ["part1", "draw", "part2"],
        Prices: [2507, 3290, 3365],
        Pct: ["39.888", "30.395", "29.718"],
      },
    ];

    const discovered = discoverMarketsForFixture(fixture, oddsRows);
    
    // Should extract 3 markets from one 1X2 odds row
    expect(discovered.length).toBe(3);
    
    const homeWin = discovered.find(m => m.type === "FULL_TIME_HOME_WIN");
    expect(homeWin).toBeDefined();
    expect(homeWin?.question).toBe("Will Home Team win the match?");
    expect(homeWin?.referenceProbability?.yesPct).toBe(39.888);
    expect(homeWin?.referenceProbability?.noPct).toBeCloseTo(100 - 39.888);
    expect(homeWin?.predicate).toEqual({
      statAKey: TXLINE_STAT_KEYS.HOME_GOALS,
      statBKey: TXLINE_STAT_KEYS.AWAY_GOALS,
      op: { subtract: {} },
      threshold: 0,
      comparison: { greaterThan: {} },
    });

    const awayWin = discovered.find(m => m.type === "FULL_TIME_AWAY_WIN");
    expect(awayWin).toBeDefined();
    expect(awayWin?.question).toBe("Will Away Team win the match?");
    expect(awayWin?.predicate?.comparison).toEqual({ lessThan: {} });
  });

  it("should handle mixed PriceNames array orders correctly", () => {
    const oddsRows: OddsPayload[] = [
      {
        FixtureId: 18237038,
        MessageId: "msg-1",
        Ts: 1000,
        Bookmaker: "Test",
        BookmakerId: 1,
        SuperOddsType: "OVERUNDER_PARTICIPANT_GOALS",
        MarketParameters: "line=2.5",
        MarketPeriod: undefined,
        InRunning: false,
        GameState: undefined,
        PriceNames: ["under", "over"], // Swapped!
        Prices: [200, 100],
        Pct: ["40", "60"], // under is 40%, over is 60%
      },
    ];

    const discovered = discoverMarketsForFixture(fixture, oddsRows);
    expect(discovered.length).toBe(1);
    const market = discovered[0]!;
    
    expect(market.referenceProbability?.yesPct).toBe(60);
    expect(market.referenceProbability?.noPct).toBe(40);
  });

  it("should ignore unsupported markets", () => {
    const oddsRows: OddsPayload[] = [
      {
        FixtureId: 18237038,
        MessageId: "msg-1",
        Ts: 1000,
        Bookmaker: "Test",
        BookmakerId: 1,
        SuperOddsType: "1X2_PARTICIPANT_RESULT",
        MarketParameters: undefined,
        MarketPeriod: "half=1", // First half not supported yet
        InRunning: false,
        GameState: undefined,
        PriceNames: ["part1", "draw", "part2"],
        Prices: [2507, 3290, 3365],
        Pct: ["39.888", "30.395", "29.718"],
      },
    ];

    const discovered = discoverMarketsForFixture(fixture, oddsRows);
    
    // Nothing should be returned for unsupported markets in Phase 1
    // (In our current implementation, we just don't push them to `discovered`)
    expect(discovered.length).toBe(0);
  });
});
