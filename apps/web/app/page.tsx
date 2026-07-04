"use client";

import axiosInstance from "@/lib/axios-instance"
import { Button } from "@workspace/ui/components/button"

export default function Page() {

  async function handleActivateTxline() {
    try {
      const data = await axiosInstance.post("/admin/txline/activate", { txSig: "dfdhfdn", walletSignature: "sfdfnjdkn", leagues: ["football", "soccer"] });
      console.log(">>>>", data);
    } catch (error) {
      console.log(">>>> error! ", error);
    }
  }

  return (
    <div className="flex min-h-svh p-6">
      <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
        <div>
          <h1 className="font-medium">Project ready!</h1>
          <p>You may now add components and start building.</p>
          <p>We&apos;ve already added the button component for you.</p>
          <Button className="mt-2">Button</Button>
        </div>
        <div className="text-muted-foreground font-mono text-xs">
          (Press <kbd>d</kbd> to toggle dark mode)
        </div>

        <Button onClick={handleActivateTxline}>
          Activate TxLine
        </Button>
      </div>
    </div>
  )
}
