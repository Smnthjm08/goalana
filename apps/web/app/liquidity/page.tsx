"use client"

import { useMemo, useState } from "react"
import Link from "next/link"
import { AlertCircle, ArrowDown, ArrowUp, BarChart3 } from "lucide-react"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@workspace/ui/components/table"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { TeamBadge } from "@/components/team-badge"
import { MarketStatusBadge } from "@/components/market-status-badge"
import { MarketLockStatus } from "@/components/fixtures/match-time-status"
import { marketTypeLabels } from "@/lib/market-groups"
import {
  useLiquidityData,
  type LiquidityMarket,
} from "@/hooks/use-liquidity-data"

type SortKey = "pool" | "divergence" | "locks"

function divergence(market: LiquidityMarket): number {
  if (market.poolYesPct === null || market.referenceYesPct === null) return -1
  return Math.abs(market.poolYesPct - market.referenceYesPct)
}

function SortHeader({
  label,
  sortKey,
  active,
  direction,
  onClick,
}: {
  label: string
  sortKey: SortKey
  active: boolean
  direction: "asc" | "desc"
  onClick: (key: SortKey) => void
}) {
  return (
    <button
      onClick={() => onClick(sortKey)}
      className={`flex items-center gap-1 font-mono text-[10px] tracking-widest uppercase transition-colors ${
        active ? "text-primary" : "text-muted-foreground hover:text-foreground"
      }`}
    >
      {label}
      {active &&
        (direction === "desc" ? (
          <ArrowDown className="size-2.5" />
        ) : (
          <ArrowUp className="size-2.5" />
        ))}
    </button>
  )
}

