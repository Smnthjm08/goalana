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

export function LiveScoreHeader({ liveScore, kickoffLabel, startTime }: LiveScoreHeaderProps) {
  const now = useNow(1_000)
  const hasStarted = liveScore != null && liveScore.statusId !== null
  const isLive = hasStarted && !liveScore!.isFinal && IN_PROGRESS_STATUS_IDS.has(liveScore!.statusId!)

  if (!hasStarted) {
    const kickoffMs = toMs(startTime)
    const untilKickoff = kickoffMs !== null && now !== null ? kickoffMs - now : null

    return (
      <div className="flex flex-col items-center justify-center px-4">
        <span className="font-mono text-sm md:text-base text-muted-foreground tracking-widest mb-2">
          VS
        </span>
        <span className="font-heading text-4xl md:text-5xl text-foreground font-bold">
          UPCOMING
        </span>
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest mt-2">
          {kickoffLabel}
        </span>
        {untilKickoff !== null && (
          <span className="font-mono text-[10px] uppercase tracking-widest text-primary mt-1 tabular-nums">
            {untilKickoff <= 0 ? "Starting soon" : `Starts in ${formatDuration(untilKickoff)}`}
          </span>
        )}
      </div>
    )
  }

  const home = liveScore!.homeScore ?? 0
  const away = liveScore!.awayScore ?? 0

  return (
    <div className="flex flex-col items-center justify-center px-4">
      {isLive && (
        <span className="flex items-center gap-1.5 font-mono text-[10px] text-primary tracking-widest mb-2 uppercase">
          <span className="relative flex h-2 w-2">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-primary opacity-75" />
            <span className="relative inline-flex h-2 w-2 rounded-full bg-primary" />
          </span>
          Live
        </span>
      )}
      {!isLive && (
        <span className="font-mono text-sm md:text-base text-muted-foreground tracking-widest mb-2">
          {liveScore!.isFinal ? "FULL TIME" : "VS"}
        </span>
      )}
      <span className="font-heading text-4xl md:text-5xl text-foreground font-bold tabular-nums">
        {home} - {away}
      </span>
      {liveScore!.minuteLabel && (
        <span className="font-mono text-xs text-muted-foreground uppercase tracking-widest mt-2">
          {liveScore!.minuteLabel}
        </span>
      )}
    </div>
  )
}
