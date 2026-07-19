"use client"

import { useState } from "react"
import axiosInstance from "@/lib/axios-instance"
import { useSmartPolling } from "@/hooks/use-smart-polling"

// v3-todo P2-3: TxLINE's free-tier access ends at the hackathon deadline, so
// during judging the live feed may go quiet or the health indicator may turn
// red. Without this banner that reads as "the app is broken" rather than
// "the demo data feed's access window closed" — everything already recorded
// (proofs, evidence txs, settled markets) stays fully inspectable either way.
const POLL_INTERVAL_MS = 30_000

interface HealthSnapshot {
  status: "UP" | "DEGRADED"
  txline: { connected: boolean }
}

export function JudgingWindowBanner() {
  const [degraded, setDegraded] = useState(false)

  useSmartPolling(
    async ({ cancelled }) => {
      try {
        const res = await axiosInstance.get("/health")
        if (cancelled()) return
        const snapshot = res.data?.data as HealthSnapshot | undefined
        setDegraded(!snapshot || !snapshot.txline.connected)
      } catch {
        if (cancelled()) return
        // Backend unreachable is itself the case this banner exists for.
        setDegraded(true)
      }
    },
    POLL_INTERVAL_MS,
    []
  )

  if (!degraded) return null

  return (
    <div className="w-full border-b border-amber-500/20 bg-amber-500/5 px-4 py-2 md:px-6">
      <p className="mx-auto max-w-5xl font-mono text-[10px] leading-relaxed text-amber-600 dark:text-amber-400">
        <span className="tracking-widest uppercase">Live feed offline —</span>{" "}
        TxLINE&apos;s free-tier access ends at the submission deadline, so the
        odds/scores stream may be quiet during judging. This is not a broken
        app: every proof, evidence transaction, and settled market shown here is
        persisted and fully inspectable.
      </p>
    </div>
  )
}
