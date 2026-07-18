"use client"

import Link from "next/link"
import { useSearchParams } from "next/navigation"
import { LAMPORTS_PER_SOL } from "@solana/web3.js"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { TeamBadge } from "@/components/team-badge"
import { StatusBadge } from "@/components/positions/status-badge"
import { ShareActions } from "@/components/share/share-actions"
import { VerificationBadge } from "@/components/share/verification-badge"
import { explorerAddressUrl, explorerTxUrl } from "@/lib/solana-explorer"
import { formatDate, formatTimeWithZone } from "@/lib/time"
import { getSiteUrl } from "@/lib/site"
import { derivePositionStatus } from "@/lib/position-status"
import { usePositionByPda } from "@/hooks/use-position-by-pda"
import { useMarketAccount } from "@/hooks/use-market-account"
import { useMarketMeta } from "@/hooks/use-market-meta"

function formatSol(lamports: bigint): string {
  return (Number(lamports) / LAMPORTS_PER_SOL).toFixed(3)
}

function shortAddr(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`
}

export function BetShareView({ shareId }: { shareId: string }) {
  const searchParams = useSearchParams()
  // Best-effort context captured by the Share button at share-time — the
  // page still fully re-derives everything live from chain without them.
  const oddsAtShare = searchParams.get("odds")

  const { account, betTx, betTs, claimTx, loading, notFound, error } =
    usePositionByPda(shareId)

  const { market: onChainMarket } = useMarketAccount(account?.marketPda)
  const { market: meta } = useMarketMeta(account?.marketPda)

  if (loading) {
    return (
      <div className="flex w-full flex-col p-4 md:p-8 lg:p-12">
        <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
          <Skeleton className="h-8 w-2/3 rounded-sm" />
          <Skeleton className="h-64 w-full rounded-sm" />
        </div>
      </div>
    )
  }

  if (notFound || !account) {
    return (
      <div className="flex w-full flex-col p-4 md:p-8 lg:p-12">
        <div className="mx-auto flex w-full max-w-2xl flex-col items-center gap-4 rounded-sm border border-dashed border-border bg-card px-6 py-16 text-center">
          <span className="font-heading text-lg tracking-widest text-foreground uppercase">
            Bet not found
          </span>
          <p className="max-w-sm font-mono text-[11px] leading-relaxed text-muted-foreground">
            This position doesn&apos;t exist on-chain, or the link is wrong.
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

  const { status, payout, isRefund } = derivePositionStatus(
    account.yesAmount,
    account.noAmount,
    account.claimed,
    onChainMarket
  )

  const staked = account.yesAmount + account.noAmount
  const bothSides = account.yesAmount > 0n && account.noAmount > 0n
  const sideLabel = bothSides
    ? "YES + NO"
    : account.yesAmount > 0n
      ? "YES"
      : "NO"

  const poolTotal = onChainMarket
    ? Number(onChainMarket.totalYes + onChainMarket.totalNo)
    : 0
  const livePoolYesPct =
    onChainMarket && poolTotal > 0
      ? (Number(onChainMarket.totalYes) / poolTotal) * 100
      : null

  const shareQuery = new URLSearchParams()
  shareQuery.set("m", account.marketPda)
  if (oddsAtShare) shareQuery.set("odds", oddsAtShare)
  const shareUrl = `${getSiteUrl()}/share/bet/${shareId}?${shareQuery.toString()}`

  return (
    <div className="flex w-full flex-col p-4 md:p-8 lg:p-12">
      <div className="mx-auto flex w-full max-w-2xl flex-col gap-6">
        <div className="flex items-center justify-between gap-3">
          <span className="font-heading text-sm tracking-widest text-muted-foreground uppercase">
            Shared Bet Slip
          </span>
          <ShareActions
            url={shareUrl}
            title="Goalana bet slip"
            text={
              meta ? `${sideLabel} on ${meta.question}` : "A Goalana bet slip"
            }
          />
        </div>

        <div className="flex flex-col gap-5 rounded-sm border border-border bg-card p-5 md:p-6">
          <div className="flex items-start justify-between gap-3 border-b border-border pb-4">
            <div className="flex min-w-0 flex-col gap-1.5">
              {meta ? (
                <>
                  <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                    {meta.fixture.competition}
                  </span>
                  <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
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
                  </div>
                </>
              ) : (
                <span className="font-mono text-xs text-foreground">
                  Market {account.marketPda.slice(0, 8)}…
                </span>
              )}
            </div>
            <StatusBadge status={status} />
          </div>

          <div className="flex flex-col gap-1">
            <span className="font-sans text-base leading-snug font-bold text-foreground">
              {meta?.question ??
                "Market metadata unavailable — read from chain only"}
            </span>
          </div>

          <div className="grid grid-cols-2 gap-4 border-t border-border pt-4 sm:grid-cols-3">
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                Prediction
              </span>
              <span className="font-heading text-base text-foreground">
                {sideLabel}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                Stake
              </span>
              <span className="font-heading text-base text-foreground tabular-nums">
                {formatSol(staked)} SOL
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                {isRefund ? "Refundable" : "Payout"}
              </span>
              <span className="font-heading text-base text-foreground tabular-nums">
                {payout !== null
                  ? `${formatSol(payout)} SOL`
                  : status === "Claimed"
                    ? "Claimed"
                    : "Pending"}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                Odds when shared
              </span>
              <span className="font-heading text-base text-foreground tabular-nums">
                {oddsAtShare
                  ? `${Number(oddsAtShare).toFixed(1)}% YES`
                  : livePoolYesPct !== null
                    ? `${livePoolYesPct.toFixed(1)}% YES (live)`
                    : "—"}
              </span>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                Wallet
              </span>
              <a
                href={explorerAddressUrl(account.user)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-sm text-foreground underline underline-offset-2 transition-colors hover:text-primary"
              >
                {shortAddr(account.user)}
              </a>
            </div>
            <div className="flex flex-col gap-1">
              <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                Placed
              </span>
              <span className="font-mono text-sm text-foreground">
                {betTs
                  ? `${formatDate(betTs * 1000)} · ${formatTimeWithZone(betTs * 1000)}`
                  : "—"}
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-4">
            <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
              {betTx ? (
                <a
                  href={explorerTxUrl(betTx)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[10px] text-muted-foreground underline underline-offset-2 transition-colors hover:text-primary"
                >
                  Bet tx ↗
                </a>
              ) : (
                <span className="font-mono text-[10px] text-muted-foreground/60">
                  Bet tx —
                </span>
              )}
              {claimTx && (
                <a
                  href={explorerTxUrl(claimTx)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-mono text-[10px] text-muted-foreground underline underline-offset-2 transition-colors hover:text-primary"
                >
                  Claim tx ↗
                </a>
              )}
            </div>
            <VerificationBadge address={shareId} />
          </div>
        </div>

        {error && (
          <span className="font-mono text-[10px] tracking-widest text-destructive uppercase">
            [ {error} ]
          </span>
        )}

        {meta && (
          <Link
            href={`/market/${account.marketPda}`}
            className="text-center font-mono text-[10px] tracking-widest text-primary uppercase underline underline-offset-2 transition-colors hover:text-primary/80"
          >
            View this market →
          </Link>
        )}
      </div>
    </div>
  )
}
