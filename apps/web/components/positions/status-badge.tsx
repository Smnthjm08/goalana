import { Badge } from "@workspace/ui/components/badge"
import type { PositionStatus } from "@/hooks/use-wallet-positions"

// Color carries the meaning here, not just the label — each status maps to
// its own hue so the list scans at a glance. Note "Settled" (from derive() in
// use-wallet-positions) only ever means "settled with nothing to claim," i.e.
// lost — a won-and-paid position shows as "Claimed" instead.
const STATUS_STYLES: Record<PositionStatus, string> = {
  Open: "border-primary/20 bg-primary/5 text-primary",
  Locked: "border-amber-500/20 bg-amber-500/5 text-amber-500",
  Claimable: "border-primary/40 bg-primary/10 text-primary",
  Settled: "border-rose-500/20 bg-rose-500/5 text-rose-500",
  Claimed: "border-sky-500/20 bg-sky-500/5 text-sky-500",
}

export function StatusBadge({ status }: { status: PositionStatus }) {
  return (
    <Badge
      variant="outline"
      className={`shrink-0 text-[10px] tracking-widest uppercase ${STATUS_STYLES[status]}`}
    >
      {status}
    </Badge>
  )
}
