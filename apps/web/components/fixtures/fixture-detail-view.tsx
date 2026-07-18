"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import axiosInstance from "@/lib/axios-instance"
import { groupMarkets } from "@/lib/market-groups"
import { getSiteUrl } from "@/lib/site"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import {
  Tabs,
  TabsContent,
  TabsList,
  TabsTrigger,
} from "@workspace/ui/components/tabs"
import { OddsMovementChart } from "@/components/fixtures/odds-movement-chart"
import { LiveScoreHeader } from "@/components/fixtures/live-score-header"
import { MatchEventTimeline } from "@/components/fixtures/match-event-timeline"
import { LifecycleStatusStrip } from "@/components/fixtures/lifecycle-status-strip"
import { SettlementProofPanel } from "@/components/fixtures/settlement-proof-panel"
import {
  ProofIntegrityPanel,
  type ProofIntegrityArtifact,
} from "@/components/fixtures/proof-integrity-panel"
import { MatchTimeStatus } from "@/components/fixtures/match-time-status"
import { MarketCard } from "@/components/fixtures/market-card"
import { TeamBadge } from "@/components/team-badge"
import { ShareActions } from "@/components/share/share-actions"

// Lightweight polling for live TxLINE reference odds — reuses the existing
// fixture endpoint rather than adding a new SSE/WS layer. The odds-history
// chart data has its own identical polling loop inside OddsMovementChart.
const FIXTURE_POLL_INTERVAL_MS = 8_000

