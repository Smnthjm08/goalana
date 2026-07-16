"use client"

import { useState, useRef, useEffect } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { useWalletModal } from "@solana/wallet-adapter-react-ui"
import { Button } from "@workspace/ui/components/button"
import { Copy, LogOut } from "lucide-react"
import { useWalletUser } from "@/components/providers/wallet-user-provider"

// Deterministic avatar color from the wallet address so the same wallet
// always renders the same identity marker without needing an image host.
function avatarHue(address: string): number {
  let hash = 0
  for (let i = 0; i < address.length; i++) {
    hash = (hash * 31 + address.charCodeAt(i)) >>> 0
  }
  return hash % 360
}

export function CustomWalletButton() {
  const { publicKey, disconnect } = useWallet()
  const { setVisible } = useWalletModal()
  const { registering } = useWalletUser()
  const [dropdownOpen, setDropdownOpen] = useState(false)
  const dropdownRef = useRef<HTMLDivElement>(null)

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false)
      }
    }
    document.addEventListener("mousedown", handleClickOutside)
    return () => document.removeEventListener("mousedown", handleClickOutside)
  }, [])

  if (!publicKey) {
    return (
      <Button 
        onClick={() => setVisible(true)}
        className="h-9 rounded-sm border border-primary bg-background px-4 font-heading text-xs font-bold uppercase tracking-widest text-primary transition-all hover:bg-primary hover:text-primary-foreground hover:shadow-[0_0_15px_rgba(192,248,48,0.4)]"
      >
        Connect Terminal
      </Button>
    )
  }

  const base58 = publicKey.toBase58()
  const shortAddress = `${base58.slice(0, 4)}...${base58.slice(-4)}`
  const hue = avatarHue(base58)

  return (
    <div className="relative" ref={dropdownRef}>
      <Button
        onClick={() => setDropdownOpen(!dropdownOpen)}
        variant="outline"
        className="flex h-9 items-center gap-2 rounded-sm border-border bg-card px-3 font-mono text-xs text-foreground hover:border-primary hover:bg-card"
      >
        <div
          className="h-4 w-4 shrink-0 rounded-full border border-black/10"
          style={{ background: `linear-gradient(135deg, hsl(${hue} 85% 55%), hsl(${(hue + 60) % 360} 85% 45%))` }}
        />
        {shortAddress}
        {registering && <div className="h-1.5 w-1.5 rounded-full bg-primary animate-pulse" />}
      </Button>

      {dropdownOpen && (
        <div className="absolute right-0 mt-2 w-48 rounded-sm border border-border bg-card p-1 shadow-lg z-50">
          <button
            onClick={() => {
              navigator.clipboard.writeText(base58)
              setDropdownOpen(false)
            }}
            className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-xs font-medium text-foreground transition-colors hover:bg-muted"
          >
            <Copy className="h-3 w-3" />
            Copy Address
          </button>
          <button
            onClick={() => {
              disconnect()
              setDropdownOpen(false)
            }}
            className="flex w-full items-center gap-2 rounded-sm px-3 py-2 text-left text-xs font-medium text-destructive transition-colors hover:bg-muted"
          >
            <LogOut className="h-3 w-3" />
            Disconnect
          </button>
        </div>
      )}
    </div>
  )
}
