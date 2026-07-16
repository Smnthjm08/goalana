"use client"

import Link from "next/link"
import { LAMPORTS_PER_SOL } from "@solana/web3.js"
import { useWalletModal } from "@solana/wallet-adapter-react-ui"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { explorerAddressUrl, explorerTxUrl } from "@/lib/solana-explorer"
import { useGoalanaProgram } from "@/hooks/use-goalana-program"
import {
  useWalletPositions,
  type PositionStatus,
  type WalletPosition,
} from "@/hooks/use-wallet-positions"
import { TeamBadge } from "@/components/team-badge"

function formatSol(lamports: bigint): string {
  return (Number(lamports) / LAMPORTS_PER_SOL).toFixed(3)
}

// Only Claimable earns the accent — it's the one state that asks the user to
// do something. Everything else is information, so it stays quiet.
const STATUS_STYLES: Record<PositionStatus, string> = {
  Claimable: "border-primary/40 bg-primary/10 text-primary",
  Open: "border-border bg-muted/40 text-foreground",
  Locked: "border-border bg-muted/40 text-muted-foreground",
  Settled: "border-border bg-muted/40 text-muted-foreground",
  Claimed: "border-border bg-muted/40 text-muted-foreground",
}

const STATUS_HINTS: Record<PositionStatus, string> = {
  Claimable: "Settled in your favour — the payout is waiting in the vault.",
  Open: "Betting is still open; the pool can still move.",
  Locked: "Betting closed at kickoff. Waiting for the match to end.",
  Settled: "This market settled against your side.",
  Claimed: "Paid out — the vault has already transferred your winnings.",
}

