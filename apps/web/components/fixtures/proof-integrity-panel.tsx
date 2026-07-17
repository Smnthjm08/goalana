"use client"

import { useState } from "react"
import { explorerTxUrl, explorerAddressUrl } from "@/lib/solana-explorer"
import { TXLINE_ORACLE_PROGRAM_ID } from "@/lib/protocol"

// ─── Types (mirror ProofIntegrityArtifact in proof-integrity.service.ts) ─────
export interface ProofIntegrityCase {
  id: string
  title: string
  kind: "genuine" | "tampered"
  statLabel: string
  statKeys: number[]
  provenValues: number[]
  predicateLabel: string
  tamper: string | null
  expected: "accepted" | "rejected"
  txSignature: string
  accepted: boolean
  outcome: boolean | null
  computeUnits: number | null
  errorCode: number | null
  errorName: string | null
  logs: string[]
  oracleTsMs: number
  dailyRootsPda: string
}

export interface ProofIntegrityArtifact {
  fixtureId: number
  seq: number
  oracleProgram: string
  recordedAt: string
  cases: ProofIntegrityCase[]
}

function TxLink({ signature }: { signature: string }) {
  return (
    <a
      href={explorerTxUrl(signature)}
      target="_blank"
      rel="noopener noreferrer"
      className="font-mono text-[10px] break-all text-muted-foreground underline transition-colors hover:text-primary"
    >
      {signature.slice(0, 8)}…{signature.slice(-8)} ↗
    </a>
  )
}

function Logs({ logs }: { logs: string[] }) {
  const [open, setOpen] = useState(false)
  if (logs.length === 0) return null

  // The verdict line is the point of the whole panel — surface it without
  // making anyone expand anything.
  const headline = logs.find(
    (l) => l.includes("AnchorError") || l.includes("Evaluate predicate")
  )

  return (
    <div className="flex flex-col gap-1">
      {headline && (
        <span className="font-mono text-[10px] break-all text-foreground">
          {headline.replace(/^Program log: /, "")}
        </span>
      )}
      <button
        onClick={() => setOpen((v) => !v)}
        className="self-start font-mono text-[9px] tracking-widest text-primary uppercase transition-colors hover:text-foreground"
      >
        {open ? "− Hide" : "+ Show"} program logs ({logs.length})
      </button>
      {open && (
        <pre className="max-h-64 overflow-auto rounded-sm border border-border bg-background p-2 font-mono text-[9px] leading-relaxed text-muted-foreground">
          {logs.join("\n")}
        </pre>
      )}
    </div>
  )
}

