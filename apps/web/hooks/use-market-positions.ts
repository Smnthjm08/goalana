"use client"

import { useCallback, useEffect, useState } from "react"
import { PublicKey } from "@solana/web3.js"
import { useGoalanaProgram } from "./use-goalana-program"

// Position layout: 8 (discriminator) → `market` (Pubkey). See
// goalana_program/src/state/position.rs and use-wallet-positions.ts (which
// filters the same account by `user` at offset 40 instead).
const POSITION_MARKET_OFFSET = 8

export interface MarketActivityEntry {
  positionPda: string
  user: string
  yesAmount: bigint
  noAmount: bigint
  claimed: boolean
  /** Signature that opened this position, best-effort (oldest ok tx). */
  signature: string | null
  /** Unix seconds of that signature, for "time ago" — null if unavailable. */
  ts: number | null
}

/**
 * Every Position PDA for a single market — the bet activity feed and
 * participant count on the market details page. Mirrors useWalletPositions'
 * memcmp-filtered bulk read, just filtered by market instead of by wallet.
 */
export function useMarketPositions(marketPda: string | null | undefined) {
  const { program } = useGoalanaProgram()
  const [entries, setEntries] = useState<MarketActivityEntry[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!marketPda) {
      setEntries([])
      setLoading(false)
      return
    }

    try {
      const raw = await program.account.position.all([
        { memcmp: { offset: POSITION_MARKET_OFFSET, bytes: marketPda } },
      ])

      // Best-effort provenance — a slow/rate-limited RPC for signature
      // history must not blank out the position list itself.
      const signatures = await Promise.all(
        raw.map((entry) =>
          program.provider.connection
            .getSignaturesForAddress(entry.publicKey, { limit: 5 })
            .catch(() => [])
        )
      )

      const next: MarketActivityEntry[] = raw.map((entry, i) => {
        const ok = (signatures[i] ?? []).filter((s) => !s.err)
        const betSig = ok.length > 0 ? ok[ok.length - 1]! : null

        return {
          positionPda: entry.publicKey.toBase58(),
          user: (entry.account.user as PublicKey).toBase58(),
          yesAmount: BigInt(entry.account.yesAmount.toString()),
          noAmount: BigInt(entry.account.noAmount.toString()),
          claimed: Boolean(entry.account.claimed),
          signature: betSig?.signature ?? null,
          ts: betSig?.blockTime ?? null,
        }
      })

      next.sort((a, b) => (b.ts ?? 0) - (a.ts ?? 0))

      setEntries(next)
      setError(null)
    } catch (err) {
      console.error("useMarketPositions: failed to load market activity", err)
      setError("Failed to read market activity from the chain")
    } finally {
      setLoading(false)
    }
  }, [program, marketPda])

  useEffect(() => {
    setLoading(true)
    void refetch()
  }, [refetch])

  return { entries, loading, error, refetch }
}
