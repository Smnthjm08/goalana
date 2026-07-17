import type { PositionStatus } from "@/hooks/use-wallet-positions"

// Only Claimable earns the accent — it's the one state that asks the user to
// do something. Everything else is information, so it stays quiet.
const STATUS_STYLES: Record<PositionStatus, string> = {
  Claimable: "border-primary/40 bg-primary/10 text-primary",
  Open: "border-border bg-muted/40 text-foreground",
  Locked: "border-border bg-muted/40 text-muted-foreground",
  Settled: "border-border bg-muted/40 text-muted-foreground",
  Claimed: "border-border bg-muted/40 text-muted-foreground",
}

export function StatusBadge({ status }: { status: PositionStatus }) {
  return (
    <span
      className={`shrink-0 rounded-sm border px-2 py-0.5 font-mono text-[10px] tracking-widest uppercase ${STATUS_STYLES[status]}`}
    >
      {status}
    </span>
  )
}
