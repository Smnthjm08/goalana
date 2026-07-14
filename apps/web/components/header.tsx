"use client"

import Link from "next/link"
import { CustomWalletButton } from "./wallet-button"

export function Header() {
  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="flex h-16 items-center justify-between px-4 md:px-6">
        {/* Left: Logo and Product Name */}
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
            {/* Minimal Logo: The Electric Turf Square */}
            <div className="flex h-5 w-5 items-center justify-center bg-primary">
              <div className="h-2 w-2 bg-background" />
            </div>
            <span className="font-heading text-xl font-bold tracking-widest text-foreground uppercase">
              Goalana
            </span>
          </Link>
        </div>

        {/* Right: Actions / Wallet */}
        <div className="flex items-center gap-4">
          <CustomWalletButton />
        </div>
      </div>
    </header>
  )
}
