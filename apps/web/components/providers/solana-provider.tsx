"use client"

import React, { FC, ReactNode, useMemo } from "react"
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react"
import { WalletAdapterNetwork } from "@solana/wallet-adapter-base"
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui"
import { clusterApiUrl } from "@solana/web3.js"
import "@solana/wallet-adapter-react-ui/styles.css"

interface SolanaProviderProps {
  children: ReactNode
}

export const SolanaProvider: FC<SolanaProviderProps> = ({ children }) => {
  // The network can be set to 'devnet', 'testnet', or 'mainnet'
  const network = WalletAdapterNetwork.Devnet

  // The public cluster RPC (api.devnet.solana.com) is shared and rate
  // limited — under load it can drop/delay confirmations enough that a
  // transaction lands successfully on-chain while the client-side
  // `.rpc()` call still throws a confirmation timeout, surfacing as a
  // false "Bet failed" toast. Set NEXT_PUBLIC_SOLANA_RPC_URL to a
  // dedicated devnet RPC provider (Helius, QuickNode, etc.) to avoid
  // this in production; falls back to the public endpoint otherwise.
  const endpoint = useMemo(
    () => process.env.NEXT_PUBLIC_SOLANA_RPC_URL || clusterApiUrl(network),
    [network]
  )

  return (
    <ConnectionProvider endpoint={endpoint}>
      <WalletProvider wallets={[]} autoConnect>
        <WalletModalProvider>{children}</WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  )
}
