import { BadgeCheck } from "lucide-react"
import { explorerAddressUrl } from "@/lib/solana-explorer"

/**
 * "This isn't a screenshot" — every value on a shared page is read live from
 * a Solana account, not a database row. Links straight to the account that
 * backs the numbers so anyone can verify it themselves.
 */
export function VerificationBadge({ address }: { address: string }) {
  return (
    <a
      href={explorerAddressUrl(address)}
      target="_blank"
      rel="noopener noreferrer"
      className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-primary uppercase transition-colors hover:text-primary/80"
    >
      <BadgeCheck className="size-3.5" />
      Verified on-chain ↗
    </a>
  )
}
