"use client"

import axiosInstance from "@/lib/axios-instance"
import dynamic from "next/dynamic"
const WalletMultiButton = dynamic(
  () =>
    import("@solana/wallet-adapter-react-ui").then(
      (mod) => mod.WalletMultiButton
    ),
  { ssr: false }
)
import { Button } from "@workspace/ui/components/button"
import {
  useWallet,
  useAnchorWallet,
  useConnection,
} from "@solana/wallet-adapter-react"

export default function Page() {
  const { connection } = useConnection()
  const wallet = useAnchorWallet()
  const { signMessage } = useWallet()

  return (
    <div className="flex min-h-svh p-6">
      <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
        <div>
          <h1 className="font-medium">Project ready!</h1>
          <p>You may now add components and start building.</p>
          <p>We've already added the button component for you.</p>
          <Button className="mt-2">Button</Button>
        </div>
        <div className="font-mono text-xs text-muted-foreground">
          (Press <kbd>d</kbd> to toggle dark mode)
        </div>

        <WalletMultiButton />
      </div>
    </div>
  )
}
