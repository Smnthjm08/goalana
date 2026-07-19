"use client"

import { useState } from "react"
import { useWallet } from "@solana/wallet-adapter-react"
import { useWalletModal } from "@solana/wallet-adapter-react-ui"
import { toast } from "sonner"
import { Button } from "@workspace/ui/components/button"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@workspace/ui/components/dropdown-menu"
import { Check, Copy, LogOut } from "lucide-react"
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
  const [copied, setCopied] = useState(false)

  if (!publicKey) {
    return (
      <Button
        onClick={() => setVisible(true)}
        className="h-9 rounded-sm border border-primary bg-background px-4 font-heading text-xs font-bold tracking-widest text-primary uppercase transition-all hover:bg-primary hover:text-primary-foreground hover:shadow-[0_0_15px_rgba(192,248,48,0.4)]"
      >
        Connect <span className="hidden sm:inline">Terminal</span>
      </Button>
    )
  }

  const base58 = publicKey.toBase58()
  const shortAddress = `${base58.slice(0, 4)}...${base58.slice(-4)}`
  const hue = avatarHue(base58)

  function copyAddress() {
    navigator.clipboard.writeText(base58)
    setCopied(true)
    toast.success("Address copied", { description: shortAddress })
    setTimeout(() => setCopied(false), 1500)
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="flex h-9 items-center gap-2 rounded-sm border-border bg-card px-3 font-mono text-xs text-foreground hover:border-primary hover:bg-card"
        >
          <div
            className="h-4 w-4 shrink-0 rounded-full border border-black/10"
            style={{
              background: `linear-gradient(135deg, hsl(${hue} 85% 55%), hsl(${(hue + 60) % 360} 85% 45%))`,
            }}
          />
          {shortAddress}
          {registering && (
            <div className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
          )}
        </Button>
      </DropdownMenuTrigger>

      <DropdownMenuContent align="end" className="w-48 rounded-sm">
        <DropdownMenuLabel className="font-mono text-[10px] tracking-widest uppercase">
          Connected wallet
        </DropdownMenuLabel>
        <DropdownMenuSeparator />
        <DropdownMenuItem
          onSelect={(e) => {
            e.preventDefault()
            copyAddress()
          }}
          className="font-medium"
        >
          {copied ? <Check className="text-primary" /> : <Copy />}
          {copied ? "Copied" : "Copy address"}
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={() => disconnect()}>
          <LogOut />
          Disconnect
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}
