"use client"

import Link from "next/link"
import { useWalletModal } from "@solana/wallet-adapter-react-ui"
import { Button } from "@workspace/ui/components/button"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { useGoalanaProgram } from "@/hooks/use-goalana-program"
import { useWalletPositions } from "@/hooks/use-wallet-positions"
import { PageShell } from "@/components/positions/page-shell"
import { PositionCard, formatSol } from "@/components/positions/position-card"

export default function PositionsPage() {
  const { connected, publicKey } = useGoalanaProgram()
  const { setVisible } = useWalletModal()
  const { positions, loading, error } = useWalletPositions()

  if (!connected || !publicKey) {
    return (
      <PageShell>
        <div className="flex flex-col items-center gap-4 rounded-sm border border-dashed border-border bg-card px-6 py-16 text-center">
          <span className="font-heading text-lg tracking-widest text-foreground uppercase">
            Connect your wallet
          </span>
          <p className="max-w-sm font-mono text-[11px] leading-relaxed text-muted-foreground">
            Your positions are Solana accounts owned by your wallet. Connect to
            read them from Devnet.
          </p>
          <Button
            onClick={() => setVisible(true)}
            className="mt-1 font-heading tracking-widest uppercase"
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
          <span className="font-mono text-sm tracking-wider text-destructive uppercase">
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
            <span className="font-heading text-base text-muted-foreground">
              0
            </span>
          </div>
          <span className="font-heading text-lg tracking-widest text-foreground uppercase">
            No positions yet
          </span>
          <p className="max-w-sm font-mono text-[11px] leading-relaxed text-muted-foreground">
            This wallet hasn&apos;t bet on a Goalana market. Place one on any
            open market and it will show up here with its on-chain proof.
          </p>
          <Button
            asChild
            className="mt-1 font-heading tracking-widest uppercase"
          >
            <Link href="/fixtures">Browse Fixtures</Link>
          </Button>
        </div>
      </PageShell>
    )
  }

  const totalStaked = positions.reduce(
    (sum, p) => sum + p.yesAmount + p.noAmount,
    0n
  )
  const totalClaimable = positions
    .filter((p) => p.status === "Claimable")
    .reduce((sum, p) => sum + (p.payout ?? 0n), 0n)

  return (
    <PageShell>
      {/* One quiet line of totals — enough to orient, not a dashboard. */}
      <div className="flex flex-wrap items-center gap-x-6 gap-y-2 font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
        <span>
          {positions.length} position{positions.length === 1 ? "" : "s"}
        </span>
        <span>{formatSol(totalStaked)} SOL staked</span>
        {totalClaimable > 0n && (
          <span className="text-primary">
            {formatSol(totalClaimable)} SOL claimable
          </span>
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