function StatusBadge({ status }: { status: PositionStatus }) {
  return (
    <span
      className={`shrink-0 rounded-sm border px-2 py-0.5 font-mono text-[10px] uppercase tracking-widest ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  )
}

function TxLink({ label, signature }: { label: string; signature: string }) {
  return (
    <a
      href={explorerTxUrl(signature)}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono text-[10px] text-muted-foreground underline underline-offset-2 transition-colors hover:text-primary"
    >
      {label} ↗
    </a>
  )
}

/** A labelled value in the stake/payout row. */
function Metric({
  label,
  value,
  accent,
}: {
  label: string
  value: string
  accent?: boolean
}) {
  return (
    <div className="flex flex-col gap-1">
      <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        {label}
      </span>
      <span
        className={`font-heading text-base tabular-nums ${accent ? "text-primary" : "text-foreground"}`}
      >
        {value}
      </span>
    </div>
  )
}

function PositionCard({ position }: { position: WalletPosition }) {
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

  return (
    <div className="flex flex-col gap-4 rounded-sm border border-border bg-card p-4 transition-colors hover:border-primary/40 md:p-5">
      {/* Fixture + status */}
      <div className="flex items-start justify-between gap-3 border-b border-border pb-3">
        <div className="flex min-w-0 flex-col gap-1.5">
          {meta ? (
            <>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                {meta.fixture.competition}
              </span>
              <div className="flex flex-wrap items-center gap-x-2 gap-y-1">
                <TeamBadge
                  name={meta.fixture.participant1}
                  className="font-sans text-sm font-bold text-foreground"
                />
                <span className="font-mono text-[10px] text-muted-foreground">v</span>
                <TeamBadge
                  name={meta.fixture.participant2}
                  className="font-sans text-sm font-bold text-foreground"
                />
              </div>
            </>
          ) : (
            <>
              <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
                Fixture unavailable
              </span>
              <span className="font-mono text-xs text-foreground">
                {position.marketPda.slice(0, 8)}…{position.marketPda.slice(-8)}
              </span>
            </>
          )}
        </div>
        <StatusBadge status={status} />
      </div>

      {/* Market */}
      <div className="flex flex-col gap-1">
        <span className="font-sans text-base font-bold leading-snug text-foreground">
          {meta?.question ?? "Market metadata unavailable — read from chain only"}
        </span>
        <span className="font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
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
            <span className="font-mono text-[10px] text-muted-foreground/60">Bet —</span>
          )}
          {meta?.settlementTx ? (
            <TxLink label="Settle" signature={meta.settlementTx} />
          ) : (
            <span className="font-mono text-[10px] text-muted-foreground/60">Settle —</span>
          )}
          {position.claimTx ? (
            <TxLink label="Claim" signature={position.claimTx} />
          ) : (
            <span className="font-mono text-[10px] text-muted-foreground/60">Claim —</span>
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
            className={`font-mono text-[10px] uppercase tracking-widest underline underline-offset-2 transition-colors ${
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

function PageShell({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex w-full flex-col p-4 md:p-8 lg:p-12">
      <div className="mx-auto flex w-full max-w-4xl flex-col gap-8">
        <div className="flex flex-col gap-3 border-b border-border pb-4">
          <h1 className="font-heading text-2xl uppercase tracking-widest text-primary">
            My Positions
          </h1>
          <p className="max-w-2xl font-mono text-[11px] leading-relaxed text-muted-foreground">
            Every bet this wallet holds, read straight from its on-chain Position
            accounts — not from Goalana&apos;s database.
          </p>
        </div>
        {children}
      </div>
    </div>
  )
}

export default function PositionsPage() {
  const { connected, publicKey } = useGoalanaProgram()
  const { setVisible } = useWalletModal()
  const { positions, loading, error } = useWalletPositions()

  if (!connected || !publicKey) {
    return (
      <PageShell>
        <div className="flex flex-col items-center gap-4 rounded-sm border border-dashed border-border bg-card px-6 py-16 text-center">
          <span className="font-heading text-lg uppercase tracking-widest text-foreground">
            Connect your wallet
          </span>
          <p className="max-w-sm font-mono text-[11px] leading-relaxed text-muted-foreground">
            Your positions are Solana accounts owned by your wallet. Connect to
            read them from Devnet.
          </p>
          <Button
            onClick={() => setVisible(true)}
            className="mt-1 font-heading uppercase tracking-widest"
          >
            Connect Wallet
          </Button>
        </div>
      </PageShell>
    )
  }

  if (loading) {
    return (
      <PageShell>
        <div className="flex flex-col gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-56 w-full rounded-sm" />
          ))}
        </div>
      </PageShell>
    )
  }

  if (error) {
    return (
      <PageShell>
        <div className="flex flex-col items-center gap-2 rounded-sm border border-destructive/40 bg-card px-6 py-12 text-center">
          <span className="font-mono text-sm uppercase tracking-wider text-destructive">
            [ {error} ]
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            The Devnet RPC may be rate-limiting. Refresh to retry.
          </span>
        </div>
      </PageShell>
    )
  }

  if (positions.length === 0) {
    return (
      <PageShell>
        <div className="flex flex-col items-center gap-4 rounded-sm border border-dashed border-border bg-card px-6 py-16 text-center">
          <div className="flex h-10 w-10 items-center justify-center rounded-sm border border-border bg-muted/40">
            <span className="font-heading text-base text-muted-foreground">0</span>
          </div>
          <span className="font-heading text-lg uppercase tracking-widest text-foreground">
            No positions yet
          </span>
          <p className="max-w-sm font-mono text-[11px] leading-relaxed text-muted-foreground">
            This wallet hasn&apos;t bet on a Goalana market. Place one on any open
            market and it will show up here with its on-chain proof.
          </p>
          <Button asChild className="mt-1 font-heading uppercase tracking-widest">
            <Link href="/">Browse Markets</Link>
          </Button>
        </div>
      </PageShell>
    )
  }

  const totalStaked = positions.reduce((sum, p) => sum + p.yesAmount + p.noAmount, 0n)
  const totalClaimable = positions
    .filter((p) => p.status === "Claimable")
    .reduce((sum, p) => sum + (p.payout ?? 0n), 0n)

  return (
    <PageShell>
      {/* One quiet line of totals — enough to orient, not a dashboard. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[10px] uppercase tracking-widest text-muted-foreground">
        <span>
          {positions.length} position{positions.length === 1 ? "" : "s"}
        </span>
        <span>{formatSol(totalStaked)} SOL staked</span>
        {totalClaimable > 0n && (
          <span className="text-primary">{formatSol(totalClaimable)} SOL claimable</span>
        )}
      </div>

      <div className="flex flex-col gap-4">
        {positions.map((position) => (
          <PositionCard key={position.positionPda} position={position} />
        ))}
      </div>
    </PageShell>
  )
}
