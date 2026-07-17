"use client"

import { useMemo } from "react"
import { PublicKey } from "@solana/web3.js"
import { useConnection, useWallet } from "@solana/wallet-adapter-react"
import { AnchorProvider, type Wallet } from "@coral-xyz/anchor"
import { getGoalanaProgram } from "@workspace/goalana-sdk/client"

// Anchor's Program type needs a Provider even for read-only account fetches
// (program.account.market.fetch(...)). When no wallet is connected we hand
// it an identity that can never sign — reads work fine against it; only
// .rpc()/.transaction() calls would throw, and those are gated behind
// `connected` in the UI before they're ever invoked.
const READ_ONLY_WALLET: Wallet = {
  publicKey: PublicKey.default,
  signTransaction: async () => {
    throw new Error("Wallet not connected")
  },
  signAllTransactions: async () => {
    throw new Error("Wallet not connected")
  },
} as unknown as Wallet

export function useGoalanaProgram() {
  const { connection } = useConnection()
  const wallet = useWallet()

  const connected = Boolean(
    wallet.publicKey && wallet.signTransaction && wallet.signAllTransactions
  )

  const provider = useMemo(() => {
    if (
      connected &&
      wallet.publicKey &&
      wallet.signTransaction &&
      wallet.signAllTransactions
    ) {
      const signerWallet: Wallet = {
        publicKey: wallet.publicKey,
        signTransaction: wallet.signTransaction,
        signAllTransactions: wallet.signAllTransactions,
      } as unknown as Wallet

      return new AnchorProvider(connection, signerWallet, {
        commitment: "confirmed",
      })
    }

    return new AnchorProvider(connection, READ_ONLY_WALLET, {
      commitment: "confirmed",
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [
    connection,
    connected,
    wallet.publicKey,
    wallet.signTransaction,
    wallet.signAllTransactions,
  ])

  const program = useMemo(() => getGoalanaProgram(provider), [provider])

  return { program, provider, connected, publicKey: wallet.publicKey }
}
