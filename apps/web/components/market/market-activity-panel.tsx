"use client"

import { LAMPORTS_PER_SOL } from "@solana/web3.js"
import { explorerAddressUrl } from "@/lib/solana-explorer"
import { formatRelativeAgo } from "@/lib/time"
import { useMarketPositions } from "@/hooks/use-market-positions"
import { useNow } from "@/hooks/use-now"

function shortAddr(address: string): string {
  return `${address.slice(0, 4)}…${address.slice(-4)}`
}

/** Participant count + recent bet activity for a single market — read straight off-chain. */
export function MarketActivityPanel({
  marketPda,
}: {
  marketPda: string | null | undefined
}) {
  const { entries, loading, error } = useMarketPositions(marketPda)
  const now = useNow(30_000)

  const staked = entries.filter((e) => e.yesAmount + e.noAmount > 0n)
  const participants = new Set(staked.map((e) => e.user)).size

  return (
    <div className="flex flex-col gap-4 rounded-sm border border-border bg-card p-5">
      <div className="flex items-center justify-between border-b border-border pb-3">
        <span className="font-heading text-sm tracking-widest text-foreground uppercase">
          Activity
        </span>
        <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
          {participants} participant{participants === 1 ? "" : "s"}
        </span>
      </div>

      {loading ? (
        <span className="font-mono text-[10px] text-muted-foreground">
          Loading on-chain activity…
        </span>
      ) : error ? (
        <span className="font-mono text-[10px] text-destructive">{error}</span>
      ) : staked.length === 0 ? (
        <span className="font-mono text-[10px] text-muted-foreground">
          No bets placed yet — be the first.
        </span>
      ) : (
        <div className="flex flex-col gap-3">
          {staked.slice(0, 12).map((entry) => {
            const side =
              entry.yesAmount > 0n && entry.noAmount > 0n
                ? "YES + NO"
                : entry.yesAmount > 0n
                  ? "YES"
                  : "NO"
            const amount =
              Number(entry.yesAmount + entry.noAmount) / LAMPORTS_PER_SOL

            return (
              <div
                key={entry.positionPda}
                className="flex items-center justify-between gap-3 font-mono text-[10px]"
              >
                <a
                  href={explorerAddressUrl(entry.user)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-muted-foreground underline underline-offset-2 transition-colors hover:text-primary"
                >
                  {shortAddr(entry.user)}
                </a>
                <span className={side === "NO" ? "text-neg" : "text-pos"}>
                  {side}
                </span>
                <span className="text-foreground tabular-nums">
                  {amount.toFixed(3)} SOL
                </span>
                <span className="text-muted-foreground">
                  {entry.ts && now
                    ? formatRelativeAgo(entry.ts * 1000, now)
                    : "—"}
                </span>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
