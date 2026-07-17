"use client"

import { IN_PROGRESS_STATUS_IDS } from "@/lib/match-status"

interface LiveScore {
  statusId: number | null
  isFinal: boolean
}

interface MarketLike {
  status: string
}

interface LifecycleStatusStripProps {
  liveScore: LiveScore | null | undefined
  markets: MarketLike[]
}

type Stage = "SCHEDULED" | "LIVE" | "FINISHED" | "SETTLED" | "CANCELLED"

const STEPS: Array<{ stage: Stage; label: string }> = [
  { stage: "SCHEDULED", label: "Scheduled" },
  { stage: "LIVE", label: "Live" },
  { stage: "FINISHED", label: "Finished" },
  { stage: "SETTLED", label: "Settled" },
]

function deriveStage(
  liveScore: LiveScore | null | undefined,
  markets: MarketLike[]
): Stage {
  if (markets.length > 0 && markets.every((m) => m.status === "CANCELLED")) {
    return "CANCELLED"
  }
  if (markets.some((m) => m.status === "SETTLED")) {
    return "SETTLED"
  }
  if (liveScore?.isFinal) {
    return "FINISHED"
  }
  const hasStarted =
    liveScore != null &&
    liveScore.statusId !== null &&
    IN_PROGRESS_STATUS_IDS.has(liveScore.statusId)
  return hasStarted ? "LIVE" : "SCHEDULED"
}

/**
 * Fixture-wide lifecycle summary — separate from each MarketCard's own
 * on-chain status badge (Open/Locked/Settled/Cancelled), which is the
 * authoritative per-market state. This strip answers "where is this match
 * overall," derived off Fixture.liveScore + the DB market-status mirror
 * (a fine source for a summary view; per-bet decisions still read on-chain).
 */
export function LifecycleStatusStrip({
  liveScore,
  markets,
}: LifecycleStatusStripProps) {
  const stage = deriveStage(liveScore, markets)

  if (stage === "CANCELLED") {
    return (
      <div className="flex items-center justify-center gap-2 rounded-sm border border-border bg-card py-2.5">
        <span className="font-mono text-[10px] tracking-widest text-destructive uppercase">
          [ Markets Cancelled — Refunds Available ]
        </span>
      </div>
    )
  }

  const currentIndex = STEPS.findIndex((s) => s.stage === stage)

  return (
    <div className="flex w-full items-center rounded-sm border border-border bg-card px-4 py-3">
      {STEPS.map((step, index) => {
        const isDone = index < currentIndex
        const isCurrent = index === currentIndex
        const isFuture = index > currentIndex

        return (
          <div
            key={step.stage}
            className="flex flex-1 items-center last:flex-none"
          >
            <div className="flex shrink-0 items-center gap-2">
              <span
                className={`relative flex h-2 w-2 shrink-0 rounded-full ${
                  isCurrent
                    ? "bg-primary"
                    : isDone
                      ? "bg-foreground"
                      : "bg-border"
                }`}
              >
                {isCurrent && (
                  <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
                )}
              </span>
              <span
                className={`font-mono text-[10px] tracking-widest uppercase ${
                  isCurrent
                    ? "text-primary"
                    : isDone
                      ? "text-foreground"
                      : isFuture
                        ? "text-muted-foreground"
                        : ""
                }`}
              >
                {step.label}
              </span>
            </div>
            {index < STEPS.length - 1 && (
              <div
                className={`mx-3 h-px flex-1 ${isDone ? "bg-foreground" : "bg-border"}`}
              />
            )}
          </div>
        )
      })}
    </div>
  )
}