export function FixtureDetailView({ fixtureId }: { fixtureId: string }) {
  const [fixture, setFixture] = useState<any>(null)
  const [loading, setLoading] = useState(true)
  const [refreshError, setRefreshError] = useState<string | null>(null)

  useEffect(() => {
    if (!fixtureId) return

    let cancelled = false

    const fetchFixture = () =>
      axiosInstance
        .get(`/fixtures/${fixtureId}`)
        .then((res) => {
          if (cancelled) return
          if (res.data?.data) {
            setFixture(res.data.data)
            setRefreshError(null)
          }
        })
        .catch((err) => {
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

  // Skeletons mirror the real layout (header band → strip → tab row → market
  // grid) so the page doesn't reflow when the data lands.
  if (loading) {
    return (
      <div className="flex w-full flex-col p-4 md:p-8 lg:p-12">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
          <Skeleton className="h-48 w-full rounded-sm" />
          <Skeleton className="h-12 w-full rounded-sm" />
          <Skeleton className="h-10 w-full rounded-sm" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
            {[1, 2, 3, 4].map((i) => (
              <Skeleton key={i} className="h-64 w-full rounded-sm" />
            ))}
          </div>
        </div>
      </div>
    )
  }

  if (!fixture) {
    return (
      <div className="flex w-full flex-col p-4 md:p-8 lg:p-12">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-4 rounded-sm border border-dashed border-border bg-card px-6 py-16 text-center">
          <span className="font-heading text-lg tracking-widest text-foreground uppercase">
            Fixture not found
          </span>
          <p className="max-w-sm font-mono text-[11px] leading-relaxed text-muted-foreground">
            This fixture isn&apos;t in Goalana&apos;s tracked set. It may have
            been removed from the TxLINE feed.
          </p>
          <Button
            asChild
            className="mt-1 font-heading tracking-widest uppercase"
          >
            <Link href="/">Browse Markets</Link>
          </Button>
        </div>
      </div>
    )
  }

  const tsNum = Number(fixture.startTime)
  const date = new Date(tsNum > 1e11 ? tsNum : tsNum * 1000)

  const marketGroups = groupMarkets(fixture.markets ?? [])

  // Recorded once per fixture by scripts/record-proof-integrity.ts; absent on
  // fixtures where it was never run, so the tab is conditional.
  const proofIntegrity: ProofIntegrityArtifact | null =
    (fixture.proofIntegrity as ProofIntegrityArtifact | undefined) ?? null

  return (
    <div className="flex w-full flex-col p-4 md:p-8 lg:p-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        {/* Match Header */}
        <div className="mb-2 flex w-full flex-col">
          <div className="mb-4 flex flex-wrap items-start justify-between gap-3 md:mb-6">
            <span className="font-mono text-xs tracking-widest text-foreground uppercase md:text-sm">
              {fixture.competition}
            </span>
            <div className="flex items-center gap-3">
              <ShareActions
                url={`${getSiteUrl()}/fixtures/${fixture.fixtureId}`}
                title={`${fixture.participant1} vs ${fixture.participant2}`}
                text={`${fixture.participant1} vs ${fixture.participant2} — ${fixture.competition}`}
                compact
              />
              <MatchTimeStatus
                startTime={fixture.startTime}
                liveScore={fixture.liveScore}
                variant="detail"
              />
            </div>
          </div>

          <div className="grid w-full grid-cols-[1fr_auto_1fr] items-center gap-2 border-t border-b border-border py-6 sm:gap-4 md:py-12">
            <div className="flex min-w-0 flex-col items-start">
              <TeamBadge
                name={fixture.participant1}
                className="gap-1.5 font-sans text-lg leading-tight font-black text-foreground sm:gap-2 sm:text-2xl md:gap-3 md:text-5xl lg:text-6xl"
              />
            </div>

            <LiveScoreHeader
              liveScore={fixture.liveScore}
              startTime={fixture.startTime}
              kickoffLabel={date.toLocaleString(undefined, {
                month: "short",
                day: "numeric",
                hour: "2-digit",
                minute: "2-digit",
              })}
            />

            <div className="flex min-w-0 flex-col items-end">
              <TeamBadge
                name={fixture.participant2}
                className="gap-1.5 text-right font-sans text-lg leading-tight font-black text-foreground sm:gap-2 sm:text-2xl md:gap-3 md:text-5xl lg:text-6xl"
              />
            </div>
          </div>

          <div className="mt-4 flex flex-wrap items-center justify-between gap-2 md:mt-6">
            <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              FIXTURE / {fixture.fixtureId}
            </span>
            <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              DATA / TXLINE
            </span>
          </div>
          {refreshError && (
            <div className="mt-2 text-right">
              <span className="font-mono text-[10px] tracking-widest text-destructive uppercase">
                [ {refreshError} ]
              </span>
            </div>
          )}
        </div>

        <LifecycleStatusStrip
          liveScore={fixture.liveScore}
          markets={fixture.markets ?? []}
        />

        {/* Tabs */}
        <Tabs defaultValue="MARKETS" className="w-full">
          <TabsList
            variant="line"
            className="h-auto w-full flex-nowrap justify-start gap-4 overflow-x-auto rounded-none border-b border-border p-0 sm:gap-6 md:gap-8"
          >
            <TabsTrigger
              value="MARKETS"
              className="flex-none shrink-0 bg-transparent px-0 pt-0 pb-4 font-heading text-sm tracking-widest text-muted-foreground uppercase after:bg-primary hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:text-primary"
            >
              Markets
            </TabsTrigger>
            <TabsTrigger
              value="ODDS_MOVEMENT"
              className="flex-none shrink-0 bg-transparent px-0 pt-0 pb-4 font-heading text-sm tracking-widest text-muted-foreground uppercase after:bg-primary hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:text-primary"
            >
              Odds & Movement
            </TabsTrigger>
            <TabsTrigger
              value="MATCH_EVENTS"
              className="flex-none shrink-0 bg-transparent px-0 pt-0 pb-4 font-heading text-sm tracking-widest text-muted-foreground uppercase after:bg-primary hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:text-primary"
            >
              Match Events
            </TabsTrigger>
            <TabsTrigger
              value="SETTLEMENT_PROOF"
              className="flex-none shrink-0 bg-transparent px-0 pt-0 pb-4 font-heading text-sm tracking-widest text-muted-foreground uppercase after:bg-primary hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:text-primary"
            >
              Settlement Proof
            </TabsTrigger>
            {proofIntegrity && (
              <TabsTrigger
                value="PROOF_INTEGRITY"
                className="flex-none shrink-0 bg-transparent px-0 pt-0 pb-4 font-heading text-sm tracking-widest text-muted-foreground uppercase after:bg-primary hover:text-foreground data-[state=active]:bg-transparent data-[state=active]:text-primary"
              >
                Proof Integrity
              </TabsTrigger>
            )}
          </TabsList>

          <TabsContent
            value="MARKETS"
            className="mt-8 border-none p-0 outline-none"
          >
            {marketGroups.length === 0 ? (
              <div className="flex flex-col items-center gap-3 rounded-sm border border-dashed border-border bg-card px-6 py-16 text-center">
                <span className="font-heading text-lg tracking-widest text-foreground uppercase">
                  No markets yet
                </span>
                <p className="max-w-sm font-mono text-[11px] leading-relaxed text-muted-foreground">
                  Goalana opens markets only once TxLINE prices this fixture.
                  They appear here automatically — nothing to do.
                </p>
              </div>
            ) : (
              <div className="flex flex-col gap-8">
                {marketGroups.map(({ group, markets }) => (
                  <div key={group} className="flex flex-col gap-4">
                    <h3 className="border-b border-border pb-2 font-heading text-sm tracking-widest text-muted-foreground uppercase">
                      {group}
                    </h3>
                    <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
                      {markets.map((market: any) => (
                        <MarketCard key={market.id} market={market} />
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </TabsContent>

          <TabsContent
            value="ODDS_MOVEMENT"
            className="mt-8 border-none p-0 outline-none"
          >
            <OddsMovementChart
              fixtureId={fixture.fixtureId}
              participant1={fixture.participant1}
              participant2={fixture.participant2}
              startTime={fixture.startTime}
            />
          </TabsContent>

          <TabsContent
            value="MATCH_EVENTS"
            className="mt-8 border-none p-0 outline-none"
          >
            <MatchEventTimeline
              events={fixture.events ?? []}
              participant1={fixture.participant1}
              participant2={fixture.participant2}
              participant1IsHome={fixture.participant1IsHome}
            />
          </TabsContent>

          <TabsContent
            value="SETTLEMENT_PROOF"
            className="mt-8 border-none p-0 outline-none"
          >
            <SettlementProofPanel
              fixtureId={fixture.fixtureId}
              isFinal={Boolean(fixture.liveScore?.isFinal)}
            />
          </TabsContent>

          {proofIntegrity && (
            <TabsContent
              value="PROOF_INTEGRITY"
              className="mt-8 border-none p-0 outline-none"
            >
              <ProofIntegrityPanel artifact={proofIntegrity} />
            </TabsContent>
          )}
        </Tabs>
      </div>
    </div>
  )
}
