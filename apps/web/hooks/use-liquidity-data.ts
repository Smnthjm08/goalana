"use client"

import { useEffect, useState } from "react"
import { LAMPORTS_PER_SOL } from "@solana/web3.js"
import axiosInstance from "@/lib/axios-instance"
import { useGoalanaProgram } from "@/hooks/use-goalana-program"
import { decodeStatus, type OnChainMarketStatus } from "@/hooks/use-market-account"

// Same "batch-fetch all Market accounts, join against /api/markets" pattern
// use-inspector-data.ts already uses — one getProgramAccounts call instead of
// N per-market RPC reads, so a dashboard listing every market stays a single
// round trip regardless of how many markets exist.
const POLL_INTERVAL_MS = 15_000

interface DbMarket {
  id: string
  marketPda: string
  marketType: string
  question: string
  locksAt: string
  status: string
  initialYesPct: number | null
  initialNoPct: number | null
  currentYesPct: number | null
  currentNoPct: number | null
  fixedStakeLamports: string | null
  slotsPerSide: number | null
  fixture: {
    fixtureId: string
    competition: string
    participant1: string
    participant2: string
    startTime: string
  }
}

export interface LiquidityMarket {
  marketPda: string
  question: string
  marketType: string
  status: OnChainMarketStatus
  locksAt: string
  poolYes: number
  poolNo: number
  poolTotal: number
  poolYesPct: number | null
  referenceYesPct: number | null
  isChallenge: boolean
  fixture: DbMarket["fixture"]
}

async function loadLiquidityData(
  program: ReturnType<typeof useGoalanaProgram>["program"]
): Promise<LiquidityMarket[]> {
  const [marketEntries, dbMarkets] = await Promise.all([
    program.account.market.all(),
    axiosInstance
      .get("/markets")
      .then((res) => (res.data?.data ?? []) as DbMarket[]),
  ])

  const onChainByPda = new Map(
    marketEntries.map((entry) => [entry.publicKey.toBase58(), entry.account as unknown as Record<string, any>])
  )

  return dbMarkets
    .map((market): LiquidityMarket | null => {
      const onChain = onChainByPda.get(market.marketPda)
      if (!onChain) return null

      const totalYes = BigInt(onChain.totalYes.toString())
      const totalNo = BigInt(onChain.totalNo.toString())
      const poolYes = Number(totalYes) / LAMPORTS_PER_SOL
      const poolNo = Number(totalNo) / LAMPORTS_PER_SOL
      const poolTotal = poolYes + poolNo

      return {
        marketPda: market.marketPda,
        question: market.question,
        marketType: market.marketType,
        status: decodeStatus(onChain.status as Record<string, unknown>),
        locksAt: market.locksAt,
        poolYes,
        poolNo,
        poolTotal,
        poolYesPct: poolTotal > 0 ? (poolYes / poolTotal) * 100 : null,
        referenceYesPct: market.currentYesPct ?? market.initialYesPct,
        isChallenge: market.fixedStakeLamports != null,
        fixture: market.fixture,
      }
    })
    .filter((m): m is LiquidityMarket => m !== null)
}

/** Polls the same account.market.all() + /api/markets sources every other
 *  live view already reads, joined once per tick for the liquidity table. */
export function useLiquidityData() {
  const { program } = useGoalanaProgram()
  const [markets, setMarkets] = useState<LiquidityMarket[] | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false

    const fetchAll = () =>
      loadLiquidityData(program)
        .then((next) => {
          if (cancelled) return
          setMarkets(next)
          setError(null)
        })
        .catch((err) => {
          if (cancelled) return
          console.error("Liquidity dashboard: failed to load market data", err)
          setError("Could not load live pool data.")
        })

    fetchAll().finally(() => {
      if (!cancelled) setLoading(false)
    })

    const intervalId = setInterval(() => void fetchAll(), POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [program])

  return { markets, loading, error }
}
