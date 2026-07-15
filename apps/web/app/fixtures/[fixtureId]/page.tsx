"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import axiosInstance from "@/lib/axios-instance"
import { Card, CardHeader, CardContent } from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
} from "@workspace/ui/components/chart"
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@workspace/ui/components/tabs"
import { LineChart, Line, CartesianGrid, XAxis, YAxis, ReferenceLine, ResponsiveContainer } from "recharts"

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
        <span className="font-mono text-[10px] text-muted-foreground tracking-widest text-center mb-[-4px]">
          TXLINE REFERENCE (OPENING) — NOT THE ON-CHAIN POOL PRICE
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
            <span className={`font-heading text-xl ${selected === "YES" ? "text-black" : "text-foreground group-hover/yes:text-lime-400"} transition-colors`}>{Number(market.initialYesPct).toFixed(2)}%</span>
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
            <span className={`font-heading text-xl ${selected === "NO" ? "text-white" : "text-foreground group-hover/no:text-rose-600"} transition-colors`}>{Number(market.initialNoPct).toFixed(2)}%</span>
          </Button>
        </div>
      </CardContent>
    </Card>
  )
}

export default function FixtureDetailPage() {
  const { fixtureId } = useParams()
  
  const [fixture, setFixture] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [oddsData, setOddsData] = useState<any>(null)
  const [visibleSeries, setVisibleSeries] = useState({ home: true, draw: true, away: true })

  useEffect(() => {
    if (!fixtureId) return
    axiosInstance.get(`/fixtures/${fixtureId}`)
      .then(res => {
        if (res.data?.data) {
          setFixture(res.data.data)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
      
    // Fetch and store the new odds history data
    axiosInstance.get(`/fixtures/${fixtureId}/odds/history`)
      .then(res => {
        if (res.data?.data) {
          console.log("[DEBUG] Odds History Data:", res.data.data.history)
          setOddsData(res.data.data)
        }
      })
      .catch(err => console.error("Error fetching odds history:", err))
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

  const toggleSeries = (series: "home" | "draw" | "away") => {
    setVisibleSeries(prev => ({ ...prev, [series]: !prev[series] }))
  }

  const marketGroups = groupMarkets(fixture.markets ?? [])

  // Chart config
  const chartConfig = {
    home: {
      label: fixture.participant1,
      color: "hsl(var(--primary))",
    },
    draw: {
      label: "Draw",
      color: "hsl(var(--muted-foreground))",
    },
    away: {
      label: fixture.participant2,
      color: "hsl(var(--chart-2))", // using chart-2 for distinction
    },
  }

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
               {fixture.gameState === 3 ? "LIVE" : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
             </span>
          </div>

          <div className="border-t border-b border-border py-12 flex items-center justify-between w-full relative">
            <div className="flex flex-col flex-1 items-start">
              <span className="font-sans font-black text-3xl md:text-5xl lg:text-6xl text-foreground leading-none">
                {fixture.participant1}
              </span>
            </div>
            
            <div className="flex flex-col items-center justify-center px-4 absolute left-1/2 -translate-x-1/2">
               <span className="font-mono text-sm md:text-base text-muted-foreground tracking-widest mb-2">
                 VS
               </span>
               <span className="font-heading text-4xl md:text-5xl text-foreground font-bold">
                 {fixture.gameState === 3 ? "0 - 0" : "UPCOMING"}
               </span>
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
            {!oddsData?.history?.length ? (
              <div className="border border-border p-8 text-center bg-card rounded-sm">
                <span className="font-mono text-sm text-muted-foreground uppercase tracking-wider">
                  Fetching immutable line history...
                </span>
              </div>
            ) : (
              <div className="border border-border bg-card rounded-sm p-6 lg:p-8 relative">
                {/* Header */}
                <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
                  <div className="flex flex-col gap-1">
                    <h3 className="font-heading text-xl uppercase tracking-widest text-foreground">
                      Match Result
                    </h3>
                    <span className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">
                      Implied Probabilities
                    </span>
                  </div>
                  
                  <div className="flex flex-wrap items-center gap-3">
                    <Button 
                      variant="outline" 
                      onClick={() => toggleSeries("home")}
                      className={`h-auto py-2 px-3 flex-col items-start gap-1 rounded-sm border transition-colors ${visibleSeries.home ? 'border-primary/50 bg-primary/5' : 'border-border bg-transparent opacity-50 hover:opacity-100'}`}
                    >
                      <span className="font-mono text-[10px] uppercase text-muted-foreground">{fixture.participant1}</span>
                      <span className="font-heading text-lg text-foreground leading-none">{oddsData.latest.home.toFixed(2)}%</span>
                    </Button>

                    <Button 
                      variant="outline" 
                      onClick={() => toggleSeries("draw")}
                      className={`h-auto py-2 px-3 flex-col items-start gap-1 rounded-sm border transition-colors ${visibleSeries.draw ? 'border-muted-foreground/50 bg-muted/20' : 'border-border bg-transparent opacity-50 hover:opacity-100'}`}
                    >
                      <span className="font-mono text-[10px] uppercase text-muted-foreground">DRAW</span>
                      <span className="font-heading text-lg text-foreground leading-none">{oddsData.latest.draw.toFixed(2)}%</span>
                    </Button>

                    <Button 
                      variant="outline" 
                      onClick={() => toggleSeries("away")}
                      className={`h-auto py-2 px-3 flex-col items-start gap-1 rounded-sm border transition-colors ${visibleSeries.away ? 'border-chart-2/50 bg-chart-2/5' : 'border-border bg-transparent opacity-50 hover:opacity-100'}`}
                    >
                      <span className="font-mono text-[10px] uppercase text-muted-foreground">{fixture.participant2}</span>
                      <span className="font-heading text-lg text-foreground leading-none">{oddsData.latest.away.toFixed(2)}%</span>
                    </Button>
                  </div>
                </div>

                {/* Graph */}
                <div className="w-full mt-6">
                  <ChartContainer config={chartConfig} className="h-[400px] w-full aspect-auto">
                    <LineChart data={oddsData.history} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
                      <CartesianGrid strokeDasharray="3 3" stroke="hsl(var(--border))" vertical={false} />
                      
                      <XAxis 
                        dataKey="timestamp" 
                        type="number"
                        domain={['dataMin', 'dataMax']}
                        tickFormatter={(val) => new Date(val).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        tickMargin={10}
                      />
                      
                      <YAxis 
                        domain={[0, 100]}
                        tickFormatter={(val) => `${val}%`}
                        stroke="hsl(var(--muted-foreground))"
                        fontSize={10}
                        tickLine={false}
                        axisLine={false}
                        tickMargin={10}
                      />

                      <ChartTooltip 
                        content={<ChartTooltipContent 
                          labelFormatter={(label) => new Date(label).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
                        />}
                        cursor={{ stroke: "hsl(var(--muted-foreground))", strokeWidth: 1, strokeDasharray: "3 3" }}
                      />

                      {fixture.startTime && oddsData.history.some((h: any) => h.timestamp > new Date(fixture.startTime).getTime()) && (
                        <ReferenceLine 
                          x={new Date(fixture.startTime).getTime()} 
                          stroke="hsl(var(--primary))" 
                          strokeDasharray="3 3"
                          label={{ position: 'top', value: 'KICKOFF', fill: 'hsl(var(--primary))', fontSize: 10, fontFamily: 'monospace' }}
                        />
                      )}

                      {visibleSeries.home && (
                        <Line 
                          type="stepAfter" 
                          dataKey="home" 
                          stroke="var(--color-home)" 
                          strokeWidth={2} 
                          dot={false} 
                          activeDot={{ r: 4, fill: "var(--color-home)" }}
                          isAnimationActive={false}
                        />
                      )}
                      {visibleSeries.draw && (
                        <Line 
                          type="stepAfter" 
                          dataKey="draw" 
                          stroke="var(--color-draw)" 
                          strokeWidth={2} 
                          dot={false} 
                          activeDot={{ r: 4, fill: "var(--color-draw)" }}
                          isAnimationActive={false}
                        />
                      )}
                      {visibleSeries.away && (
                        <Line 
                          type="stepAfter" 
                          dataKey="away" 
                          stroke="var(--color-away)" 
                          strokeWidth={2} 
                          dot={false} 
                          activeDot={{ r: 4, fill: "var(--color-away)" }}
                          isAnimationActive={false}
                        />
                      )}
                    </LineChart>
                  </ChartContainer>
                </div>

                {/* Footer Metadata */}
                <div className="flex flex-col sm:flex-row items-center justify-between border-t border-border pt-4 mt-2 gap-4">
                   <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest text-center sm:text-left">
                     LATEST UPDATE / {new Date(oddsData.history[oddsData.history.length - 1].timestamp).toLocaleTimeString()}
                   </span>
                   <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest text-center sm:text-right">
                     HISTORY POINTS / {oddsData.history.length} <br className="sm:hidden" />
                     <span className="hidden sm:inline"> • </span>
                     SOURCE / TXLINE
                   </span>
                </div>
              </div>
            )}
          </TabsContent>
        </Tabs>
      </div>
    </div>
  )
}
