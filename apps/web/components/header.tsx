"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import { CustomWalletButton } from "./wallet-button"

import { ModeToggle } from "./mode-toggle"
import { TxlineHealthIndicator } from "./txline-health-indicator"

const NAV_LINKS = [
  { href: "/", label: "Markets" },
  { href: "/positions", label: "My Positions" },
]

export function Header() {
  const pathname = usePathname()

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="flex h-16 items-center justify-between gap-4 px-4 md:px-6">
        {/* Left: Logo and Product Name */}
        <div className="flex min-w-0 items-center gap-4 md:gap-6">
          <Link href="/" className="flex items-center gap-3 transition-opacity hover:opacity-80">
            {/* Minimal Logo: The Electric Turf Square */}
            <div className="flex h-5 w-5 shrink-0 items-center justify-center bg-primary">
              <div className="h-2 w-2 bg-background" />
            </div>
            {/* The mark stands alone on mobile so the nav stays reachable. */}
            <span className="hidden font-heading text-xl font-bold tracking-widest text-foreground uppercase sm:inline">
              Goalana
            </span>
          </Link>

          <nav className="flex items-center gap-4 md:gap-5">
            {NAV_LINKS.map((link) => {
              const active =
                link.href === "/" ? pathname === "/" : pathname.startsWith(link.href)

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`whitespace-nowrap font-mono text-[10px] uppercase tracking-widest transition-colors md:text-[11px] ${
                    active ? "text-primary" : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Right: Feed status / Actions / Wallet */}
        <div className="flex items-center gap-3">
          <TxlineHealthIndicator />
          <ModeToggle />
          <CustomWalletButton />
        </div>
      </div>
    </header>
  )
}
