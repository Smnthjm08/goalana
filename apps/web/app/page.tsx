"use client"
import { useEffect, useState } from "react"
import Link from "next/link"
import axiosInstance from "@/lib/axios-instance"
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@workspace/ui/components/card"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { TeamBadge } from "@/components/team-badge"
import { MatchTimeStatus } from "@/components/fixtures/match-time-status"
import { explorerAddressUrl } from "@/lib/solana-explorer"
import { IN_PROGRESS_STATUS_IDS } from "@/lib/match-status"
import {
  GOALANA_PROGRAM_ID,
  TRUST_STATEMENT,
  LIFECYCLE_STEPS,
} from "@/lib/protocol"

function Hero() {
  return (
    <div className="flex w-full flex-col gap-8 rounded-sm border border-border bg-card p-6 md:p-10">
      <div className="flex flex-col gap-4">
        <span className="font-mono text-[10px] tracking-[0.25em] text-primary uppercase md:text-xs">
          Trustless settlement · Solana Devnet · Powered by TxLINE
        </span>
        <h1 className="font-heading text-3xl leading-[0.95] font-black tracking-tight text-foreground uppercase md:text-5xl lg:text-6xl">
          World Cup markets that
          <br className="hidden md:block" /> settle themselves.
        </h1>
        <p className="max-w-2xl font-sans text-sm leading-relaxed text-muted-foreground md:text-base">
          {TRUST_STATEMENT}
        </p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1">
          <a
            href={explorerAddressUrl(GOALANA_PROGRAM_ID)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] text-muted-foreground underline transition-colors hover:text-primary md:text-xs"
          >
            Program {GOALANA_PROGRAM_ID.slice(0, 6)}…
            {GOALANA_PROGRAM_ID.slice(-6)} — verify on Explorer ↗
          </a>
        </div>
      </div>

      {/* How it works — the protocol lifecycle, settlement highlighted. */}
      <div className="flex flex-col gap-3 border-t border-border pt-6">
        <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
          How a market resolves
        </span>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {LIFECYCLE_STEPS.map((step, i) => (
            <div
              key={step.key}
              className={`flex flex-col gap-1.5 rounded-sm border p-3 ${
                step.trust
                  ? "border-primary/40 bg-primary/5"
                  : "border-border bg-background"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`font-mono text-[10px] ${step.trust ? "text-primary" : "text-muted-foreground"}`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className={`font-heading text-xs tracking-widest uppercase ${step.trust ? "text-primary" : "text-foreground"}`}
                >
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
    axiosInstance
      .get("/fixtures")
      .then((res) => {
        if (res.data?.data) {
          setFixtures(res.data.data)
        }
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [])

  return (
    <div className="flex w-full flex-col p-4 md:p-8 lg:p-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <Hero />

        <div className="flex flex-col gap-6">
          <h2 className="border-b border-border pb-4 font-heading text-2xl tracking-widest text-primary uppercase">
            Live & Upcoming Markets
          </h2>

          {loading ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-48 w-full rounded-sm" />
              ))}
            </div>
          ) : fixtures.length === 0 ? (
            <div className="flex flex-col items-center gap-3 rounded-sm border border-dashed border-border bg-card px-6 py-16 text-center">
              <span className="font-heading text-lg tracking-widest text-foreground uppercase">
                No fixtures tracked
              </span>
              <p className="max-w-sm font-mono text-[11px] leading-relaxed text-muted-foreground">
                Goalana syncs World Cup fixtures from the TxLINE feed. If this
                stays empty, the feed is unreachable — check the status
                indicator in the header.
              </p>
            </div>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {fixtures.map((fixture) => {
                const isFinal = fixture.finalSeq != null
                const isLive =
                  fixture.gameState === 3 ||
                  (fixture.liveStatusId != null &&
                    IN_PROGRESS_STATUS_IDS.has(fixture.liveStatusId))
                // Only show a scoreline when the feed has actually produced one —
                // never a hardcoded 0–0 for a match that hasn't kicked off.
                const hasScore =
                  fixture.homeScore != null &&
                  fixture.awayScore != null &&
                  (isLive || isFinal)

                // The list endpoint returns raw Fixture rows, so there's no
                // computed `minuteLabel` here (that's built per-fixture in
                // /api/fixtures/:id) — the period label is the honest stand-in.
                const liveScore = {
                  statusId: fixture.liveStatusId ?? null,
                  minuteLabel: fixture.livePeriodLabel ?? null,
                  isFinal,
                }

                return (
                  <Link
                    key={fixture.fixtureId}
                    href={`/fixtures/${fixture.fixtureId}`}
                  >
                    <Card className="group relative flex h-full cursor-pointer flex-col transition-colors hover:border-primary">
                      {/* Header: competition + what happens next */}
                      <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 border-b border-border p-3 pb-3">
                        <span className="font-mono text-[10px] text-muted-foreground uppercase">
                          {fixture.competition}
                        </span>
                        <MatchTimeStatus
                          startTime={fixture.startTime}
                          liveScore={liveScore}
                          variant="card"
                        />
                      </CardHeader>

                      {/* Body: Teams (+ real score only when the match has one) */}
                      <CardContent className="flex flex-col gap-3 p-4 pt-4">
                        <div className="flex items-center justify-between gap-3">
                          <TeamBadge
                            name={fixture.participant1}
                            className="font-sans font-bold text-foreground"
                          />
                          {hasScore && (
                            <span className="shrink-0 font-heading text-xl">
                              {fixture.participant1IsHome
                                ? fixture.homeScore
                                : fixture.awayScore}
                            </span>
                          )}
                        </div>
                        <div className="flex items-center justify-between gap-3">
                          <TeamBadge
                            name={fixture.participant2}
                            className="font-sans font-bold text-foreground"
                          />
                          {hasScore && (
                            <span className="shrink-0 font-heading text-xl">
                              {fixture.participant1IsHome
                                ? fixture.awayScore
                                : fixture.homeScore}
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
