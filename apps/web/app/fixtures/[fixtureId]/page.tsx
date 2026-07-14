"use client"

import { useEffect, useState } from "react"
import { useParams } from "next/navigation"
import axiosInstance from "@/lib/axios-instance"
import { Card, CardHeader, CardContent } from "@workspace/ui/components/card"
import { Button } from "@workspace/ui/components/button"
import { Badge } from "@workspace/ui/components/badge"

const marketTypeLabels: Record<string, string> = {
  FULL_TIME_HOME_WIN: "MATCH RESULT / FULL TIME",
  FULL_TIME_DRAW: "MATCH RESULT / FULL TIME",
  FULL_TIME_AWAY_WIN: "MATCH RESULT / FULL TIME",
  FULL_TIME_OVER_2_5: "TOTAL GOALS / FULL TIME",
  FULL_TIME_UNDER_2_5: "TOTAL GOALS / FULL TIME",
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
          OPENING PROBABILITY
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
            <span className={`font-heading text-xl ${selected === "YES" ? "text-black" : "text-foreground group-hover/yes:text-lime-400"} transition-colors`}>{market.initialYesPct}%</span>
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
            <span className={`font-heading text-xl ${selected === "NO" ? "text-white" : "text-foreground group-hover/no:text-rose-600"} transition-colors`}>{market.initialNoPct}%</span>
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

  return (
    <div className="flex w-full flex-col p-4 md:p-8 lg:p-12">
      <div className="flex w-full max-w-5xl flex-col gap-12 mx-auto">
        
        {/* Match Header */}
        <div className="flex flex-col w-full mb-4">
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

        {/* Markets Section */}
        <div className="flex flex-col gap-6">
          <h3 className="font-heading text-xl md:text-2xl uppercase tracking-widest text-foreground border-b border-border pb-4">
            Active Prediction Markets
          </h3>

          {!fixture.markets || fixture.markets.length === 0 ? (
             <div className="border border-border p-8 text-center bg-card">
               <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest">
                 No markets available for this fixture yet.
               </span>
             </div>
          ) : (
             <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
               {fixture.markets.map((market: any) => (
                 <MarketCard key={market.id} market={market} />
               ))}
             </div>
          )}
        </div>
      </div>
    </div>
  )
}
