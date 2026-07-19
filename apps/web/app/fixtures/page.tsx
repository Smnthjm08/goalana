"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import { AlertCircle, RefreshCw, Target } from "lucide-react"
import axiosInstance from "@/lib/axios-instance"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@workspace/ui/components/empty"
import { TeamBadge } from "@/components/team-badge"
import { MatchTimeStatus } from "@/components/fixtures/match-time-status"
import { MarketStatusBadge } from "@/components/market-status-badge"
import type { OnChainMarketStatus } from "@/hooks/use-market-account"
import { IN_PROGRESS_STATUS_IDS } from "@/lib/match-status"

interface FixtureWithMarkets {
  fixtureId: string
  competition: string
  participant1: string
  participant2: string
  participant1IsHome: boolean
  startTime: string
  homeScore: number | null
  awayScore: number | null
  finalSeq: number | null
  liveStatusId: number | null
  livePeriodLabel: string | null
  _count?: { markets: number }
  markets?: Array<{
    id: string
    question: string
    marketType: string
    status: string
    locksAt: string
    initialYesPct: number | null
    initialNoPct: number | null
  }>
}

export default function FixturesPage() {
  const [fixtures, setFixtures] = useState<FixtureWithMarkets[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function fetchFixtures() {
    setLoading(true)
    setError(null)
    axiosInstance
      .get("/fixtures")
      .then((res) => {
        if (res.data?.data) {
          const sorted = [...res.data.data].sort((a: FixtureWithMarkets, b: FixtureWithMarkets) => {
            const aIsLive = a.liveStatusId != null && IN_PROGRESS_STATUS_IDS.has(a.liveStatusId)
            const bIsLive = b.liveStatusId != null && IN_PROGRESS_STATUS_IDS.has(b.liveStatusId)
            const aIsFinal = a.finalSeq != null
            const bIsFinal = b.finalSeq != null

            // Live matches come first
            if (aIsLive && !bIsLive) return -1
            if (!aIsLive && bIsLive) return 1

            // Final matches go last
            if (aIsFinal && !bIsFinal) return 1
            if (!aIsFinal && bIsFinal) return -1

            // Within the same group, sort by startTime ascending (soonest first)
            return Number(BigInt(a.startTime) - BigInt(b.startTime))
          })
          setFixtures(sorted)
        }
      })
      .catch((err) => {
        console.error(err)
        setError("Could not load fixtures. The feed may be temporarily unavailable.")
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchFixtures()
  }, [])

  return (
    <div className="flex w-full flex-col p-4 md:p-8 lg:p-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        {/* Page Header */}
        <div className="flex flex-col gap-1 border-b border-border pb-6">
          <span className="font-mono text-[10px] tracking-[0.25em] text-muted-foreground uppercase">
            World Cup 2026
          </span>
          <h1 className="font-heading text-3xl font-black tracking-widest text-foreground uppercase md:text-4xl">
            Browse Fixtures
          </h1>
          <p className="font-mono text-[11px] leading-relaxed text-muted-foreground">
            All tracked matches with their on-chain prediction markets. Click a fixture to place a bet.
          </p>
        </div>

        {/* Error State */}
        {error && (
          <div className="flex flex-col items-center gap-4 rounded-sm border border-destructive/40 bg-destructive/5 px-6 py-12 text-center">
            <AlertCircle className="size-8 text-destructive/60" />
            <div className="flex flex-col gap-1">
              <span className="font-heading text-sm tracking-widest text-destructive uppercase">
                Feed Unavailable
              </span>
              <p className="max-w-sm font-mono text-[11px] leading-relaxed text-muted-foreground">
                {error}
              </p>
            </div>
            <Button
              onClick={fetchFixtures}
              variant="outline"
              className="mt-1 gap-2 font-heading tracking-widest uppercase"
            >
              <RefreshCw className="size-3.5" />
              Retry
            </Button>
          </div>
        )}

        {/* Loading State */}
        {loading && (
          <div className="flex flex-col gap-6">
            {[1, 2, 3].map((i) => (
              <div key={i} className="flex flex-col gap-3">
                <Skeleton className="h-20 w-full rounded-sm" />
                <div className="grid grid-cols-1 gap-2 pl-4 sm:grid-cols-2 lg:grid-cols-3">
                  {[1, 2, 3].map((j) => (
                    <Skeleton key={j} className="h-10 w-full rounded-sm" />
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && fixtures.length === 0 && (
          <Empty className="rounded-sm border border-dashed border-border bg-card py-16">
            <EmptyHeader>
              <EmptyMedia
                variant="icon"
                className="size-10 rounded-sm border border-border bg-muted/40 text-muted-foreground"
              >
                <Target />
              </EmptyMedia>
              <EmptyTitle className="font-heading text-lg tracking-widest text-foreground uppercase">
                No fixtures tracked
              </EmptyTitle>
              <EmptyDescription className="font-mono text-[11px] leading-relaxed">
                Goalana syncs World Cup fixtures from the TxLINE feed. If this
                stays empty, the feed may be unreachable — check the status
                indicator in the header.
              </EmptyDescription>
            </EmptyHeader>
          </Empty>
        )}

        {/* Fixture List */}
        {!loading && !error && fixtures.length > 0 && (() => {
          const openFixtures = fixtures.filter((f) => f.finalSeq == null)
          const closedFixtures = fixtures.filter((f) => f.finalSeq != null)

          function renderFixture(fixture: FixtureWithMarkets, dimmed = false) {
            const isFinal = fixture.finalSeq != null
            const isLive =
              fixture.liveStatusId != null &&
              IN_PROGRESS_STATUS_IDS.has(fixture.liveStatusId)
            const hasScore =
              fixture.homeScore != null &&
              fixture.awayScore != null &&
              (isLive || isFinal)

            const liveScore = {
              statusId: fixture.liveStatusId ?? null,
              minuteLabel: fixture.livePeriodLabel ?? null,
              isFinal,
            }

            const marketCount = fixture._count?.markets ?? fixture.markets?.length ?? 0

            return (
              <div key={fixture.fixtureId} className="flex flex-col gap-3">
                {/* Fixture Row */}
                <Link href={`/fixtures/${fixture.fixtureId}`} className="group">
                  <div className={`flex items-center justify-between gap-4 rounded-sm border bg-card px-4 py-3 transition-colors ${dimmed ? "border-border/40 opacity-60 hover:border-border hover:opacity-80" : "border-border hover:border-primary/50 hover:bg-card/80"}`}>
                    {/* Teams */}
                    <div className="flex min-w-0 flex-col gap-1">
                      <span className="font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
                        {fixture.competition}
                      </span>
                      <div className="flex items-center gap-3">
                        <TeamBadge
                          name={fixture.participant1}
                          className="font-sans text-sm font-bold text-foreground"
                        />
                        {hasScore && (
                          <span className="shrink-0 font-heading text-lg text-foreground">
                            {fixture.participant1IsHome ? fixture.homeScore : fixture.awayScore}
                            {" – "}
                            {fixture.participant1IsHome ? fixture.awayScore : fixture.homeScore}
                          </span>
                        )}
                        {!hasScore && (
                          <span className="shrink-0 font-mono text-xs text-muted-foreground/50">vs</span>
                        )}
                        <TeamBadge
                          name={fixture.participant2}
                          className="font-sans text-sm font-bold text-foreground"
                        />
                      </div>
                    </div>

                    {/* Right: status + market count */}
                    <div className="flex shrink-0 flex-col items-end gap-1.5">
                      <MatchTimeStatus
                        startTime={fixture.startTime}
                        liveScore={liveScore}
                        variant="card"
                      />
                      {marketCount > 0 && (
                        <span className="flex items-center gap-1 font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
                          <Target className="size-2.5" />
                          {marketCount} market{marketCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </div>
                  </div>
                </Link>

                {/* Markets for this fixture */}
                {fixture.markets && fixture.markets.length > 0 && (
                  <div className="grid grid-cols-1 gap-2 pl-4 sm:grid-cols-2 lg:grid-cols-3">
                    {fixture.markets.map((market) => (
                      <Link
                        key={market.id}
                        href={`/fixtures/${fixture.fixtureId}`}
                        className={`group flex items-center justify-between gap-2 rounded-sm border px-3 py-2 transition-colors ${dimmed ? "border-border/30 bg-muted/10 hover:border-border/60 hover:bg-muted/20" : "border-border/60 bg-muted/20 hover:border-primary/40 hover:bg-muted/40"}`}
                      >
                        <span className="min-w-0 truncate font-mono text-[10px] leading-snug text-muted-foreground group-hover:text-foreground transition-colors">
                          {market.question}
                        </span>
                        <MarketStatusBadge status={market.status as OnChainMarketStatus} />
                      </Link>
                    ))}
                  </div>
                )}

                {/* Only show "Markets Closed" for final fixtures with no markets */}
                {dimmed && (!fixture.markets || fixture.markets.length === 0) && marketCount === 0 && (
                  <div className="ml-4 flex items-center gap-2 px-1 py-1">
                    <span className="inline-flex items-center rounded-sm border border-border/40 bg-muted/30 px-2 py-0.5 font-mono text-[9px] tracking-widest text-muted-foreground/50 uppercase">
                      Markets Closed
                    </span>
                  </div>
                )}
              </div>
            )
          }

          return (
            <div className="flex flex-col gap-10">
              {/* Open / Upcoming fixtures */}
              {openFixtures.length > 0 && (
                <div className="flex flex-col gap-6">
                  {openFixtures.map((f) => renderFixture(f, false))}
                </div>
              )}

              {/* Closed / Final fixtures */}
              {closedFixtures.length > 0 && (
                <div className="flex flex-col gap-4">
                  <div className="flex items-center gap-3">
                    <span className="font-mono text-[9px] tracking-widest text-muted-foreground/50 uppercase">
                      Closed Markets
                    </span>
                    <div className="flex-1 border-t border-border/30" />
                  </div>
                  <div className="flex flex-col gap-4">
                    {closedFixtures.map((f) => renderFixture(f, true))}
                  </div>
                </div>
              )}
            </div>
          )
        })()}
      </div>
    </div>
  )
}
