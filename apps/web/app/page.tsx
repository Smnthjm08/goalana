"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import axiosInstance from "@/lib/axios-instance"
import { Card, CardHeader, CardContent, CardFooter } from "@workspace/ui/components/card"
import { Badge } from "@workspace/ui/components/badge"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { TeamBadge } from "@/components/team-badge"
import { explorerAddressUrl } from "@/lib/solana-explorer"
import { GOALANA_PROGRAM_ID, TRUST_STATEMENT, LIFECYCLE_STEPS } from "@/lib/protocol"

// StatusIds where the ball is (or was recently) in play — mirrors the fixture
// detail page + lifecycle strip. Used to decide whether a card shows a live
// score or a kickoff time (never a fake 0–0).
const IN_PROGRESS_STATUS_IDS = new Set([2, 3, 4, 6, 7, 8, 9, 11, 12])

function Hero() {
  return (
    <div className="flex w-full flex-col gap-8 border border-border bg-card rounded-sm p-6 md:p-10">
      <div className="flex flex-col gap-4">
        <span className="font-mono text-[10px] md:text-xs text-primary uppercase tracking-[0.25em]">
          Trustless settlement · Solana Devnet · Powered by TxLINE
        </span>
        <h1 className="font-heading text-3xl md:text-5xl lg:text-6xl font-black uppercase tracking-tight text-foreground leading-[0.95]">
          World Cup markets that<br className="hidden md:block" /> settle themselves.
        </h1>
        <p className="max-w-2xl font-sans text-sm md:text-base text-muted-foreground leading-relaxed">
          {TRUST_STATEMENT}
        </p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1">
          <a
            href={explorerAddressUrl(GOALANA_PROGRAM_ID)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] md:text-xs text-muted-foreground hover:text-primary transition-colors underline"
          >
            Program {GOALANA_PROGRAM_ID.slice(0, 6)}…{GOALANA_PROGRAM_ID.slice(-6)} — verify on Explorer ↗
          </a>
        </div>
      </div>

      {/* How it works — the protocol lifecycle, settlement highlighted. */}
      <div className="flex flex-col gap-3 border-t border-border pt-6">
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest">
          How a market resolves
        </span>
        <div className="grid grid-cols-2 md:grid-cols-5 gap-2">
          {LIFECYCLE_STEPS.map((step, i) => (
            <div
              key={step.key}
              className={`flex flex-col gap-1.5 border rounded-sm p-3 ${
                step.trust ? "border-primary/40 bg-primary/5" : "border-border bg-background"
              }`}
            >
              <div className="flex items-center gap-2">
                <span className={`font-mono text-[10px] ${step.trust ? "text-primary" : "text-muted-foreground"}`}>
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span className={`font-heading text-xs uppercase tracking-widest ${step.trust ? "text-primary" : "text-foreground"}`}>
                  {step.label}
                </span>
              </div>
              <span className="font-mono text-[10px] leading-snug text-muted-foreground">
                {step.detail}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

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
      <div className="flex w-full max-w-6xl flex-col gap-10 mx-auto">
        <Hero />

        <div className="flex flex-col gap-6">
          <h2 className="font-heading text-2xl uppercase tracking-widest text-primary border-b border-border pb-4">
            Live & Upcoming Markets
          </h2>

          {loading ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-48 w-full rounded-sm" />
              ))}
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

                const isFinal = fixture.finalSeq != null
                const isLive =
                  fixture.gameState === 3 ||
                  (fixture.liveStatusId != null && IN_PROGRESS_STATUS_IDS.has(fixture.liveStatusId))
                // Only show a scoreline when the feed has actually produced one —
                // never a hardcoded 0–0 for a match that hasn't kicked off.
                const hasScore = fixture.homeScore != null && fixture.awayScore != null && (isLive || isFinal)

                return (
                  <Link key={fixture.fixtureId} href={`/fixtures/${fixture.fixtureId}`}>
                    <Card
                      className="group relative flex flex-col transition-colors hover:border-primary cursor-pointer h-full"
                    >
                      {/* Header: competition + status */}
                      <CardHeader className="flex flex-row items-center justify-between border-b border-border p-3 pb-3 space-y-0">
                        <span className="font-mono text-[10px] text-muted-foreground uppercase">
                          {fixture.competition}
                        </span>
                        {isFinal ? (
                          <span className="font-mono text-[10px] text-muted-foreground uppercase">
                            Full time
                          </span>
                        ) : isLive ? (
                          <Badge variant="outline" className="text-[10px] text-primary border-primary/20 bg-primary/5 rounded-sm">
                            ● LIVE
                          </Badge>
                        ) : (
                          <span className="font-mono text-[10px] text-primary">
                            {date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                        )}
                      </CardHeader>

                      {/* Body: Teams (+ real score only when the match has one) */}
                      <CardContent className="flex flex-col gap-3 p-4 pt-4">
                        <div className="flex items-center justify-between gap-3">
                          <TeamBadge name={fixture.participant1} className="font-sans font-bold text-foreground" />
                          {hasScore && (
                            <span className="font-heading text-xl shrink-0">
                              {fixture.participant1IsHome ? fixture.homeScore : fixture.awayScore}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <TeamBadge name={fixture.participant2} className="font-sans font-bold text-foreground" />
                          {hasScore && (
                            <span className="font-heading text-xl shrink-0">
                              {fixture.participant1IsHome ? fixture.awayScore : fixture.homeScore}
                            </span>
                          )}
                        </div>
                      </CardContent>

                      {/* Footer: fixture id + market count */}
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
    </div>
  )
}
