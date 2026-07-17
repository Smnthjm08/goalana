"use client"

import { useEffect, useState } from "react"
import axiosInstance from "@/lib/axios-instance"
import {
  SettlementProofReceipt,
  type SettlementProof,
} from "./settlement-proof-receipt"

/**
 * Fetches and renders the live TxLINE Merkle proof for a finished fixture
 * (total goals ≷ 1.5), so the settlement-proof visualization — Goalana's
 * headline trust artifact — is always demoable on any final match, even if none
 * of our own on-chain markets settled that specific fixture. For a market that
 * DID settle on-chain, its own persisted receipt (with a real settle tx) renders
 * inside the market card; this panel is the fixture-wide, always-available view.
 */
export function SettlementProofPanel({
  fixtureId,
  isFinal,
}: {
  fixtureId: string | number
  isFinal: boolean
}) {
  const [proof, setProof] = useState<SettlementProof | null>(null)
  const [state, setState] = useState<"loading" | "ready" | "empty">("loading")

  useEffect(() => {
    if (!isFinal) {
      setState("empty")
      return
    }
    let cancelled = false
    axiosInstance
      .get(`/fixtures/${fixtureId}/proof-preview`)
      .then((res) => {
        if (cancelled) return
        if (res.data?.data?.proof) {
          setProof(res.data.data.proof as SettlementProof)
          setState("ready")
        } else {
          setState("empty")
        }
      })
      .catch(() => {
        if (!cancelled) setState("empty")
      })
    return () => {
      cancelled = true
    }
  }, [fixtureId, isFinal])

  if (!isFinal) {
    return (
      <div className="rounded-sm border border-border bg-card p-8 text-center">
        <span className="font-mono text-sm tracking-wider text-muted-foreground uppercase">
          Settlement proof becomes available once the match is final.
        </span>
      </div>
    )
  }

  if (state === "loading") {
    return (
      <div className="rounded-sm border border-border bg-card p-8 text-center">
        <span className="animate-pulse font-mono text-sm tracking-wider text-muted-foreground uppercase">
          [ Fetching TxLINE Merkle proof… ]
        </span>
      </div>
    )
  }

  if (state === "empty" || !proof) {
    return (
      <div className="rounded-sm border border-border bg-card p-8 text-center">
        <span className="font-mono text-sm tracking-wider text-muted-foreground uppercase">
          No TxLINE proof available for this fixture yet.
        </span>
      </div>
    )
  }

  return (
    <div className="flex flex-col gap-3">
      <p className="font-mono text-[10px] leading-snug text-muted-foreground">
        Total goals for this match, proven from TxLINE&apos;s signed feed. This
        is the same three-stage Merkle proof our on-chain{" "}
        <span className="text-foreground">settle_market</span> instruction
        verifies by CPI into TxLINE&apos;s oracle program — the daily batch root
        is anchored on Solana Devnet.
      </p>
      <SettlementProofReceipt proof={proof} mode="preview" />
    </div>
  )
}
