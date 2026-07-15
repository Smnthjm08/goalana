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

  it("should reject InRunning odds for market creation even when the market type is otherwise supported", () => {
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
        InRunning: true, // live/in-play — must never be used for pre-match creation
        GameState: "3",
        PriceNames: ["part1", "draw", "part2"],
        Prices: [2507, 3290, 3365],
        Pct: ["39.888", "30.395", "29.718"],
      },
    ];

    const discovered = discoverMarketsForFixture(fixture, oddsRows);

    expect(discovered.length).toBe(0);
  });

  it("should discover Over 1.5, 2.5, and 3.5 as three distinct markets with the correct thresholds", () => {
    const makeOverUnderRow = (line: string, ts: number): OddsPayload => ({
      FixtureId: 18237038,
      MessageId: `msg-${line}`,
      Ts: ts,
      Bookmaker: "Test",
      BookmakerId: 1,
      SuperOddsType: "OVERUNDER_PARTICIPANT_GOALS",
      MarketParameters: `line=${line}`,
      MarketPeriod: undefined,
      InRunning: false,
      GameState: undefined,
      PriceNames: ["over", "under"],
      Prices: [150, 150],
      Pct: ["55", "45"],
    });

    const oddsRows: OddsPayload[] = [
      makeOverUnderRow("1.5", 1000),
      makeOverUnderRow("2.5", 1000),
      makeOverUnderRow("3.5", 1000),
    ];

    const discovered = discoverMarketsForFixture(fixture, oddsRows);

    expect(discovered.length).toBe(3);

    const over15 = discovered.find((m) => m.type === "FULL_TIME_OVER_1_5");
    const over25 = discovered.find((m) => m.type === "FULL_TIME_OVER_2_5");
    const over35 = discovered.find((m) => m.type === "FULL_TIME_OVER_3_5");

    expect(over15?.predicate).toEqual({
      statAKey: TXLINE_STAT_KEYS.HOME_GOALS,
      statBKey: TXLINE_STAT_KEYS.AWAY_GOALS,
      op: { add: {} },
      threshold: 1,
      comparison: { greaterThan: {} },
    });
    expect(over25?.predicate?.threshold).toBe(2);
    expect(over35?.predicate?.threshold).toBe(3);

    // Each line must produce a structurally distinct predicate (distinct predicateHash/PDA downstream).
    const predicates = [over15, over25, over35].map((m) => JSON.stringify(m?.predicate));
    expect(new Set(predicates).size).toBe(3);
  });

  it("should only create markets for lines actually present in the odds — missing line means no market", () => {
    const oddsRows: OddsPayload[] = [
      {
        FixtureId: 18237038,
        MessageId: "msg-1",
        Ts: 1000,
        Bookmaker: "Test",
        BookmakerId: 1,
        SuperOddsType: "OVERUNDER_PARTICIPANT_GOALS",
        MarketParameters: "line=2.5", // only 2.5 is available for this fixture
        MarketPeriod: undefined,
        InRunning: false,
        GameState: undefined,
        PriceNames: ["over", "under"],
        Prices: [150, 150],
        Pct: ["55", "45"],
      },
    ];

    const discovered = discoverMarketsForFixture(fixture, oddsRows);

    expect(discovered.length).toBe(1);
    expect(discovered[0]?.type).toBe("FULL_TIME_OVER_2_5");
    expect(discovered.some((m) => m.type === "FULL_TIME_OVER_1_5")).toBe(false);
    expect(discovered.some((m) => m.type === "FULL_TIME_OVER_3_5")).toBe(false);
  });

  it("should discover exactly the 1X2 markets from the real TxLINE odds/snapshot sample (England v Argentina, fixture 18241006)", () => {
    // Verbatim shape from GET /odds/snapshot/18241006 (values only, not hardcoded into app code).
    const realFixture = {
      fixtureId: 18241006n,
      participant1: "England",
      participant2: "Argentina",
    };
    const oddsRows: OddsPayload[] = [
      {
        FixtureId: 18241006,
        MessageId: "1837908209:00003:000802-10021-stab",
        Ts: 1784134224497,
        Bookmaker: "TXLineStablePriceDemargined",
        BookmakerId: 10021,
        SuperOddsType: "1X2_PARTICIPANT_RESULT",
        GameState: undefined,
        InRunning: false,
        MarketParameters: undefined,
        MarketPeriod: undefined,
        PriceNames: ["part1", "draw", "part2"],
        Prices: [2762, 3043, 3234],
        Pct: ["36.206", "32.862", "30.921"],
      },
      {
        FixtureId: 18241006,
        MessageId: "1837908284:00003:000969-10021-stab",
        Ts: 1784134264892,
        Bookmaker: "TXLineStablePriceDemargined",
        BookmakerId: 10021,
        SuperOddsType: "ASIANHANDICAP_PARTICIPANT_GOALS",
        GameState: undefined,
        InRunning: false,
        MarketParameters: "line=0.25",
        MarketPeriod: "half=1",
        PriceNames: ["part1", "part2"],
        Prices: [1486, 3058],
        Pct: ["NA", "NA"],
      },
      {
        FixtureId: 18241006,
        MessageId: "1837908209:00003:000803-10021-stab",
        Ts: 1784134224497,
        Bookmaker: "TXLineStablePriceDemargined",
        BookmakerId: 10021,
        SuperOddsType: "ASIANHANDICAP_PARTICIPANT_GOALS",
        GameState: undefined,
        InRunning: false,
        MarketParameters: "line=-0.5",
        MarketPeriod: undefined,
        PriceNames: ["part1", "part2"],
        Prices: [2757, 1569],
        Pct: ["36.271", "63.735"],
      },
    ];

    const discovered = discoverMarketsForFixture(realFixture, oddsRows);

    // Only the full-match 1X2 row is supported — both Asian Handicap rows must be ignored.
    expect(discovered.length).toBe(3);
    expect(new Set(discovered.map((m) => m.type))).toEqual(
      new Set(["FULL_TIME_HOME_WIN", "FULL_TIME_DRAW", "FULL_TIME_AWAY_WIN"])
    );
    expect(discovered.every((m) => m.source.superOddsType === "1X2_PARTICIPANT_RESULT")).toBe(true);
  });
});
