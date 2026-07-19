"use client"

import { useEffect, useState } from "react"
import {
  TXLINE_PERIOD_LABELS,
  TXLINE_STAT_LABELS,
} from "@workspace/goalana-sdk"
import { explorerTxUrl, explorerAddressUrl } from "@/lib/solana-explorer"
import { TXLINE_ORACLE_PROGRAM_ID } from "@/lib/protocol"
import {
  verifySettlementProof,
  type ProofVerificationResult,
} from "@/lib/merkle-verify"

// ─── Types (mirror buildSettlementProofRecord in settlement.service.ts) ──────
interface ProofNode {
  hash: string
  isRightSibling: boolean
}
interface Stat {
  key: number
  value: number
  period: number
}
export interface SettlementProof {
  ts: number
  outcome: boolean | null
  fixtureId: number
  statToProve: Stat
  statToProve2: Stat | null
  eventStatRoot: string
  statProof: ProofNode[]
  statProof2: ProofNode[]
  eventsSubTreeRoot: string
  subTreeProof: ProofNode[]
  mainTreeProof: ProofNode[]
  dailyRootsPda: string
}

// Stat/period labels live in the SDK (txline-stats.ts) so settlement, this
// receipt, and the proof-integrity panel all decode a key the same way. Real
// full-match proofs carry period=100, not the documented 0 — the SDK's map
// covers both; see its comment for the evidence.
function describeStat(stat: Stat): string {
  const base = stat.key % 1000
  const label = TXLINE_STAT_LABELS[base] ?? `Stat #${base}`
  const period = TXLINE_PERIOD_LABELS[stat.period] ?? `Period ${stat.period}`
  return `${label} (${period}) = ${stat.value}`
}

function shortHash(hex: string): string {
  if (hex.length <= 20) return hex
  return `${hex.slice(0, 10)}…${hex.slice(-10)}`
}

function Hash({ hex }: { hex: string }) {
  return (
    <span
      className="font-mono text-[10px] break-all text-foreground"
      title={hex}
    >
      0x{shortHash(hex)}
    </span>
  )
}

function ProofChain({ nodes }: { nodes: ProofNode[] }) {
  if (nodes.length === 0) {
    return (
      <span className="font-mono text-[10px] text-muted-foreground italic">
        (leaf is the root — no sibling hashes)
      </span>
    )
  }
  return (
    <div className="flex flex-col gap-1">
      {nodes.map((node, i) => (
        <div key={i} className="flex items-center gap-2 font-mono text-[10px]">
          <span
            className={`shrink-0 rounded-sm border px-1 py-0.5 text-[9px] uppercase ${
              node.isRightSibling
                ? "border-primary/30 text-primary"
                : "border-border text-muted-foreground"
            }`}
            title={
              node.isRightSibling
                ? "sibling on the right"
                : "sibling on the left"
            }
          >
            {node.isRightSibling ? "R" : "L"}
          </span>
          <span className="break-all text-muted-foreground" title={node.hash}>
            0x{shortHash(node.hash)}
          </span>
        </div>
      ))}
    </div>
  )
}

function Stage({
  index,
  title,
  from,
  to,
  toLabel,
  nodes,
}: {
  index: number
  title: string
  from: React.ReactNode
  to: React.ReactNode
  toLabel: string
  nodes: ProofNode[]
}) {
  return (
    <div className="flex flex-col gap-2 rounded-sm border border-border bg-background p-3">
      <div className="flex items-center gap-2">
        <span className="font-mono text-[10px] text-primary">
          {String(index).padStart(2, "0")}
        </span>
        <span className="font-heading text-[11px] tracking-widest text-foreground uppercase">
          {title}
        </span>
      </div>
      <div className="flex flex-col gap-1.5 pl-1">
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
            Input
          </span>
          {from}
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
            Merkle path ({nodes.length} sibling{nodes.length === 1 ? "" : "s"})
          </span>
          <ProofChain nodes={nodes} />
        </div>
        <div className="flex flex-col gap-0.5">
          <span className="font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
            ↓ {toLabel}
          </span>
          {to}
        </div>
      </div>
    </div>
  )
}

