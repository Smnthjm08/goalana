import { explorerTxUrl } from "@/lib/solana-explorer"

export function TxLink({
  label,
  signature,
}: {
  label: string
  signature: string | null | undefined
}) {
  if (!signature) {
    return (
      <span className="font-mono text-[10px] text-muted-foreground/50">
        {label}: —
      </span>
    )
  }
  return (
    <a
      href={explorerTxUrl(signature)}
      target="_blank"
      rel="noopener noreferrer"
      className="block truncate font-mono text-[10px] text-muted-foreground underline decoration-border underline-offset-2 transition-colors hover:text-primary"
    >
      {label}: {signature.slice(0, 8)}…{signature.slice(-8)} ↗
    </a>
  )
}
