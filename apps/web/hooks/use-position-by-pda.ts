"use client"

import { useCallback, useEffect, useState } from "react"
import { PublicKey } from "@solana/web3.js"
import { useGoalanaProgram } from "./use-goalana-program"

export interface PositionAccountData {
  marketPda: string
  user: string
  yesAmount: bigint
  noAmount: bigint
  claimed: boolean
}

/**
 * Reads a single Position account directly by its PDA — no wallet or
 * connected-user filter, since a Position PDA is a public account anyone can
 * read. This is what makes a bet slip shareable: the share link's only
 * identifier is the PDA itself.
 */
export function usePositionByPda(positionPda: string | null | undefined) {
  const { program } = useGoalanaProgram()
  const [account, setAccount] = useState<PositionAccountData | null>(null)
  const [betTx, setBetTx] = useState<string | null>(null)
  const [betTs, setBetTs] = useState<number | null>(null)
  const [claimTx, setClaimTx] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [notFound, setNotFound] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    if (!positionPda) {
      setLoading(false)
      return
    }

    let pk: PublicKey
    try {
      pk = new PublicKey(positionPda)
    } catch {
      setAccount(null)
      setNotFound(true)
      setLoading(false)
      return
    }

    try {
      const raw = await program.account.position.fetch(pk)

      setAccount({
        marketPda: (raw.market as PublicKey).toBase58(),
        user: (raw.user as PublicKey).toBase58(),
        yesAmount: BigInt(raw.yesAmount.toString()),
        noAmount: BigInt(raw.noAmount.toString()),
        claimed: Boolean(raw.claimed),
      })
      setNotFound(false)
      setError(null)

      // Only place_bet / claim_* ever touch a Position PDA, and place_bet
      // creates it — oldest ok signature is the opening bet, newest (once
      // claimed) is the claim. Best-effort: a signature-history miss doesn't
      // hide the position itself.
      const signatures = await program.provider.connection
        .getSignaturesForAddress(pk, { limit: 20 })
        .catch(() => [])
      const ok = signatures.filter((s) => !s.err)
      const bet = ok.length > 0 ? ok[ok.length - 1]! : null
      setBetTx(bet?.signature ?? null)
      setBetTs(bet?.blockTime ?? null)
      setClaimTx(raw.claimed && ok.length > 1 ? ok[0]!.signature : null)
    } catch (err) {
      // Anchor throws when the account doesn't exist on-chain.
      console.error("usePositionByPda: failed to fetch position", err)
      setAccount(null)
      setNotFound(true)
      setError(null)
    } finally {
      setLoading(false)
    }
  }, [program, positionPda])

  useEffect(() => {
    setLoading(true)
    void refetch()
  }, [refetch])

  return { account, betTx, betTs, claimTx, loading, notFound, error, refetch }
}
