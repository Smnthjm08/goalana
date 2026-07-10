import express from "express"
import cors from "cors"
import { prisma } from "@workspace/db";
import { FixtureService, OddsService } from "@workspace/txline";

const app = express();
const port = 8080

app.use(express.json());
app.use(cors({ origin: "http://localhost:3000" }))

app.get("/", async (req, res) => {
  res.json({ status: "healthy!" })
})

// TODO worker needed
app.get("/api/fixtures/snapshot", async (req, res) => {
  const fixtureService = new FixtureService();
  const fixtures = await fixtureService.getFixtureSnapshot(undefined, 72);

  if (!fixtures) {
    res.status(502).json({ error: "Failed to fetch fixtures from TxLINE" });
    return;
  }

  for (const fixture of fixtures) {
    await prisma.fixture.upsert({
      where: {
        fixtureId: BigInt(fixture.FixtureId),
      },
      update: {
        ts: BigInt(fixture.Ts),
        startTime: BigInt(fixture.StartTime),
        competition: fixture.Competition,
        competitionId: fixture.CompetitionId,
        fixtureGroupId: fixture.FixtureGroupId,
        participant1Id: fixture.Participant1Id,
        participant1: fixture.Participant1,
        participant2Id: fixture.Participant2Id,
        participant2: fixture.Participant2,
        participant1IsHome: fixture.Participant1IsHome,
        gameState: fixture.GameState ?? null,
      },
      create: {
        fixtureId: BigInt(fixture.FixtureId),
        ts: BigInt(fixture.Ts),
        startTime: BigInt(fixture.StartTime),
        competition: fixture.Competition,
        competitionId: fixture.CompetitionId,
        fixtureGroupId: fixture.FixtureGroupId,
        participant1Id: fixture.Participant1Id,
        participant1: fixture.Participant1,
        participant2Id: fixture.Participant2Id,
        participant2: fixture.Participant2,
        participant1IsHome: fixture.Participant1IsHome,
        gameState: fixture.GameState ?? null,
      },
    });
  }

  res.status(200).json(fixtures);
})

app.get("/api/odds/snapshot", async (req, res) => {
  const oddsService = new OddsService();

  const fixtures = await prisma.fixture.findMany();

  for (const fixture of fixtures) {
    const odds = await oddsService.getOddsSnapshots(Number(fixture.fixtureId));

    if (!odds) continue;

    for (const market of odds) {
      await prisma.odds.upsert({
        where: {
          fixtureId_bookmakerId_superOddsType_marketPeriod_marketParameters: {
            fixtureId: BigInt(market.FixtureId),
            bookmakerId: market.BookmakerId,
            superOddsType: market.SuperOddsType,
            marketPeriod: market.MarketPeriod ?? "",
            marketParameters: market.MarketParameters ?? "",
          },
        },
        update: {
          ts: BigInt(market.Ts),
          bookmaker: market.Bookmaker,
          bookmakerId: market.BookmakerId,
          superOddsType: market.SuperOddsType,
          marketParameters: market.MarketParameters ?? "",
          marketPeriod: market.MarketPeriod ?? "",
          inRunning: market.InRunning,
          gameState: market.GameState ?? null,
          priceNames: market.PriceNames ?? [],
          prices: market.Prices ?? [],
          probabilities: market.Pct ?? [],
        },
        create: {
          fixtureId: BigInt(market.FixtureId),
          messageId: market.MessageId,
          ts: BigInt(market.Ts),
          bookmaker: market.Bookmaker,
          bookmakerId: market.BookmakerId,
          superOddsType: market.SuperOddsType,
          marketParameters: market.MarketParameters ?? "",
          marketPeriod: market.MarketPeriod ?? "",
          inRunning: market.InRunning,
          gameState: market.GameState ?? null,
          priceNames: market.PriceNames ?? [],
          prices: market.Prices ?? [],
          probabilities: market.Pct ?? [],
        },
      });
    }
  }

  res.json({ success: true });
});


app.listen(port, () => {
  console.log(`Listening on port ${port}...`)
})
