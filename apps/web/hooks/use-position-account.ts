"use client"

import { useCallback, useEffect, useState } from "react"
import { PublicKey } from "@solana/web3.js"
import { getPositionPda } from "@workspace/goalana-sdk/pdas"
import { useGoalanaProgram } from "./use-goalana-program"

export interface UserPosition {
  yesAmount: bigint
  noAmount: bigint
  claimed: boolean
}

// Reads the connected wallet's Position PDA for a given Market — used both
// to show "you have X SOL on YES/NO" right after betting (Phase 1) and to
// drive the claimable-positions list once markets start settling (Phase 3).
export function usePositionAccount(marketPda: string | null | undefined) {
  const { program, publicKey } = useGoalanaProgram()
  const [position, setPosition] = useState<UserPosition | null>(null)
  const [loading, setLoading] = useState(true)

  const refetch = useCallback(async () => {
    if (!marketPda || !publicKey) {
      setPosition(null)
      setLoading(false)
      return
    }

    try {
      const marketPubkey = new PublicKey(marketPda)
      const [positionPda] = getPositionPda(marketPubkey, publicKey)
      const account = await program.account.position.fetch(positionPda)

      setPosition({
        yesAmount: BigInt(account.yesAmount.toString()),
        noAmount: BigInt(account.noAmount.toString()),
        claimed: Boolean(account.claimed),
      })
    } catch {
      // Position PDA doesn't exist yet — the user hasn't bet on this market.
      setPosition(null)
    } finally {
      setLoading(false)
    }
  }, [program, marketPda, publicKey])

  useEffect(() => {
    setLoading(true)
    void refetch()
  }, [refetch])

  return { position, loading, refetch }
}
