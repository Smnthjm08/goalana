"use client"

// ─── Bet Slip — atomic multi-bet (final-features.md #2) ──────────────────────
// Holds a slate of intended bets across different markets and submits them as a
// SINGLE Solana transaction signed ONCE. place_bet's accounts are fully
// self-contained per market (market/vault/position all derive from market.key()
// with no cross-market state), so N place_bet instructions compose into one tx
// with no ordering constraints. Zero program change — pure client composition.
//
// Legacy transactions cap at 1232 bytes; each place_bet leg adds ~3 accounts, so
// the slip is capped conservatively at MAX_SLIP_LEGS to stay well inside a
// single legacy tx (no address-lookup-table path needed at this size).

import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react"

export const MAX_SLIP_LEGS = 6

export type SlipSide = "YES" | "NO"

export interface SlipItem {
  marketPda: string
  question: string
  side: SlipSide
  // Stake in lamports (fixed for challenge pools, user-chosen otherwise).
  lamports: number
  // Locked stake (challenge pools) can't be edited in the slip.
  fixedStake: boolean
}

interface BetSlipContextValue {
  items: SlipItem[]
  addItem: (item: SlipItem) => void
  removeItem: (marketPda: string) => void
  updateAmount: (marketPda: string, lamports: number) => void
  clear: () => void
  has: (marketPda: string) => boolean
  totalLamports: number
}

const BetSlipContext = createContext<BetSlipContextValue | null>(null)

export function BetSlipProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<SlipItem[]>([])

  const addItem = useCallback((item: SlipItem) => {
    setItems((prev) => {
      // One leg per market — re-adding the same market replaces its side/amount.
      const withoutDupe = prev.filter((i) => i.marketPda !== item.marketPda)
      if (withoutDupe.length >= MAX_SLIP_LEGS) return prev
      return [...withoutDupe, item]
    })
  }, [])

  const removeItem = useCallback((marketPda: string) => {
    setItems((prev) => prev.filter((i) => i.marketPda !== marketPda))
  }, [])

  const updateAmount = useCallback((marketPda: string, lamports: number) => {
    setItems((prev) =>
      prev.map((i) => (i.marketPda === marketPda ? { ...i, lamports } : i))
    )
  }, [])

  const clear = useCallback(() => setItems([]), [])

  const has = useCallback(
    (marketPda: string) => items.some((i) => i.marketPda === marketPda),
    [items]
  )

  const totalLamports = useMemo(
    () => items.reduce((sum, i) => sum + (i.lamports || 0), 0),
    [items]
  )

  const value = useMemo(
    () => ({ items, addItem, removeItem, updateAmount, clear, has, totalLamports }),
    [items, addItem, removeItem, updateAmount, clear, has, totalLamports]
  )

  return <BetSlipContext.Provider value={value}>{children}</BetSlipContext.Provider>
}

export function useBetSlip() {
  const ctx = useContext(BetSlipContext)
  if (!ctx) throw new Error("useBetSlip must be used within a BetSlipProvider")
  return ctx
}