/**
 * Verifiable settlement receipt — renders the exact three-stage TxLINE Merkle
 * proof that settled a market: stat leaf → eventStatRoot → events-subtree root
 * → anchored daily batch root. This is the same proof the on-chain
 * `settle_market` CPI verified against TxLINE's oracle program; showing it here
 * makes Goalana's trustless claim inspectable instead of asserted.
 */
export function SettlementProofReceipt({
  proof,
  settlementTx,
  marketPda,
  mode = "settled",
}: {
  proof: SettlementProof
  settlementTx?: string | null
  marketPda?: string
  /** "settled" = this market resolved on-chain; "preview" = a live TxLINE proof
   *  for a finished fixture, shown before/without our own market settling it. */
  mode?: "settled" | "preview"
}) {
  const [open, setOpen] = useState(mode === "preview")
  const [verification, setVerification] = useState<
    ProofVerificationResult | "checking" | "error" | null
  >(null)

  // Recomputes the leaf → eventStatRoot → eventsSubTreeRoot hash chain
  // entirely in the browser from the stat values + sibling hashes already
  // rendered below — no backend call, no trust in Goalana's server. See
  // lib/merkle-verify.ts for how the hash scheme itself was derived.
  useEffect(() => {
    let cancelled = false
    setVerification("checking")
    verifySettlementProof(proof)
      .then((result) => {
        if (cancelled) return
        setVerification(result)
        if (!result.allVerified) {
          console.info("Settlement proof re-verification (partial):", result)
        }
      })
      .catch(() => {
        if (!cancelled) setVerification("error")
      })
    return () => {
      cancelled = true
    }
  }, [proof])

  const outcomeLabel =
    proof.outcome === true ? "YES" : proof.outcome === false ? "NO" : "—"
  const isPreview = mode === "preview"

  return (
    <div className="flex flex-col gap-3 rounded-sm border border-primary/30 bg-primary/5 p-4">
      {/* Header — the trust claim + resolved outcome */}
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-1">
          <span className="font-heading text-xs tracking-widest text-primary uppercase">
            {isPreview
              ? "Live TxLINE Proof — On-Chain Verifiable"
              : "Settlement Proof — Verified On-Chain"}
          </span>
          <span className="max-w-md font-mono text-[10px] leading-snug text-muted-foreground">
            {isPreview ? (
              <>
                This is the exact TxLINE Merkle proof our{" "}
                <span className="text-foreground">settle_market</span>{" "}
                instruction verifies by CPI into TxLINE&apos;s oracle. Its daily
                batch root is anchored on-chain, so anyone can re-derive it —
                the outcome is not asserted by Goalana.
              </>
            ) : (
              <>
                This outcome was decided by a TxLINE Merkle proof verified
                inside the{" "}
                <span className="text-foreground">settle_market</span>{" "}
                transaction via CPI into TxLINE&apos;s oracle — not by
                Goalana&apos;s backend.
              </>
            )}
          </span>
          {!isPreview && (
            <span className="max-w-md font-mono text-[9px] leading-snug text-muted-foreground">
              <span className="text-primary">Permissionless.</span>{" "}
              <span className="text-foreground">settle_market</span> takes no
              authority signer — anyone holding this same TxLINE proof could
              have submitted it. Our keeper is a convenience, not an authority.
            </span>
          )}
        </div>
        <div className="flex shrink-0 flex-col items-end gap-1">
          <span className="font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
            Outcome
          </span>
          <span
            className={`font-heading text-lg leading-none ${
              proof.outcome === true
                ? "text-lime-400"
                : proof.outcome === false
                  ? "text-rose-500"
                  : "text-foreground"
            }`}
          >
            {outcomeLabel}
          </span>
        </div>
      </div>

      {/* Independent client-side re-verification — recomputed live in this
          browser tab from the leaf + sibling hashes rendered below, no
          backend call. This is the "don't trust us" check: it either
          reproduces TxLINE's stated roots bit-for-bit or it doesn't. */}
      <div className="flex items-center gap-2 border-t border-primary/20 pt-3 font-mono text-[10px] tracking-widest uppercase">
        {verification === "checking" || verification === null ? (
          <span className="animate-pulse text-muted-foreground">
            Recomputing proof in your browser…
          </span>
        ) : verification === "error" ? (
          <span className="text-muted-foreground">
            Browser verification unavailable
          </span>
        ) : verification.allVerified ? (
          <span className="text-lime-400">
            ✓ Independently reproduced in your browser — matches
            TxLINE&apos;s stated roots
          </span>
        ) : (
          <span className="text-muted-foreground">
            ○ Partial browser re-verification — see console for per-stat detail
          </span>
        )}
      </div>

      {/* What was proven */}
      <div className="flex flex-col gap-1 border-t border-primary/20 pt-3">
        <span className="font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
          Stat proven
        </span>
        <span className="font-mono text-[11px] text-foreground">
          {describeStat(proof.statToProve)}
        </span>
        {proof.statToProve2 && (
          <span className="font-mono text-[11px] text-foreground">
            + {describeStat(proof.statToProve2)}
          </span>
        )}
        <span className="font-mono text-[9px] text-muted-foreground">
          Oracle stat timestamp: {new Date(proof.ts).toLocaleString()}
        </span>
      </div>

      {/* Evidence links */}
      <div className="flex flex-col gap-1 border-t border-primary/20 pt-3">
        {settlementTx && (
          <a
            href={explorerTxUrl(settlementTx)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] text-muted-foreground underline transition-colors hover:text-primary"
          >
            settle_market tx: {settlementTx.slice(0, 8)}…
            {settlementTx.slice(-8)} ↗
          </a>
        )}
        <a
          href={explorerAddressUrl(proof.dailyRootsPda)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[10px] text-muted-foreground underline transition-colors hover:text-primary"
        >
          Anchored daily-roots PDA: {proof.dailyRootsPda.slice(0, 8)}…
          {proof.dailyRootsPda.slice(-8)} ↗
        </a>
        <a
          href={explorerAddressUrl(TXLINE_ORACLE_PROGRAM_ID)}
          target="_blank"
          rel="noopener noreferrer"
          className="font-mono text-[10px] text-muted-foreground underline transition-colors hover:text-primary"
        >
          TxLINE oracle program (CPI target) ↗
        </a>
        {marketPda && (
          <a
            href={explorerAddressUrl(marketPda)}
            target="_blank"
            rel="noopener noreferrer"
            className="font-mono text-[10px] text-muted-foreground underline transition-colors hover:text-primary"
          >
            Market account ↗
          </a>
        )}
      </div>

      {/* The Merkle chain itself — collapsed by default */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="flex items-center justify-between border-t border-primary/20 pt-3 font-mono text-[10px] tracking-widest text-primary uppercase transition-colors hover:text-foreground"
      >
        <span>{open ? "Hide" : "Inspect"} the Merkle proof chain</span>
        <span>{open ? "−" : "+"}</span>
      </button>

      {open && (
        <div className="flex flex-col gap-2">
          <Stage
            index={1}
            title="Stat leaf → event stat root"
            toLabel="Event stat root"
            nodes={proof.statProof}
            from={
              <span className="font-mono text-[10px] text-foreground">
                {describeStat(proof.statToProve)}
              </span>
            }
            to={<Hash hex={proof.eventStatRoot} />}
          />
          <Stage
            index={2}
            title="Event stat root → events subtree root"
            toLabel="Events subtree root"
            nodes={proof.subTreeProof}
            from={<Hash hex={proof.eventStatRoot} />}
            to={<Hash hex={proof.eventsSubTreeRoot} />}
          />
          <Stage
            index={3}
            title="Subtree root → anchored daily batch root"
            toLabel="Daily batch root (on-chain)"
            nodes={proof.mainTreeProof}
            from={<Hash hex={proof.eventsSubTreeRoot} />}
            to={
              <a
                href={explorerAddressUrl(proof.dailyRootsPda)}
                target="_blank"
                rel="noopener noreferrer"
                className="font-mono text-[10px] break-all text-primary underline"
              >
                daily_scores_roots PDA {proof.dailyRootsPda.slice(0, 8)}…
                {proof.dailyRootsPda.slice(-8)} ↗
              </a>
            }
          />
          <span className="px-1 font-mono text-[9px] leading-snug text-muted-foreground">
            TxLINE anchors the daily batch root on-chain. The oracle program
            re-hashes this path during the CPI; if any hash or sibling direction
            is wrong, <span className="text-foreground">validate_stat</span>{" "}
            fails and <span className="text-foreground">settle_market</span>{" "}
            reverts — so a false outcome cannot be settled.
          </span>
        </div>
      )}
    </div>
  )
}
