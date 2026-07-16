import { Inter, Space_Grotesk, JetBrains_Mono } from "next/font/google"

import "@workspace/ui/globals.css"
import { ThemeProvider } from "@/components/theme-provider"
import { cn } from "@workspace/ui/lib/utils"
import { Toaster } from "@workspace/ui/components/sonner"
import { TooltipProvider } from "@workspace/ui/components/tooltip"
import { SolanaProvider } from "@/components/providers/solana-provider"
import { WalletUserProvider } from "@/components/providers/wallet-user-provider"
import { Header } from "@/components/header"
const inter = Inter({ subsets: ["latin"], variable: "--font-sans" })
const spaceGrotesk = Space_Grotesk({ subsets: ["latin"], variable: "--font-heading" })
const jetBrainsMono = JetBrains_Mono({ subsets: ["latin"], variable: "--font-mono" })

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
                <div className="relative flex min-h-svh flex-col">
                  <Header />
                  <main className="flex-1">{children}</main>
                </div>
              </WalletUserProvider>
            </SolanaProvider>
          </TooltipProvider>
        </ThemeProvider>
        <Toaster />
      </body>
    </html>
  )
}
