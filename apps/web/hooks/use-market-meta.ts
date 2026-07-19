"use client"

import { useCallback, useState } from "react"
import axiosInstance from "@/lib/axios-instance"
import type { MarketMeta } from "@/lib/position-status"
import { useSmartPolling } from "./use-smart-polling"

/**
 * Full off-chain Market row from GET /api/markets/:marketPda — MarketMeta
 * plus the fields only a single-market read needs (pricing/lifecycle detail
 * the flat /api/markets list trims to keep the wallet-positions join light).
 */
export interface MarketDetail extends MarketMeta {
  marketType: string
  status: string
  initialYesPct: number | null
  initialNoPct: number | null
  currentYesPct: number | null
  currentNoPct: number | null
  oracleTsMs: string | null
  settlementProof: unknown
  createdAt: string
  lockedAt: string | null
  settledAt: string | null
}

const POLL_INTERVAL_MS = 8_000

/** Live off-chain market metadata for a single market, polled like the fixture page. */
export function useMarketMeta(marketPda: string | null | undefined) {
  const [market, setMarket] = useState<MarketDetail | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const loadMarket = useCallback(
    async ({ cancelled }: { cancelled: () => boolean }) => {
      if (!marketPda) {
        setLoading(false)
        return
      }

      try {
        const res = await axiosInstance.get(`/markets/${marketPda}`)
        if (cancelled()) return
        if (res.data?.data) {
          setMarket(res.data.data)
          setNotFound(false)
          setError(null)
        }
      } catch (err: any) {
        if (err?.response?.status === 404) {
          setMarket(null)
          setNotFound(true)
          setError(null)
        } else {
          console.error("useMarketMeta: failed to load market", err)
          setError("Live update failed — showing last known data")
        }
      } finally {
        if (!cancelled()) {
          setLoading(false)
        }
      }
    },
    [marketPda]
  )

  const refetch = useCallback(() => {
    void loadMarket({ cancelled: () => false })
  }, [loadMarket])

  useSmartPolling(loadMarket, POLL_INTERVAL_MS, [loadMarket])

  return { market, loading, notFound, error, refetch }
}
