import { explorerAddressUrl } from "@/lib/solana-explorer"
import { CopyButton } from "@/components/inspector/copy-button"

/** Full address/PDA display for the protocol-overview cards — never truncated, always linked + copyable. */
export function FullAddressRow({
  label,
  address,
  sublabel,
}: {
  label: string
  address: string
  sublabel?: string
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex items-center justify-between gap-2">
        <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
          {label}
        </span>
        {sublabel && (
          <span className="font-mono text-[9px] text-muted-foreground/60">
            {sublabel}
          </span>
        )}
      </div>
      <div className="flex items-center gap-2">
        <a
          href={explorerAddressUrl(address)}
          target="_blank"
          rel="noopener noreferrer"
          className="min-w-0 flex-1 truncate font-mono text-[11px] text-foreground underline decoration-border underline-offset-2 transition-colors hover:text-primary"
        >
          {address}
        </a>
        <CopyButton value={address} />
      </div>
    </div>
  )
}
