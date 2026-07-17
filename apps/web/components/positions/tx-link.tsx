import { explorerTxUrl } from "@/lib/solana-explorer"

export function TxLink({ label, signature }: { label: string; signature: string }) {
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
