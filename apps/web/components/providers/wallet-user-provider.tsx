"use client"

import {
  createContext,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { toast } from "sonner"
import axiosInstance from "@/lib/axios-instance"

export interface WalletUser {
  id: string
  walletAddress: string
  displayName: string | null
  totalWagered: string
  totalWon: string
  createdAt: string
  lastActiveAt: string | null
}

interface WalletUserContextValue {
  user: WalletUser | null
  isNewUser: boolean
  registering: boolean
}

const WalletUserContext = createContext<WalletUserContextValue>({
  user: null,
  isNewUser: false,
  registering: false,
})

export function useWalletUser() {
  return useContext(WalletUserContext)
}

// Wallet address is Goalana's only identity — no email/password. Every time
// a wallet connects (fresh connect, autoConnect on reload, or switching to a
// different wallet), this registers/recognizes it against the backend's
// User table so downstream flows (position/pool display, future account
// pages) have a Goalana user to attach to.
export function WalletUserProvider({ children }: { children: ReactNode }) {
  const { publicKey, connected } = useWallet()
  const [user, setUser] = useState<WalletUser | null>(null)
  const [isNewUser, setIsNewUser] = useState(false)
  const [registering, setRegistering] = useState(false)
  const registeredForRef = useRef<string | null>(null)

  useEffect(() => {
    if (!connected || !publicKey) {
      registeredForRef.current = null
      setUser(null)
      setIsNewUser(false)
      return
    }

    const walletAddress = publicKey.toBase58()
    if (registeredForRef.current === walletAddress) return
    registeredForRef.current = walletAddress

    let cancelled = false
    setRegistering(true)

    axiosInstance
      .post("/users/connect", { walletAddress })
      .then((res) => {
        if (cancelled) return
        const data = res.data?.data
        if (!data) return

        setUser(data.user)
        setIsNewUser(Boolean(data.isNewUser))

        if (data.isNewUser) {
          toast.success("Wallet registered", {
            description: "New Goalana account created for this wallet.",
          })
        } else {
          toast.success("Wallet recognized", {
            description: `Welcome back, ${walletAddress.slice(0, 4)}…${walletAddress.slice(-4)}`,
          })
        }
      })
      .catch((err) => {
        if (cancelled) return
        console.error("Wallet registration failed", err)
        registeredForRef.current = null
        toast.error("Couldn't register wallet", {
          description:
            "You can still browse, but account features may not work.",
        })
      })
      .finally(() => {
        if (!cancelled) setRegistering(false)
      })

    return () => {
      cancelled = true
    }
  }, [connected, publicKey])

  return (
    <WalletUserContext.Provider value={{ user, isNewUser, registering }}>
      {children}
    </WalletUserContext.Provider>
  )
}
