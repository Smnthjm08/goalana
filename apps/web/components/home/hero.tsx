import { explorerAddressUrl } from "@/lib/solana-explorer"
import { GOALANA_PROGRAM_ID, TRUST_STATEMENT, LIFECYCLE_STEPS } from "@/lib/protocol"

export function Hero() {
  return (
    <div className="flex w-full flex-col gap-8 rounded-sm border border-border bg-card p-6 md:p-10">
      <div className="flex flex-col gap-4">
        <span className="font-mono text-[10px] tracking-[0.25em] text-primary uppercase md:text-xs">
          Trustless settlement · Solana Devnet · Powered by TxLINE
        </span>
        <h1 className="font-heading text-3xl leading-[0.95] font-black tracking-tight text-foreground uppercase md:text-5xl lg:text-6xl">
          World Cup markets that
          <br className="hidden md:block" /> settle themselves.
        </h1>
        <p className="max-w-2xl font-sans text-sm leading-relaxed text-muted-foreground md:text-base">
          {TRUST_STATEMENT}
        </p>
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 pt-1">
          <a
            href={explorerAddressUrl(GOALANA_PROGRAM_ID)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] text-muted-foreground underline transition-colors hover:text-primary md:text-xs"
          >
            Program {GOALANA_PROGRAM_ID.slice(0, 6)}…
            {GOALANA_PROGRAM_ID.slice(-6)} — verify on Explorer ↗
          </a>
        </div>
      </div>

      {/* How it works — the protocol lifecycle, settlement highlighted. */}
      <div className="flex flex-col gap-3 border-t border-border pt-6">
        <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
          How a market resolves
        </span>
        <div className="grid grid-cols-2 gap-2 md:grid-cols-5">
          {LIFECYCLE_STEPS.map((step, i) => (
            <div
              key={step.key}
              className={`flex flex-col gap-1.5 rounded-sm border p-3 ${
                step.trust
                  ? "border-primary/40 bg-primary/5"
                  : "border-border bg-background"
              }`}
            >
              <div className="flex items-center gap-2">
                <span
                  className={`font-mono text-[10px] ${step.trust ? "text-primary" : "text-muted-foreground"}`}
                >
                  {String(i + 1).padStart(2, "0")}
                </span>
                <span
                  className={`font-heading text-xs tracking-widest uppercase ${step.trust ? "text-primary" : "text-foreground"}`}
                >
                  {step.label}
                </span>
              </div>
              <span className="font-mono text-[10px] leading-snug text-muted-foreground">
                {step.detail}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