function CaseRow({ c }: { c: ProofIntegrityCase }) {
  const asExpected =
    (c.expected === "accepted" && c.accepted) ||
    (c.expected === "rejected" && !c.accepted)
  const rejected = !c.accepted

  return (
    <div
      className={`flex flex-col gap-2 rounded-sm border p-3 ${
        rejected
          ? "border-rose-500/30 bg-rose-500/5"
          : "border-lime-600/30 bg-lime-600/5"
      }`}
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex flex-col gap-0.5">
          <span className="font-heading text-[11px] tracking-widest text-foreground uppercase">
            {c.title}
          </span>
          <span className="font-mono text-[10px] text-muted-foreground">
            stat keys {c.statKeys.join(" + ")} · {c.statLabel}
          </span>
        </div>
        <span
          className={`shrink-0 rounded-sm border px-1.5 py-0.5 font-mono text-[9px] tracking-widest uppercase ${
            rejected
              ? "border-rose-500/40 text-rose-600 dark:text-rose-400"
              : "border-lime-600/40 text-lime-700 dark:text-lime-400"
          }`}
        >
          {rejected ? "Rejected" : "Verified"}
        </span>
      </div>

      <div className="flex flex-col gap-1 border-t border-border/50 pt-2">
        <span className="font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
          Predicate evaluated on-chain
        </span>
        <span className="font-mono text-[10px] break-all text-foreground">
          {c.predicateLabel}
        </span>
      </div>

      {c.tamper && (
        <div className="flex flex-col gap-1">
          <span className="font-mono text-[9px] tracking-widest text-muted-foreground uppercase">
            What was forged
          </span>
          <span className="font-mono text-[10px] text-rose-600 dark:text-rose-400">
            {c.tamper}
          </span>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
        {c.accepted ? (
          <span className="font-mono text-[10px] text-muted-foreground">
            Oracle verdict:{" "}
            <span
              className={
                c.outcome
                  ? "text-lime-700 dark:text-lime-400"
                  : "text-rose-600 dark:text-rose-400"
              }
            >
              {c.outcome ? "YES" : "NO"}
            </span>
          </span>
        ) : (
          <span className="font-mono text-[10px] text-muted-foreground">
            Reverted:{" "}
            <span className="text-rose-600 dark:text-rose-400">
              {c.errorName ?? "error"}
              {c.errorCode !== null ? ` (${c.errorCode})` : ""}
            </span>
          </span>
        )}
        {c.computeUnits !== null && (
          <span className="font-mono text-[10px] text-muted-foreground">
            {c.computeUnits.toLocaleString()} CU
          </span>
        )}
        <TxLink signature={c.txSignature} />
        {!asExpected && (
          <span className="font-mono text-[10px] text-amber-600 dark:text-amber-400">
            ⚠ did not match the expected outcome
          </span>
        )}
      </div>

      <Logs logs={c.logs} />
    </div>
  )
}

/**
 * Proof-integrity evidence: real Devnet transactions proving that TxLINE's
 * oracle — the program `settle_market` delegates verification to by CPI —
 * accepts genuine Merkle proofs and rejects forged ones.
 *
 * Two claims, both shown rather than asserted:
 *   1. Forgery fails. Change one goal, or one byte of one sibling hash, and the
 *      oracle reverts. A false outcome cannot be settled.
 *   2. Settlement is stat-agnostic. Goals, corners and cards all verify through
 *      the identical predicate and instruction — only the stat keys differ.
 */
export function ProofIntegrityPanel({
  artifact,
}: {
  artifact: ProofIntegrityArtifact | null
}) {
  if (!artifact || artifact.cases.length === 0) {
    return (
      <div className="rounded-sm border border-border bg-card p-8 text-center">
        <span className="font-mono text-sm tracking-wider text-muted-foreground uppercase">
          No proof-integrity evidence recorded for this fixture.
        </span>
      </div>
    )
  }

  const genuine = artifact.cases.filter((c) => c.kind === "genuine")
  const tampered = artifact.cases.filter((c) => c.kind === "tampered")

  return (
    <div className="flex flex-col gap-6">
      {/* The claim */}
      <div className="flex flex-col gap-2 rounded-sm border border-primary/30 bg-primary/5 p-4">
        <span className="font-heading text-xs tracking-widest text-primary uppercase">
          Proof Integrity — Recorded on Devnet
        </span>
        <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
          Goalana never decides an outcome.{" "}
          <span className="text-foreground">settle_market</span> delegates to
          TxLINE&apos;s oracle by CPI into{" "}
          <span className="text-foreground">validate_stat</span>, which re-hashes
          the Merkle path against a root anchored on-chain. Every row below is a{" "}
          <span className="text-foreground">real Devnet transaction</span>{" "}
          calling that exact instruction with the exact arguments settlement
          uses — click any signature and read the logs yourself.
        </p>
        <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
          Recorded {new Date(artifact.recordedAt).toLocaleString()} · fixture{" "}
          {artifact.fixtureId} @ seq {artifact.seq} ·{" "}
          <a
            href={explorerAddressUrl(TXLINE_ORACLE_PROGRAM_ID)}
            target="_blank"
            rel="noopener noreferrer"
            className="underline transition-colors hover:text-primary"
          >
            oracle program ↗
          </a>
        </p>
      </div>

      {/* Claim 1 — forgery is rejected */}
      {tampered.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1 border-b border-border pb-2">
            <h3 className="font-heading text-sm tracking-widest text-foreground uppercase">
              A forged proof cannot settle a market
            </h3>
            <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
              The same proof as above, with a single lie introduced. The oracle
              recomputes the root, finds it doesn&apos;t match the anchored one,
              and reverts — so the CPI fails and{" "}
              <span className="text-foreground">settle_market</span> reverts with
              it. These transactions are on the ledger as failures.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {tampered.map((c) => (
              <CaseRow key={c.id} c={c} />
            ))}
          </div>
        </div>
      )}

      {/* Claim 2 — the engine is stat-agnostic */}
      {genuine.length > 0 && (
        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1 border-b border-border pb-2">
            <h3 className="font-heading text-sm tracking-widest text-foreground uppercase">
              The same engine settles any TxLINE statistic
            </h3>
            <p className="font-mono text-[10px] leading-relaxed text-muted-foreground">
              Goals, corners and cards — verified on-chain through the identical{" "}
              <span className="text-foreground">add + greaterThan</span>{" "}
              predicate and the identical instruction. Only the stat keys change.
              Goalana is not a goals oracle; it settles whatever TxLINE proves.
            </p>
          </div>
          <div className="grid grid-cols-1 gap-3 lg:grid-cols-2">
            {genuine.map((c) => (
              <CaseRow key={c.id} c={c} />
            ))}
          </div>
          <p className="font-mono text-[9px] leading-relaxed text-muted-foreground">
            Only goals back a tradeable market today: market creation is gated on
            TxLINE reference odds, and TxLINE prices no corners or cards markets
            for this competition. The settlement path itself is indifferent to
            which stat it proves.
          </p>
        </div>
      )}
    </div>
  )
}
