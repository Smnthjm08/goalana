"use client"

import { useState } from "react"
import { explorerTxUrl } from "@/lib/solana-explorer"

export interface SessionTx {
  signature: string
  label: string
  ts: number
}

type StageStatus = "done" | "pending" | "skipped"

interface Stage {
  key: string
  label: string
  status: StageStatus
  tx?: string | null
  at?: number | null
  note?: string
}

function fmt(ts?: number | null): string {
  if (!ts) return ""
  return new Date(ts).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  })
}

function statusDot(status: StageStatus) {
  if (status === "done") return "bg-primary"
  if (status === "pending") return "bg-border"
  return "bg-border"
}

/**
 * Per-market lifecycle timeline: Create → Bet → Lock → Settle → Claim, each with
 * its on-chain transaction (Explorer link), timestamp, and status. Protocol
 * transitions (create/lock/settle) come from the market record; the connected
 * wallet's Bet/Claim come from this session's signed transactions. Makes the
 * trustless flow tangible — every state change is a verifiable on-chain action.
 */
export function MarketLifecycleTimeline({
  creationTx,
  createdAt,
  lockTx,
  lockedAt,
  settlementTx,
  settledAt,
  onChainStatus,
  sessionTxs,
  positionClaimed,
}: {
  creationTx?: string | null
  createdAt?: string | null
  lockTx?: string | null
  lockedAt?: string | null
  settlementTx?: string | null
  settledAt?: string | null
  onChainStatus?: string | null
  sessionTxs: SessionTx[]
  positionClaimed?: boolean
}) {
  const [open, setOpen] = useState(false)

  const betTx = sessionTxs.find((t) => t.label.startsWith("Bet"))
  const claimTx = sessionTxs.find((t) => t.label.startsWith("Claim"))

  const isLocked = onChainStatus === "Locked" || onChainStatus === "Settled"
  const isSettled = onChainStatus === "Settled"
  const isCancelled = onChainStatus === "Cancelled"

  const stages: Stage[] = [
    {
      key: "create",
      label: "Create Market",
      status: creationTx || onChainStatus ? "done" : "pending",
      tx: creationTx,
      at: createdAt ? Date.parse(createdAt) : null,
    },
    {
      key: "bet",
      label: "Place Bet",
      status: betTx ? "done" : "pending",
      tx: betTx?.signature,
      at: betTx?.ts,
      note: betTx ? betTx.label : "your bet this session",
    },
    {
      key: "lock",
      label: "Lock Market",
      status: isLocked ? "done" : isCancelled ? "skipped" : "pending",
      tx: lockTx,
      at: lockedAt ? Date.parse(lockedAt) : null,
      note: isCancelled ? "market cancelled" : undefined,
    },
    {
      key: "settle",
      label: "Settle Market",
      status: isSettled ? "done" : isCancelled ? "skipped" : "pending",
      tx: settlementTx,
      at: settledAt ? Date.parse(settledAt) : null,
      note: isSettled ? "verified on-chain via TxLINE CPI" : isCancelled ? "market cancelled" : undefined,
    },
    {
      key: "claim",
      label: "Claim",
      status: positionClaimed || claimTx ? "done" : "pending",
      tx: claimTx?.signature,
      at: claimTx?.ts,
      note: positionClaimed && !claimTx ? "claimed" : claimTx ? claimTx.label : "winners / refunds",
    },
  ]

  const completed = stages.filter((s) => s.status === "done").length

  return (
    <div className="flex flex-col gap-2 border-t border-border pt-3">
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between font-mono text-[10px] uppercase tracking-widest text-muted-foreground hover:text-primary transition-colors"
      >
        <span>Lifecycle &amp; transactions ({completed}/5)</span>
        <span>{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="flex flex-col">
          {stages.map((stage, i) => (
            <div key={stage.key} className="flex gap-3">
              {/* Rail */}
              <div className="flex flex-col items-center">
                <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${statusDot(stage.status)}`} />
                {i < stages.length - 1 && (
                  <span className={`w-px flex-1 ${stage.status === "done" ? "bg-primary/40" : "bg-border"}`} />
                )}
              </div>

              {/* Content */}
              <div className="flex flex-col gap-0.5 pb-3 min-w-0 flex-1">
                <div className="flex items-center justify-between gap-2">
                  <span
                    className={`font-heading text-[11px] uppercase tracking-widest ${
                      stage.status === "done" ? "text-foreground" : "text-muted-foreground"
                    }`}
                  >
                    {stage.label}
                  </span>
                  <span
                    className={`font-mono text-[9px] uppercase tracking-widest ${
                      stage.status === "done"
                        ? "text-primary"
                        : stage.status === "skipped"
                          ? "text-muted-foreground"
                          : "text-muted-foreground/60"
                    }`}
                  >
                    {stage.status === "done" ? "done" : stage.status === "skipped" ? "n/a" : "pending"}
                  </span>
                </div>
                {stage.at ? (
                  <span className="font-mono text-[9px] text-muted-foreground">{fmt(stage.at)}</span>
                ) : (
                  stage.note && <span className="font-mono text-[9px] text-muted-foreground/70">{stage.note}</span>
                )}
                {stage.at && stage.note && (
                  <span className="font-mono text-[9px] text-muted-foreground/70">{stage.note}</span>
                )}
                {stage.tx && (
                  <a
                    href={explorerTxUrl(stage.tx)}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-mono text-[9px] text-muted-foreground hover:text-primary transition-colors underline w-fit"
                  >
                    {stage.tx.slice(0, 8)}…{stage.tx.slice(-8)} ↗
                  </a>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
