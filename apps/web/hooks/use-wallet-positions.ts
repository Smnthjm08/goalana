"use client"

import { useCallback, useEffect, useState } from "react"
import { PublicKey } from "@solana/web3.js"
import axiosInstance from "@/lib/axios-instance"
import { useGoalanaProgram } from "./use-goalana-program"
import { decodeStatus, type OnChainMarket } from "./use-market-account"

// Position layout: 8 (discriminator) + 32 (market: Pubkey) = 40 → `user`.
// See goalana_program/src/state/position.rs. Lets the RPC filter positions
// wallet-side instead of downloading every Position account.
const POSITION_USER_OFFSET = 40

/** Off-chain market metadata (question, fixture, lifecycle txs) from GET /api/markets. */
export interface MarketMeta {
  marketPda: string
  marketType: string
  question: string
  locksAt: string
  settleAfter: string
  creationTx: string | null
  lockTx: string | null
  settlementTx: string | null
  fixture: {
    fixtureId: string
    competition: string
    participant1: string
    participant2: string
    startTime: string
  }
}

/**
 * What the wallet can do with this position right now.
 * `Claimable` covers both a winning settled market and a refundable one
 * (cancelled, or settled with an empty winning pool) — in both cases the
 * money is sitting in the vault waiting for the user to pull it.
 */
export type PositionStatus = "Open" | "Locked" | "Settled" | "Claimable" | "Claimed"

export interface WalletPosition {
  positionPda: string
  marketPda: string
  yesAmount: bigint
  noAmount: bigint
  claimed: boolean
  /** On-chain Market account — null if the account could not be read. */
  market: OnChainMarket | null
  /** Off-chain metadata — null for markets not in this deployment's DB. */
  meta: MarketMeta | null
  status: PositionStatus
  /** Whether a claim would be a refund rather than winnings. */
  isRefund: boolean
  /**
   * Pari-mutuel payout for the winning stake, in lamports. Non-null once the
   * market has settled and this wallet had stake on the winning side (mirrors
   * the math in claim_winnings.rs). Null while the outcome is undecided.
   */
  payout: bigint | null
  /** Signature that opened this position (oldest tx touching the Position PDA). */
  betTx: string | null
  /** Signature that claimed it (newest tx, only once `claimed`). */
  claimTx: string | null
}

function derive(
  yesAmount: bigint,
  noAmount: bigint,
  claimed: boolean,
  market: OnChainMarket | null
): { status: PositionStatus; payout: bigint | null; isRefund: boolean } {
  if (claimed) {
    return { status: "Claimed", payout: null, isRefund: false }
  }

  if (!market) {
    return { status: "Open", payout: null, isRefund: false }
  }

  if (market.status === "Cancelled") {
    const staked = yesAmount + noAmount
    return { status: staked > 0n ? "Claimable" : "Settled", payout: staked, isRefund: true }
  }

  if (market.status === "Settled" && market.outcome !== null) {
    const winningStake = market.outcome ? yesAmount : noAmount
    const winningPool = market.outcome ? market.totalYes : market.totalNo

    if (winningStake === 0n) {
      // Lost — nothing to pull, so this is terminal, not "Claimable".
      return { status: "Settled", payout: 0n, isRefund: false }
    }

    // An empty winning pool can't be divided by; claim_refund.rs handles it.
    if (winningPool === 0n) {
      return { status: "Claimable", payout: winningStake, isRefund: true }
    }

    const payout = (winningStake * (market.totalYes + market.totalNo)) / winningPool
    return { status: "Claimable", payout, isRefund: false }
  }

  if (market.status === "Locked") {
    return { status: "Locked", payout: null, isRefund: false }
  }

  return { status: "Open", payout: null, isRefund: false }
}

