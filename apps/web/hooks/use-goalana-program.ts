"use client"

import { useMemo, useRef } from "react"
import { PublicKey, Transaction, VersionedTransaction } from "@solana/web3.js"
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
  
  // Use a ref to hold the latest wallet functions so we don't need to put them
  // in the provider's dependency array, which would cause infinite loops in polling hooks.
  const walletRef = useRef(wallet)
  walletRef.current = wallet

  const connected = Boolean(
    wallet.publicKey && wallet.signTransaction && wallet.signAllTransactions
  )
  const publicKeyBase58 = wallet.publicKey?.toBase58()

  const provider = useMemo(() => {
    if (connected && publicKeyBase58) {
      const signerWallet: Wallet = {
        publicKey: new PublicKey(publicKeyBase58),
        signTransaction: <T extends Transaction | VersionedTransaction>(tx: T) => walletRef.current.signTransaction!(tx),
        signAllTransactions: <T extends Transaction | VersionedTransaction>(txs: T[]) => walletRef.current.signAllTransactions!(txs),
      } as unknown as Wallet

      return new AnchorProvider(connection, signerWallet, {
        commitment: "confirmed",
      })
    }

    return new AnchorProvider(connection, READ_ONLY_WALLET, {
      commitment: "confirmed",
    })
  }, [connection, connected, publicKeyBase58])

  const program = useMemo(() => getGoalanaProgram(provider), [provider])

  return { program, provider, connected, publicKey: wallet.publicKey }
}
