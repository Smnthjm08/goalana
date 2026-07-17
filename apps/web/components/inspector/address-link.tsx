import { explorerAddressUrl } from "@/lib/solana-explorer"
import { CopyButton } from "@/components/inspector/copy-button"

/** Compact truncated address for dense table cells — still linked + copyable. */
export function AddressLink({ address }: { address: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
      <a
        href={explorerAddressUrl(address)}
        target="_blank"
        rel="noopener noreferrer"
        title={address}
        className="underline decoration-border underline-offset-2 transition-colors hover:text-primary"
      >
        {address.slice(0, 4)}…{address.slice(-4)} ↗
      </a>
      <CopyButton value={address} />
    </span>
  )
}
