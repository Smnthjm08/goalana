"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import axiosInstance from "@/lib/axios-instance"
import { Card, CardHeader, CardContent, CardFooter } from "@workspace/ui/components/card"

export default function Page() {
  const [fixtures, setFixtures] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    axiosInstance.get("/fixtures")
      .then(res => {
        if (res.data?.data) {
          setFixtures(res.data.data)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex w-full flex-col p-4 md:p-8 lg:p-12">
      <div className="flex w-full max-w-6xl flex-col gap-6 mx-auto">
        <h2 className="font-heading text-2xl uppercase tracking-widest text-primary border-b border-border pb-4">
          Live & Upcoming Markets
        </h2>

        {loading ? (
          <div className="border border-border p-8 text-center bg-card">
            <span className="font-mono text-sm text-muted-foreground uppercase tracking-wider animate-pulse">
              [ Fetching Immutable Ledger... ]
            </span>
          </div>
        ) : fixtures.length === 0 ? (
          <div className="border border-border p-8 text-center bg-card">
            <span className="font-mono text-sm text-muted-foreground uppercase tracking-wider">
              No active fixtures found.
            </span>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {fixtures.map((fixture) => {
              // Usually timestamps from TxLINE are in ms if 13 digits, else seconds. 
              const tsNum = Number(fixture.startTime)
              const date = new Date(tsNum > 1e11 ? tsNum : tsNum * 1000)
              
              return (
                <Link key={fixture.fixtureId} href={`/fixtures/${fixture.fixtureId}`}>
                  <Card 
                    className="group relative flex flex-col transition-colors hover:border-primary cursor-pointer h-full"
                  >
                    {/* Header: Score / Time */}
                    <CardHeader className="flex flex-row items-center justify-between border-b border-border p-3 pb-3 space-y-0">
                      <span className="font-mono text-[10px] text-muted-foreground uppercase">
                        {fixture.competition}
                      </span>
                      <span className="font-mono text-[10px] text-primary">
                        {fixture.gameState === 3 ? "LIVE" : date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                      </span>
                    </CardHeader>
                    
                    {/* Body: Teams */}
                    <CardContent className="flex flex-col gap-3 p-4 pt-4">
                      <div className="flex items-center justify-between">
                        <span className="font-sans font-bold text-foreground">{fixture.participant1}</span>
                        <span className="font-heading text-xl">0</span>
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="font-sans font-bold text-foreground">{fixture.participant2}</span>
                        <span className="font-heading text-xl">0</span>
                      </div>
                    </CardContent>

                    {/* Footer: Markets count & Prov */}
                    <CardFooter className="mt-auto flex flex-row items-center justify-between border-t border-border bg-muted/50 p-3 pt-3">
                      <span className="font-mono text-[10px] text-muted-foreground">
                        ID: {fixture.fixtureId}
                      </span>
                      <span className="font-mono text-[10px] text-primary">
                        {fixture._count?.markets || 0} MARKETS
                      </span>
                    </CardFooter>
                  </Card>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
