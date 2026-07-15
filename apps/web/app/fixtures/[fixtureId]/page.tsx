"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import axiosInstance from "@/lib/axios-instance"
import { Card, CardHeader, CardContent } from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { OddsMovementChart } from "@/components/fixtures/odds-movement-chart"
import { LiveScoreHeader } from "@/components/fixtures/live-score-header"
import { MatchEventTimeline } from "@/components/fixtures/match-event-timeline"

const marketTypeLabels: Record<string, string> = {
  FULL_TIME_HOME_WIN: "MATCH RESULT / FULL TIME",
  FULL_TIME_DRAW: "MATCH RESULT / FULL TIME",
  FULL_TIME_AWAY_WIN: "MATCH RESULT / FULL TIME",
  FULL_TIME_OVER_1_5: "TOTAL GOALS / FULL TIME",
  FULL_TIME_OVER_2_5: "TOTAL GOALS / FULL TIME",
  FULL_TIME_OVER_3_5: "TOTAL GOALS / FULL TIME",
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
}
const MARKET_GROUP_ORDER = ["MATCH RESULT", "TOTAL GOALS", "OTHER"]

function groupMarkets(markets: any[]): Array<{ group: string; markets: any[] }> {
  const byGroup = new Map<string, any[]>()

  for (const market of markets) {
    const group = MARKET_GROUPS[market.marketType] ?? "OTHER"
    const bucket = byGroup.get(group) ?? []
    bucket.push(market)
    byGroup.set(group, bucket)
  }

  return MARKET_GROUP_ORDER
    .map((group) => ({ group, markets: byGroup.get(group) ?? [] }))
    .filter((entry) => entry.markets.length > 0)
}

