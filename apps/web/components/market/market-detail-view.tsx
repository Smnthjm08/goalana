"use client"

import Link from "next/link"
import { LAMPORTS_PER_SOL } from "@solana/web3.js"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { MarketStatusBadge } from "@/components/market-status-badge"
import { MarketCard } from "@/components/fixtures/market-card"
import { MarketLockStatus } from "@/components/fixtures/match-time-status"
import { OddsMovementChart } from "@/components/fixtures/odds-movement-chart"
import { TeamBadge } from "@/components/team-badge"
import { ShareActions } from "@/components/share/share-actions"
import { MarketActivityPanel } from "@/components/market/market-activity-panel"
import { marketTypeLabels } from "@/lib/market-groups"
import { formatDuration } from "@/lib/time"
import { getSiteUrl } from "@/lib/site"
import { useMarketMeta } from "@/hooks/use-market-meta"
import {
  useMarketAccount,
  type OnChainMarketStatus,
} from "@/hooks/use-market-account"
import { useNow } from "@/hooks/use-now"

// The DB mirrors on-chain status as an uppercase string ("OPEN", "LOCKED", …)
// and is never updated after lock/settle (see market-card.tsx) — only used
// as a fallback here while the on-chain read is in flight.
function normalizeStatus(raw: string): OnChainMarketStatus {
  const lower = raw.toLowerCase()
  return (lower.charAt(0).toUpperCase() + lower.slice(1)) as OnChainMarketStatus
}

export function MarketDetailView({ marketId }: { marketId: string }) {
  const {
    market: meta,
    loading: metaLoading,
    notFound,
    error,
  } = useMarketMeta(marketId)
  const { market: onChainMarket } = useMarketAccount(marketId)
  const now = useNow(1_000)

  if (metaLoading) {
    return (
      <div className="flex w-full flex-col p-4 md:p-8 lg:p-12">
        <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
          <Skeleton className="h-32 w-full rounded-sm" />
          <Skeleton className="h-10 w-full rounded-sm" />
          <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
            <Skeleton className="h-96 w-full rounded-sm" />
            <Skeleton className="h-96 w-full rounded-sm" />
          </div>
        </div>
      </div>
    )
  }

  if (notFound || !meta) {
    return (
      <div className="flex w-full flex-col p-4 md:p-8 lg:p-12">
        <div className="mx-auto flex w-full max-w-5xl flex-col items-center gap-4 rounded-sm border border-dashed border-border bg-card px-6 py-16 text-center">
          <span className="font-heading text-lg tracking-widest text-foreground uppercase">
            Market not found
          </span>
          <p className="max-w-sm font-mono text-[11px] leading-relaxed text-muted-foreground">
            This market isn&apos;t in Goalana&apos;s tracked set, or the link is
            wrong.
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

  const status = onChainMarket?.status ?? normalizeStatus(meta.status)
  const shareUrl = `${getSiteUrl()}/market/${meta.marketPda}`
  const settleAfterMs = onChainMarket ? onChainMarket.settleAfter * 1000 : null
  const untilSettle =
    settleAfterMs !== null && now !== null ? settleAfterMs - now : null

  return (
    <div className="flex w-full flex-col p-4 md:p-8 lg:p-12">
      <div className="mx-auto flex w-full max-w-5xl flex-col gap-8">
        {/* Header */}
        <div className="flex flex-col gap-4 border-b border-border pb-6">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <span className="font-mono text-xs tracking-widest text-muted-foreground uppercase">
              {marketTypeLabels[meta.marketType] ||
                meta.marketType.replace(/_/g, " ")}
            </span>
            <ShareActions
              url={shareUrl}
              title={meta.question}
              text={`${meta.fixture.participant1} vs ${meta.fixture.participant2} — ${meta.question}`}
            />
          </div>

          <div className="flex flex-wrap items-start justify-between gap-4">
            <h1 className="max-w-2xl font-sans text-2xl font-bold text-foreground md:text-3xl">
              {meta.question}
            </h1>
            <MarketStatusBadge status={status} className="shrink-0 text-xs" />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-4">
            <Link
              href={`/fixtures/${meta.fixture.fixtureId}`}
              className="flex flex-wrap items-center gap-x-2 gap-y-1 transition-opacity hover:opacity-80"
            >
              <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                {meta.fixture.competition}
              </span>
              <TeamBadge
                name={meta.fixture.participant1}
                className="font-sans text-sm font-bold text-foreground"
              />
              <span className="font-mono text-[10px] text-muted-foreground">
                v
              </span>
              <TeamBadge
                name={meta.fixture.participant2}
                className="font-sans text-sm font-bold text-foreground"
              />
              <span className="font-mono text-[10px] text-muted-foreground underline underline-offset-2">
                View fixture →
              </span>
            </Link>

            <div className="flex flex-col items-end gap-1">
              <MarketLockStatus locksAt={meta.locksAt} status={status} />
              {untilSettle !== null &&
                status !== "Settled" &&
                status !== "Cancelled" && (
                  <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase tabular-nums">
                    {untilSettle > 0
                      ? `Settles after ${formatDuration(untilSettle)}`
                      : "Eligible for settlement"}
                  </span>
                )}
            </div>
          </div>
        </div>

        {error && (
          <span className="font-mono text-[10px] tracking-widest text-destructive uppercase">
            [ {error} ]
          </span>
        )}

        {/* Odds, betting, settlement + oracle info, lifecycle — the existing MarketCard already covers all of it */}
        <div className="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_320px]">
          <MarketCard market={meta} />
          <MarketActivityPanel marketPda={meta.marketPda} />
        </div>

        {/* Odds history */}
        <div className="flex flex-col gap-4">
          <h2 className="border-b border-border pb-2 font-heading text-sm tracking-widest text-muted-foreground uppercase">
            Odds History
          </h2>
          <OddsMovementChart
            fixtureId={meta.fixture.fixtureId}
            participant1={meta.fixture.participant1}
            participant2={meta.fixture.participant2}
            startTime={meta.fixture.startTime}
          />
        </div>
      </div>
    </div>
  )
}