/**
 * Every Position PDA owned by the connected wallet, joined with its on-chain
 * Market state and off-chain metadata.
 *
 * On-chain is the source of truth for anything that decides money (stake,
 * claimed, status, outcome, pools); the API only supplies labels and the
 * protocol's own lifecycle tx signatures.
 */
export function useWalletPositions() {
  const { program, publicKey } = useGoalanaProgram()
  const [positions, setPositions] = useState<WalletPosition[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!publicKey) {
      setPositions([])
      setError(null)
      setLoading(false)
      return
    }

    try {
      const raw = await program.account.position.all([
        { memcmp: { offset: POSITION_USER_OFFSET, bytes: publicKey.toBase58() } },
      ])

      if (raw.length === 0) {
        setPositions([])
        setError(null)
        return
      }

      const marketKeys = raw.map((entry) => entry.account.market as PublicKey)

      // Metadata and the Position PDAs' signature histories are both
      // best-effort: neither is allowed to break the page, because the
      // on-chain position itself is what the user came to see.
      const [marketAccounts, metaByPda, signatures] = await Promise.all([
        program.account.market.fetchMultiple(marketKeys),
        axiosInstance
          .get("/markets")
          .then((res) => {
            const list: MarketMeta[] = res.data?.data ?? []
            return new Map(list.map((m) => [m.marketPda, m]))
          })
          .catch(() => new Map<string, MarketMeta>()),
        Promise.all(
          raw.map((entry) =>
            program.provider.connection
              .getSignaturesForAddress(entry.publicKey, { limit: 20 })
              .catch(() => [])
          )
        ),
      ])

      const next: WalletPosition[] = raw.map((entry, i) => {
        const account = marketAccounts[i]

        const market: OnChainMarket | null = account
          ? {
              status: decodeStatus(account.status as unknown as Record<string, unknown>),
              outcome: (account.outcome as boolean | null) ?? null,
              totalYes: BigInt(account.totalYes.toString()),
              totalNo: BigInt(account.totalNo.toString()),
              locksAt: Number(account.locksAt),
              settleAfter: Number(account.settleAfter),
              lockedAt: account.lockedAt !== null ? Number(account.lockedAt) : null,
              settledAt: account.settledAt !== null ? Number(account.settledAt) : null,
            }
          : null

        const yesAmount = BigInt(entry.account.yesAmount.toString())
        const noAmount = BigInt(entry.account.noAmount.toString())
        const claimed = Boolean(entry.account.claimed)

        const { status, payout, isRefund } = derive(yesAmount, noAmount, claimed, market)

        // Only place_bet / claim_* ever touch a Position PDA, and place_bet
        // creates it — so the oldest successful signature is the opening bet
        // and, once claimed, the newest is the claim.
        const ok = (signatures[i] ?? []).filter((s) => !s.err)
        const betTx = ok.length > 0 ? ok[ok.length - 1]!.signature : null
        const claimTx = claimed && ok.length > 1 ? ok[0]!.signature : null

        return {
          positionPda: entry.publicKey.toBase58(),
          marketPda: (entry.account.market as PublicKey).toBase58(),
          yesAmount,
          noAmount,
          claimed,
          market,
          meta: metaByPda.get((entry.account.market as PublicKey).toBase58()) ?? null,
          status,
          isRefund,
          payout,
          betTx,
          claimTx,
        }
      })

      // Actionable first (Claimable), then live markets, then history.
      const rank: Record<PositionStatus, number> = {
        Claimable: 0,
        Open: 1,
        Locked: 2,
        Settled: 3,
        Claimed: 4,
      }
      next.sort((a, b) => rank[a.status] - rank[b.status])

      setPositions(next)
      setError(null)
    } catch (err) {
      console.error("useWalletPositions: failed to load positions", err)
      setError("Failed to read your positions from the chain")
    } finally {
      setLoading(false)
    }
  }, [program, publicKey])

  useEffect(() => {
    setLoading(true)
    void refetch()
  }, [refetch])

  return { positions, loading, error, refetch }
}
