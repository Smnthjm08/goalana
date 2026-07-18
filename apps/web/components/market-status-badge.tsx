import { Badge } from "@workspace/ui/components/badge"
import type { OnChainMarketStatus } from "@/hooks/use-market-account"

const STATUS_STYLES: Record<OnChainMarketStatus, string> = {
  Open: "border-primary/20 bg-primary/5 text-primary",
  Locked: "border-amber-500/20 bg-amber-500/5 text-amber-500",
  Settled: "border-border bg-input/20 text-foreground",
  Cancelled: "border-destructive/20 bg-destructive/5 text-destructive",
}

export function MarketStatusBadge({
  status,
  className = "",
}: {
  status: OnChainMarketStatus
  className?: string
}) {
  return (
    <Badge
      variant="outline"
      className={`text-[9px] ${STATUS_STYLES[status]} ${className}`}
    >
      {status}
    </Badge>
  )
}
