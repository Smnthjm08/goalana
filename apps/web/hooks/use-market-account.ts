"use client"

import { useCallback, useState } from "react"
import { PublicKey } from "@solana/web3.js"
import { useGoalanaProgram } from "./use-goalana-program"
import { useSmartPolling } from "./use-smart-polling"

export type OnChainMarketStatus = "Open" | "Locked" | "Settled" | "Cancelled"

export interface OnChainMarket {
  status: OnChainMarketStatus
  outcome: boolean | null
  totalYes: bigint
  totalNo: bigint
  locksAt: number
  settleAfter: number
  lockedAt: number | null
  settledAt: number | null
}

// Anchor decodes a Rust enum to `{ open: {} }` / `{ settled: {} }` — turn that
// into the "Open"/"Settled" label the UI renders. Shared with the positions
// page, which decodes many Market accounts in one batch.
export function decodeStatus(
  raw: Record<string, unknown>
): OnChainMarketStatus {
  const key = Object.keys(raw)[0] ?? "open"
  return (key.charAt(0).toUpperCase() + key.slice(1)) as OnChainMarketStatus
}

// Polls live on-chain Market state (pool sizes, lock/settle status, outcome)
// so the UI reflects the program's source of truth rather than only the
// TxLINE reference odds mirrored into Postgres.
const POLL_INTERVAL_MS = 10_000

export function useMarketAccount(marketPda: string | null | undefined) {
  const { program } = useGoalanaProgram()
  const [market, setMarket] = useState<OnChainMarket | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const loadMarket = useCallback(
    async ({ cancelled }: { cancelled: () => boolean }) => {
      if (!marketPda) {
        setLoading(false)
        return
      }

      try {
        const account = await program.account.market.fetch(
          new PublicKey(marketPda)
        )

        if (cancelled()) return

        setMarket({
          status: decodeStatus(
            account.status as unknown as Record<string, unknown>
          ),
          outcome: (account.outcome as boolean | null) ?? null,
          totalYes: BigInt(account.totalYes.toString()),
          totalNo: BigInt(account.totalNo.toString()),
          locksAt: Number(account.locksAt),
          settleAfter: Number(account.settleAfter),
          lockedAt: account.lockedAt !== null ? Number(account.lockedAt) : null,
          settledAt:
            account.settledAt !== null ? Number(account.settledAt) : null,
        })
        setError(null)
      } catch (err) {
        if (cancelled()) return
        console.error("useMarketAccount: failed to fetch market account", err)
        setError("Failed to read on-chain market state")
      } finally {
        if (!cancelled()) {
          setLoading(false)
        }
      }
    },
    [program, marketPda]
  )

  const refetch = useCallback(() => {
    void loadMarket({ cancelled: () => false })
  }, [loadMarket])

  useSmartPolling(loadMarket, POLL_INTERVAL_MS, [loadMarket])

  return { market, loading, error, refetch }
}
