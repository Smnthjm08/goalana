import type { OnChainMarket } from "@/hooks/use-market-account"

/** Off-chain market metadata (question, fixture, lifecycle txs) from GET /api/markets[/:marketPda]. */
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

/**
 * Derives a position's actionable status/payout from on-chain Market state —
 * shared by every surface that reads a Position account (the wallet's own
 * list, and a single shared position looked up by PDA), so the pari-mutuel
 * math lives in exactly one place.
 */
export function derivePositionStatus(
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
    return {
      status: staked > 0n ? "Claimable" : "Settled",
      payout: staked,
      isRefund: true,
    }
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

    const payout =
      (winningStake * (market.totalYes + market.totalNo)) / winningPool
    return { status: "Claimable", payout, isRefund: false }
  }

  if (market.status === "Locked") {
    return { status: "Locked", payout: null, isRefund: false }
  }

  return { status: "Open", payout: null, isRefund: false }
}