function MarketCard({ market }: { market: any }) {
  const [selected, setSelected] = useState<"YES" | "NO" | null>(null)

  // currentYesPct/currentNoPct are the live TxLINE reference probability
  // (server-joined from the current Odds row); fall back to the opening
  // snapshot captured at market creation if a live match isn't available yet.
  const yesPct = Number(market.currentYesPct ?? market.initialYesPct)
  const noPct = Number(market.currentNoPct ?? market.initialNoPct)

  return (
    <Card className="flex flex-col rounded-sm hover:border-primary/50 transition-colors">
      <CardHeader className="border-b border-border p-5 bg-card">
        <span className="font-sans font-bold text-lg text-foreground">
          {market.question}
        </span>
        <div className="flex items-center justify-between mt-3">
          <span className="font-mono text-[10px] text-muted-foreground uppercase">
            {marketTypeLabels[market.marketType] || market.marketType.replace(/_/g, ' ')}
          </span>
          <Badge variant="outline" className="text-[10px] text-primary border-primary/20 bg-primary/5">
            ● {market.status}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="p-5 flex flex-col gap-4">
        <span className="font-mono text-[10px] text-muted-foreground tracking-widest text-center -mb-1">
          TXLINE REFERENCE — NOT GOALANA&lsquo;S ON-CHAIN POOL PRICE
        </span>
        <div className="grid grid-cols-2 gap-4">
          <Button
            variant="outline"
            onClick={() => setSelected(selected === "YES" ? null : "YES")}
            className={`h-auto flex-row items-center justify-between p-4 rounded-sm transition-colors ${
              selected === "YES"
                ? "bg-lime-400 border-lime-400 text-black hover:bg-lime-500 hover:text-black hover:border-lime-500"
                : "border-border bg-card text-muted-foreground hover:border-lime-400 hover:text-lime-400 group/yes"
            }`}
          >
            <span className={`font-mono text-xs ${selected === "YES" ? "text-black/70" : "text-muted-foreground group-hover/yes:text-lime-400"} transition-colors`}>YES</span>
            <span className={`font-heading text-xl ${selected === "YES" ? "text-black" : "text-foreground group-hover/yes:text-lime-400"} transition-colors`}>{yesPct.toFixed(2)}%</span>
          </Button>
          <Button
            variant="outline"
            onClick={() => setSelected(selected === "NO" ? null : "NO")}
            className={`h-auto flex-row items-center justify-between p-4 rounded-sm transition-colors ${
              selected === "NO"
                ? "bg-rose-600 border-rose-600 text-white hover:bg-rose-700 hover:text-white hover:border-rose-700"
                : "border-border bg-card text-muted-foreground hover:border-rose-600 hover:text-rose-600 group/no"
            }`}
          >
            <span className={`font-mono text-xs ${selected === "NO" ? "text-white/70" : "text-muted-foreground group-hover/no:text-rose-600"} transition-colors`}>NO</span>
            <span className={`font-heading text-xl ${selected === "NO" ? "text-white" : "text-foreground group-hover/no:text-rose-600"} transition-colors`}>{noPct.toFixed(2)}%</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

// Lightweight polling for live TxLINE reference odds — reuses the existing
// fixture endpoint rather than adding a new SSE/WS layer. The odds-history
// chart data has its own identical polling loop inside OddsMovementChart.
const FIXTURE_POLL_INTERVAL_MS = 8_000

export default function FixtureDetailPage() {
  const { fixtureId } = useParams()

  const [fixture, setFixture] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  useEffect(() => {
    if (!fixtureId) return

    let cancelled = false

    const fetchFixture = () =>
      axiosInstance.get(`/fixtures/${fixtureId}`)
        .then(res => {
          if (cancelled) return
          if (res.data?.data) {
            setFixture(res.data.data)
            setRefreshError(null)
          }
        })
        .catch(err => {
          if (cancelled) return
          console.error("Error fetching fixture:", err)
          // Keep whatever is already rendered — a transient poll failure
          // must not blank out the market cards.
          setRefreshError("Live update failed — showing last known data")
        })

    fetchFixture().finally(() => {
      if (!cancelled) setLoading(false)
    })

    const intervalId = setInterval(() => {
      void fetchFixture()
    }, FIXTURE_POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [fixtureId])

  if (loading) {
    return (
      <div className="flex w-full flex-col p-4 md:p-8 lg:p-12 items-center justify-center min-h-[50vh]">
         <span className="font-mono text-sm text-muted-foreground uppercase tracking-wider animate-pulse">
            [ Fetching Fixture Data... ]
         </span>
      </div>
    )
  }

  if (!fixture) {
    return (
      <div className="flex w-full flex-col p-4 md:p-8 lg:p-12 items-center justify-center min-h-[50vh]">
         <span className="font-mono text-sm text-destructive uppercase tracking-wider">
            [ Fixture Not Found ]
         </span>
      </div>
    )
  }

  const tsNum = Number(fixture.startTime)
  const date = new Date(tsNum > 1e11 ? tsNum : tsNum * 1000)

  const marketGroups = groupMarkets(fixture.markets ?? [])

  return (
    <div className="flex w-full flex-col p-4 md:p-8 lg:p-12">
      <div className="flex w-full max-w-5xl flex-col gap-8 mx-auto">
        
        {/* Match Header */}
        <div className="flex flex-col w-full mb-2">
          <div className="flex items-center justify-between mb-6">
             <span className="font-mono text-xs md:text-sm text-foreground uppercase tracking-widest">
               {fixture.competition}
             </span>
             <span className="font-mono text-xs md:text-sm text-primary uppercase tracking-widest">
               {fixture.liveScore?.statusId != null
                 ? (fixture.liveScore.periodLabel ?? "LIVE")
                 : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
             </span>
          </div>

          <div className="border-t border-b border-border py-12 flex items-center justify-between w-full relative">
            <div className="flex flex-col flex-1 items-start">
              <span className="font-sans font-black text-3xl md:text-5xl lg:text-6xl text-foreground leading-none">
                {fixture.participant1}
              </span>
            </div>
            
            <div className="absolute left-1/2 -translate-x-1/2">
              <LiveScoreHeader
                liveScore={fixture.liveScore}
                kickoffLabel={date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
              />
            </div>

            <div className="flex flex-col flex-1 items-end">
              <span className="font-sans font-black text-3xl md:text-5xl lg:text-6xl text-foreground leading-none text-right">
                {fixture.participant2}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-between mt-6">
             <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
               FIXTURE / {fixture.fixtureId}
             </span>
             <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
               DATA / TXLINE
             </span>
          </div>
          {refreshError && (
            <div className="mt-2 text-right">
              <span className="font-mono text-[10px] text-destructive uppercase tracking-widest">
                [ {refreshError} ]
              </span>
            </div>
          )}
        </div>
        {/* Tabs */}
        <Tabs defaultValue="MARKETS" className="w-full">
          <TabsList variant="line" className="w-full justify-start border-b border-border rounded-none h-auto p-0 gap-8">
            <TabsTrigger 
              value="MARKETS"
              className="font-heading uppercase tracking-widest pb-4 pt-0 px-0 text-sm bg-transparent data-[state=active]:bg-transparent text-muted-foreground hover:text-foreground data-[state=active]:text-primary after:bg-primary"
            >
              Markets
            </TabsTrigger>
            <TabsTrigger
              value="ODDS_MOVEMENT"
              className="font-heading uppercase tracking-widest pb-4 pt-0 px-0 text-sm bg-transparent data-[state=active]:bg-transparent text-muted-foreground hover:text-foreground data-[state=active]:text-primary after:bg-primary"
            >
              Odds & Movement
            </TabsTrigger>
            <TabsTrigger
              value="MATCH_EVENTS"
              className="font-heading uppercase tracking-widest pb-4 pt-0 px-0 text-sm bg-transparent data-[state=active]:bg-transparent text-muted-foreground hover:text-foreground data-[state=active]:text-primary after:bg-primary"
            >
              Match Events
            </TabsTrigger>
          </TabsList>

          <TabsContent value="MARKETS" className="mt-8 border-none p-0 outline-none">
            {fixture._count?.markets === 0 ? (
              <div className="border border-border p-8 text-center bg-card rounded-sm">
                <span className="font-mono text-sm text-muted-foreground uppercase tracking-wider">
                  No prediction markets available for this fixture.
                </span>
              </div>
            ) : (
              <div className="flex flex-col gap-8">
                {marketGroups.map(({ group, markets }) => (
                  <div key={group} className="flex flex-col gap-4">
                    <h3 className="font-heading text-sm uppercase tracking-widest text-muted-foreground border-b border-border pb-2">
                      {group}
                    </h3>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                      {markets.map((market: any) => (
                        <MarketCard key={market.id} market={market} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent value="ODDS_MOVEMENT" className="mt-8 border-none p-0 outline-none">
            <OddsMovementChart
              fixtureId={fixture.fixtureId}
              participant1={fixture.participant1}
              participant2={fixture.participant2}
              startTime={fixture.startTime}
            />
          </TabsContent>

          <TabsContent value="MATCH_EVENTS" className="mt-8 border-none p-0 outline-none">
            <MatchEventTimeline
              events={fixture.events ?? []}
              participant1={fixture.participant1}
              participant2={fixture.participant2}
              participant1IsHome={fixture.participant1IsHome}
            />
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
