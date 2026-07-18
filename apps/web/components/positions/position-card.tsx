import Link from "next/link"
import { LAMPORTS_PER_SOL } from "@solana/web3.js"
import { explorerAddressUrl } from "@/lib/solana-explorer"
import { getSiteUrl } from "@/lib/site"
import type {
  PositionStatus,
  WalletPosition,
} from "@/hooks/use-wallet-positions"
import { TeamBadge } from "@/components/team-badge"
import { StatusBadge } from "@/components/positions/status-badge"
import { TxLink } from "@/components/positions/tx-link"
import { Metric } from "@/components/positions/metric"
import { ShareActions } from "@/components/share/share-actions"

export function formatSol(lamports: bigint): string {
  return (Number(lamports) / LAMPORTS_PER_SOL).toFixed(3)
}

const STATUS_HINTS: Record<PositionStatus, string> = {
  Claimable: "Settled in your favour — the payout is waiting in the vault.",
  Open: "Betting is still open; the pool can still move.",
  Locked: "Betting closed at kickoff. Waiting for the match to end.",
  Settled: "This market settled against your side.",
  Claimed: "Paid out — the vault has already transferred your winnings.",
}

export function PositionCard({ position }: { position: WalletPosition }) {
  const { meta, market, status } = position

  const staked = position.yesAmount + position.noAmount
  const bothSides = position.yesAmount > 0n && position.noAmount > 0n

  // A position may hold stake on both sides (two bets, opposite outcomes), so
  // "the outcome" isn't always singular — say so rather than picking one.
  const outcomeLabel = bothSides
    ? "YES + NO"
    : position.yesAmount > 0n
      ? "YES"
      : "NO"

  const stakeLabel = bothSides
    ? `${formatSol(position.yesAmount)} YES · ${formatSol(position.noAmount)} NO`
    : `${formatSol(staked)} SOL`

  const settledOutcome =
    market?.status === "Settled" && market.outcome !== null
      ? market.outcome
        ? "YES"
        : "NO"
      : null

  const fixtureHref = meta ? `/fixtures/${meta.fixture.fixtureId}` : null

  const poolTotal = market ? Number(market.totalYes + market.totalNo) : 0
  const poolYesPct =
    market && poolTotal > 0 ? (Number(market.totalYes) / poolTotal) * 100 : null
  const shareQuery = new URLSearchParams({ m: position.marketPda })
  if (poolYesPct !== null) shareQuery.set("odds", poolYesPct.toFixed(1))
  const shareUrl = `${getSiteUrl()}/share/bet/${position.positionPda}?${shareQuery.toString()}`

  return (
    <div className="flex flex-col gap-4 rounded-sm border border-border bg-card p-4 transition-colors hover:border-primary/40 md:p-5">
      {/* Fixture + status */}
      <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
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
            <>
              <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                Fixture unavailable
              </span>
              <span className="font-mono text-xs text-foreground">
                {position.marketPda.slice(0, 8)}…{position.marketPda.slice(-8)}
              </span>
            </>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2">
          <ShareActions
            url={shareUrl}
            title="Goalana bet slip"
            text={
              meta
                ? `${outcomeLabel} on ${meta.question}`
                : "A Goalana bet slip"
            }
            compact
          />
          <StatusBadge status={status} />
        </div>
      </div>

      {/* Market */}
      <div className="flex flex-col gap-1">
        <span className="font-sans text-base leading-snug font-bold text-foreground">
          {meta?.question ??
            "Market metadata unavailable — read from chain only"}
        </span>
        <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
          {STATUS_HINTS[status]}
        </span>
      </div>

      {/* Outcome / stake / payout */}
      <div className="grid grid-cols-2 gap-4 border-t border-border pt-3 sm:grid-cols-3">
        <Metric label="Your pick" value={outcomeLabel} />
        <Metric label="Stake" value={stakeLabel} />
        {position.payout !== null && position.payout > 0n ? (
          <Metric
            label={position.isRefund ? "Refundable" : "Payout"}
            value={`${formatSol(position.payout)} SOL`}
            accent={status === "Claimable"}
          />
        ) : status === "Claimed" ? (
          <Metric label="Payout" value="Claimed" />
        ) : settledOutcome ? (
          <Metric label="Payout" value="0.000 SOL" />
        ) : (
          <Metric label="Payout" value="Pending" />
        )}
      </div>

      {/* Provenance */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-t border-border pt-3">
        <div className="flex flex-wrap items-center gap-x-4 gap-y-2">
          {position.betTx ? (
            <TxLink label="Bet" signature={position.betTx} />
          ) : (
            <span className="font-mono text-[10px] text-muted-foreground/60">
              Bet —
            </span>
          )}
          {meta?.settlementTx ? (
            <TxLink label="Settle" signature={meta.settlementTx} />
          ) : (
            <span className="font-mono text-[10px] text-muted-foreground/60">
              Settle —
            </span>
          )}
          {position.claimTx ? (
            <TxLink label="Claim" signature={position.claimTx} />
          ) : (
            <span className="font-mono text-[10px] text-muted-foreground/60">
              Claim —
            </span>
          )}
          <a
            href={explorerAddressUrl(position.positionPda)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] text-muted-foreground underline underline-offset-2 transition-colors hover:text-primary"
          >
            Position account ↗
          </a>
        </div>

        {/* Claiming lives on the fixture page — one signing path, not two. */}
        {fixtureHref && (
          <Link
            href={fixtureHref}
            className={`font-mono text-[10px] tracking-widest uppercase underline underline-offset-2 transition-colors ${
              status === "Claimable"
                ? "text-primary hover:text-primary/80"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            {status === "Claimable" ? "Claim on fixture →" : "View fixture →"}
          </Link>
        )}
      </div>
    </div>
  )
}
