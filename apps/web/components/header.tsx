"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import { usePathname } from "next/navigation"
import { CustomWalletButton } from "./wallet-button"
import { ModeToggle } from "./mode-toggle"
import { TxlineHealthIndicator } from "./txline-health-indicator"
import { Menu, X } from "lucide-react"

const NAV_LINKS = [
  { href: "/", label: "Home" },
  { href: "/fixtures", label: "Fixtures" },
  { href: "/liquidity", label: "Liquidity" },
  { href: "/proofs", label: "Proofs" },
  { href: "/positions", label: "My Positions" },
  { href: "/inspector", label: "Inspector" },
]

export function Header() {
  const pathname = usePathname()
  const [isOpen, setIsOpen] = useState(false)

  // Disable scroll when mobile menu is open
  useEffect(() => {
    if (isOpen) {
      document.body.style.overflow = "hidden"
    } else {
      document.body.style.overflow = ""
    }
    return () => {
      document.body.style.overflow = ""
    }
  }, [isOpen])

  // Close mobile menu when navigating
  useEffect(() => {
    setIsOpen(false)
  }, [pathname])

  return (
    <header className="sticky top-0 z-50 w-full border-b border-border bg-background/95 backdrop-blur supports-backdrop-filter:bg-background/60">
      <div className="flex h-16 items-center justify-between gap-4 px-4 md:px-6">
        {/* Left: Logo and Product Name */}
        <div className="flex min-w-0 items-center gap-4 md:gap-6">
          <Link
            href="/"
            className="flex items-center gap-3 transition-opacity hover:opacity-80"
          >
            {/* Minimal Logo: The Electric Turf Square */}
            <div className="flex h-5 w-5 shrink-0 items-center justify-center bg-primary">
              <div className="h-2 w-2 bg-background" />
            </div>
            {/* The mark stands alone on mobile so the nav stays reachable. */}
            <span className="hidden font-heading text-xl font-bold tracking-widest text-foreground uppercase sm:inline">
              Goalana
            </span>
          </Link>

          {/* Desktop Navigation Links */}
          <nav className="hidden items-center gap-4 md:flex md:gap-5">
            {NAV_LINKS.map((link) => {
              const active =
                link.href === "/"
                  ? pathname === "/"
                  : link.href === "/fixtures"
                    ? pathname.startsWith("/fixtures") || pathname.startsWith("/market")
                    : pathname.startsWith(link.href)

              return (
                <Link
                  key={link.href}
                  href={link.href}
                  className={`relative font-mono text-[10px] tracking-widest whitespace-nowrap uppercase transition-colors md:text-[11px] py-1 ${
                    active
                      ? "text-primary border-b-2 border-primary"
                      : "text-muted-foreground hover:text-foreground border-b-2 border-transparent hover:border-border"
                  }`}
                >
                  {link.label}
                </Link>
              )
            })}
          </nav>
        </div>

        {/* Right Actions */}
        <div className="flex items-center gap-3">
          {/* Desktop Only Actions */}
          <div className="hidden items-center gap-3 md:flex">
            <TxlineHealthIndicator />
            <ModeToggle />
          </div>

          {/* Wallet Button - Always visible on all screen sizes */}
          <CustomWalletButton />

          {/* Mobile Menu Toggle Button */}
          <button
            type="button"
            onClick={() => setIsOpen(!isOpen)}
            className="flex h-9 w-9 items-center justify-center rounded-sm border border-border bg-card transition-colors hover:border-primary/50 md:hidden"
            aria-label={isOpen ? "Close Menu" : "Open Menu"}
          >
            {isOpen ? <X className="h-4 w-4" /> : <Menu className="h-4 w-4" />}
          </button>
        </div>
      </div>

      {/* Mobile Drawer/Menu Overlay */}
      {isOpen && (
        <div className="fixed inset-x-0 top-16 bottom-0 z-40 flex animate-in flex-col border-b border-border bg-background/95 p-0 backdrop-blur-md duration-200 fade-in slide-in-from-top-4 md:hidden">
          <div className="flex-1 overflow-y-auto">
            <nav className="flex flex-col">
              {NAV_LINKS.map((link) => {
                const active =
                  link.href === "/"
                    ? pathname === "/"
                    : link.href === "/fixtures"
                      ? pathname.startsWith("/fixtures") || pathname.startsWith("/market")
                      : pathname.startsWith(link.href)

                return (
                  <Link
                    key={link.href}
                    href={link.href}
                    className={`flex items-center justify-between border-b border-border/40 px-6 py-5 font-mono text-xs tracking-widest uppercase transition-colors ${
                      active
                        ? "bg-primary/5 text-primary"
                        : "text-muted-foreground hover:bg-muted/40 hover:text-foreground"
                    }`}
                  >
                    <span>{link.label}</span>
                    {active && (
                      <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-primary" />
                    )}
                  </Link>
                )
              })}
            </nav>
          </div>

          {/* Drawer Footer Actions */}
          <div className="flex flex-col gap-4 border-t border-border/40 bg-muted/10 p-6">
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                Live Feed
              </span>
              <TxlineHealthIndicator />
            </div>
            <div className="flex items-center justify-between">
              <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                Theme
              </span>
              <ModeToggle />
            </div>
          </div>
        </div>
      )}
    </header>
  )
}