export default function LiquidityPage() {
  const { markets, loading, error } = useLiquidityData()
  const [sortKey, setSortKey] = useState<SortKey>("pool")
  const [direction, setDirection] = useState<"asc" | "desc">("desc")

  function handleSort(key: SortKey) {
    if (key === sortKey) {
      setDirection((d) => (d === "desc" ? "asc" : "desc"))
    } else {
      setSortKey(key)
      setDirection("desc")
    }
  }

  const sorted = useMemo(() => {
    if (!markets) return []
    const withRank = [...markets]
    withRank.sort((a, b) => {
      let cmp = 0
      if (sortKey === "pool") cmp = a.poolTotal - b.poolTotal
      else if (sortKey === "divergence") cmp = divergence(a) - divergence(b)
      else cmp = new Date(a.locksAt).getTime() - new Date(b.locksAt).getTime()
      return direction === "desc" ? -cmp : cmp
    })
    return withRank
  }, [markets, sortKey, direction])

  const totalStaked = useMemo(
    () => (markets ?? []).reduce((sum, m) => sum + m.poolTotal, 0),
    [markets]
  )
  const openCount = useMemo(
    () => (markets ?? []).filter((m) => m.status === "Open").length,
    [markets]
  )

  return (
    <div className="flex w-full flex-col p-4 md:p-8 lg:p-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-8">
        {/* Page Header */}
        <div className="flex flex-col gap-1 border-b border-border pb-6">
          <span className="flex items-center gap-2 font-mono text-[10px] tracking-[0.25em] text-muted-foreground uppercase">
            <BarChart3 className="size-3.5 text-primary" />
            Prediction Market Viewer
          </span>
          <h1 className="font-heading text-3xl font-black tracking-widest text-foreground uppercase md:text-4xl">
            Cross-Market Liquidity
          </h1>
          <p className="max-w-2xl font-mono text-[11px] leading-relaxed text-muted-foreground">
            Every open, locked, and settled market across the tournament,
            ranked together. Pool size and split are read live from each
            market&apos;s on-chain account; the reference column is
            TxLINE&apos;s independent implied probability, not Goalana&apos;s
            own price.
          </p>
          {markets && markets.length > 0 && (
            <div className="mt-3 flex flex-wrap items-center gap-4 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
              <span>
                <span className="text-foreground">{markets.length}</span>{" "}
                markets tracked
              </span>
              <span>
                <span className="text-foreground">{openCount}</span> open
              </span>
              <span>
                <span className="text-primary">
                  {totalStaked.toFixed(2)} SOL
                </span>{" "}
                total staked
              </span>
            </div>
          )}
        </div>

        {/* Error State */}
        {error && (
          <div className="flex flex-col items-center gap-4 rounded-sm border border-destructive/40 bg-destructive/5 px-6 py-12 text-center">
            <AlertCircle className="size-8 text-destructive/60" />
            <p className="max-w-sm font-mono text-[11px] leading-relaxed text-muted-foreground">
              {error}
            </p>
          </div>
        )}

        {/* Loading State */}
        {loading && !error && (
          <div className="flex flex-col gap-2">
            {[1, 2, 3, 4, 5].map((i) => (
              <Skeleton key={i} className="h-12 w-full rounded-sm" />
            ))}
          </div>
        )}

        {/* Empty State */}
        {!loading && !error && sorted.length === 0 && (
          <div className="flex flex-col items-center gap-4 rounded-sm border border-dashed border-border bg-card px-6 py-16 text-center">
            <BarChart3 className="size-8 text-muted-foreground/40" />
            <span className="font-heading text-lg tracking-widest text-foreground uppercase">
              No markets yet
            </span>
          </div>
        )}

        {/* Table */}
        {!loading && !error && sorted.length > 0 && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Fixture / Market</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>
                  <SortHeader
                    label="Pool"
                    sortKey="pool"
                    active={sortKey === "pool"}
                    direction={direction}
                    onClick={handleSort}
                  />
                </TableHead>
                <TableHead>Split</TableHead>
                <TableHead>
                  <SortHeader
                    label="Divergence"
                    sortKey="divergence"
                    active={sortKey === "divergence"}
                    direction={direction}
                    onClick={handleSort}
                  />
                </TableHead>
                <TableHead>
                  <SortHeader
                    label="Locks"
                    sortKey="locks"
                    active={sortKey === "locks"}
                    direction={direction}
                    onClick={handleSort}
                  />
                </TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {sorted.map((market) => {
                const delta =
                  market.poolYesPct !== null && market.referenceYesPct !== null
                    ? market.poolYesPct - market.referenceYesPct
                    : null

                return (
                  <TableRow key={market.marketPda}>
                    <TableCell className="max-w-[280px] whitespace-normal">
                      <Link
                        href={`/fixtures/${market.fixture.fixtureId}`}
                        className="flex flex-col gap-0.5 hover:text-primary"
                      >
                        <span className="flex items-center gap-1.5 font-mono text-[9px] text-muted-foreground">
                          <TeamBadge name={market.fixture.participant1} />
                          <span>v</span>
                          <TeamBadge name={market.fixture.participant2} />
                        </span>
                        <span className="font-mono text-[10px] text-foreground">
                          {market.question}
                        </span>
                        <span className="font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
                          {marketTypeLabels[market.marketType] ??
                            market.marketType}
                          {market.isChallenge ? " · CHALLENGE" : ""}
                        </span>
                      </Link>
                    </TableCell>
                    <TableCell>
                      <MarketStatusBadge status={market.status} />
                    </TableCell>
                    <TableCell className="font-mono text-[11px] text-foreground tabular-nums">
                      {market.poolTotal.toFixed(3)} SOL
                    </TableCell>
                    <TableCell className="font-mono text-[10px] text-muted-foreground tabular-nums">
                      {market.poolYesPct !== null ? (
                        <span>
                          <span className="text-lime-400">
                            {market.poolYesPct.toFixed(0)}% YES
                          </span>{" "}
                          /{" "}
                          <span className="text-rose-500">
                            {(100 - market.poolYesPct).toFixed(0)}% NO
                          </span>
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">
                          no stake yet
                        </span>
                      )}
                    </TableCell>
                    <TableCell className="font-mono text-[10px] tabular-nums">
                      {delta !== null ? (
                        <span
                          className={
                            Math.abs(delta) >= 3
                              ? delta > 0
                                ? "text-lime-400"
                                : "text-rose-500"
                              : "text-muted-foreground"
                          }
                        >
                          {delta > 0 ? "▲" : delta < 0 ? "▼" : "–"}{" "}
                          {Math.abs(delta).toFixed(1)}pt
                        </span>
                      ) : (
                        <span className="text-muted-foreground/50">—</span>
                      )}
                    </TableCell>
                    <TableCell>
                      <MarketLockStatus
                        locksAt={market.locksAt}
                        status={market.status}
                      />
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>
    </div>
  )
}
