import type { Metadata, Viewport } from "next"
import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google"

import "@workspace/ui/globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@workspace/ui/lib/utils"
import { Toaster } from "@workspace/ui/components/sonner"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import { SolanaProvider } from "@/components/providers/solana-provider"
import { WalletUserProvider } from "@/components/providers/wallet-user-provider"
import { Header } from "@/components/header"
import { JudgingWindowBanner } from "@/components/judging-window-banner"
import { BetSlipProvider } from "@/components/bet-slip/bet-slip-context"
import { BetSlipDrawer } from "@/components/bet-slip/bet-slip-drawer"
import { getSiteUrl } from "@/lib/site"

const SITE_DESCRIPTION =
  "On-chain pari-mutuel prediction markets for live football, settled by verifiable TxLINE oracle proofs."

export const metadata: Metadata = {
  metadataBase: new URL(getSiteUrl()),
  title: {
    default: "Goalana — On-Chain Football Markets",
    template: "%s · Goalana",
  },
  description: SITE_DESCRIPTION,
  openGraph: {
    type: "website",
    siteName: "Goalana",
    title: "Goalana — On-Chain Football Markets",
    description: SITE_DESCRIPTION,
  },
  twitter: {
    card: "summary_large_image",
    title: "Goalana — On-Chain Football Markets",
    description: SITE_DESCRIPTION,
  },
}

export const viewport: Viewport = {
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#ffffff" },
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
  ],
}

const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })
const spaceGrotesk = Space_Grotesk({
  subsets: ["latin"],
  variable: "--font-heading",
})
const jetBrainsMono = JetBrains_Mono({
  subsets: ["latin"],
  variable: "--font-mono",
})

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html
      lang="en"
      suppressHydrationWarning
      suppressContentEditableWarning
      className={cn(
        "antialiased",
        inter.variable,
        spaceGrotesk.variable,
        jetBrainsMono.variable,
        "font-sans"
      )}
    >
      <body>
        <ThemeProvider>
          <TooltipProvider>
            <SolanaProvider>
              <WalletUserProvider>
                <BetSlipProvider>
                  <div className="relative flex min-h-svh flex-col">
                    <Header />
                    <JudgingWindowBanner />
                    <main className="flex-1">{children}</main>
                  </div>
                  <BetSlipDrawer />
                </BetSlipProvider>
              </WalletUserProvider>
            </SolanaProvider>
          </TooltipProvider>
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  )
}
