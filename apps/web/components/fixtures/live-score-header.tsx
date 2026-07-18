"use client"

import { useNow } from "@/hooks/use-now"
import { IN_PROGRESS_STATUS_IDS } from "@/lib/match-status"
import { formatDuration, toMs } from "@/lib/time"

interface LiveScore {
  homeScore: number | null
  awayScore: number | null
  statusId: number | null
  periodLabel: string | null
  minuteLabel: string | null
  clockRunning: boolean | null
  isFinal: boolean
  lastUpdate: string | null
}

interface LiveScoreHeaderProps {
  liveScore: LiveScore | null | undefined
  kickoffLabel: string
  /** Kickoff (ms/s epoch) — drives the pre-match countdown. */
  startTime?: string | number | null
}

export function LiveScoreHeader({
  liveScore,
  kickoffLabel,
  startTime,
}: LiveScoreHeaderProps) {
  const now = useNow(1_000)
  const hasStarted = liveScore != null && liveScore.statusId !== null
  const isLive =
    hasStarted &&
    !liveScore!.isFinal &&
    IN_PROGRESS_STATUS_IDS.has(liveScore!.statusId!)

  if (!hasStarted) {
    const kickoffMs = toMs(startTime)
    const untilKickoff =
      kickoffMs !== null && now !== null ? kickoffMs - now : null

    return (
      <div className="flex flex-col items-center justify-center px-1 sm:px-4">
        <span className="mb-1 font-mono text-[10px] tracking-widest text-muted-foreground sm:mb-2 sm:text-sm md:text-base">
          VS
        </span>
        <span className="font-heading text-lg font-bold text-foreground sm:text-4xl md:text-5xl">
          UPCOMING
        </span>
        <span className="mt-2 text-center font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
          {kickoffLabel}
        </span>
        {untilKickoff !== null && (
          <span className="mt-1 text-center font-mono text-[10px] tracking-widest text-primary uppercase tabular-nums">
            {untilKickoff <= 0
              ? "Starting soon"
              : `Starts in ${formatDuration(untilKickoff)}`}
          </span>
        )}
      </div>
    )
  }

  const home = liveScore!.homeScore ?? 0
  const away = liveScore!.awayScore ?? 0

  return (
    <div className="flex flex-col items-center justify-center px-1 sm:px-4">
      {isLive && (
        <span className="mb-1 flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-primary uppercase sm:mb-2">
          <span className="relative flex h-2 w-2">
            <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          Live
        </span>
      )}
      {!isLive && (
        <span className="mb-1 font-mono text-[10px] tracking-widest text-muted-foreground sm:mb-2 sm:text-sm md:text-base">
          {liveScore!.isFinal ? "FULL TIME" : "VS"}
        </span>
      )}
      <span className="font-heading text-2xl font-bold text-foreground tabular-nums sm:text-4xl md:text-5xl">
        {home} - {away}
      </span>
      {liveScore!.minuteLabel && (
        <span className="mt-2 font-mono text-xs tracking-widest text-muted-foreground uppercase">
          {liveScore!.minuteLabel}
        </span>
      )}
    </div>
  )
}
