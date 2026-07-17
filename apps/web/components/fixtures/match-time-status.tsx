"use client"

import { useNow } from "@/hooks/use-now"
import { getMatchPhase, type LiveScoreLike } from "@/lib/match-status"
import {
  formatDate,
  formatDuration,
  formatTimeWithZone,
  toMs,
} from "@/lib/time"

// Every time surface answers one question: "what happens next?"
//   before kickoff → when it starts, and how long that is from now
//   in play        → that it's live, and what minute
//   finished       → that it's over
// Absolute time alone makes a reader do timezone maths; a countdown alone hides
// when it actually is. Upcoming shows both.

interface MatchTimeStatusProps {
  /** Kickoff, as returned by the API (ms or s epoch, string or number). */
  startTime: string | number
  liveScore?: LiveScoreLike | null
  /** `card` is a compact two-line stack; `detail` is the fixture header block. */
  variant?: "card" | "detail"
  className?: string
}

function LiveDot() {
  return (
    <span className="relative flex h-1.5 w-1.5">
      <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-75" />
      <span className="relative inline-flex h-1.5 w-1.5 rounded-full bg-primary" />
    </span>
  )
}

export function MatchTimeStatus({
  startTime,
  liveScore,
  variant = "card",
  className = "",
}: MatchTimeStatusProps) {
  const now = useNow(1_000)
  const phase = getMatchPhase(liveScore)
  const kickoffMs = toMs(startTime)

  const compact = variant === "card"
  const align = compact ? "items-end text-right" : "items-end text-right"

  if (phase === "live") {
    return (
      <div className={`flex flex-col gap-0.5 ${align} ${className}`}>
        <span className="flex items-center gap-1.5 font-mono text-[10px] tracking-widest text-primary uppercase">
          <LiveDot />
          Live
        </span>
        {liveScore?.minuteLabel && (
          <span
            className={`font-heading text-foreground tabular-nums ${compact ? "text-xs" : "text-sm"}`}
          >
            {liveScore.minuteLabel}
          </span>
        )}
      </div>
    )
  }

  if (phase === "final") {
    return (
      <div className={`flex flex-col gap-0.5 ${align} ${className}`}>
        <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
          Final
        </span>
        {kickoffMs !== null && (
          <span className="font-mono text-[10px] text-muted-foreground/70">
            {formatDate(kickoffMs)}
          </span>
        )}
      </div>
    )
  }

  if (kickoffMs === null) return null

  // `now` is null until mount (see useNow) — render the absolute time, which is
  // stable, and let the countdown appear once the client clock is available.
  const untilKickoff = now === null ? null : kickoffMs - now
  const startingSoon = untilKickoff !== null && untilKickoff <= 0

  return (
    <div className={`flex flex-col gap-0.5 ${align} ${className}`}>
      <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
        Kickoff
      </span>
      <span
        className={`font-mono text-foreground tabular-nums ${compact ? "text-[10px]" : "text-xs"}`}
      >
        {formatDate(kickoffMs)}
      </span>
      <span
        className={`font-mono text-muted-foreground tabular-nums ${compact ? "text-[10px]" : "text-xs"}`}
      >
        {formatTimeWithZone(kickoffMs)}
      </span>

      {untilKickoff !== null && (
        <span className="mt-1 font-mono text-[10px] tracking-widest text-primary uppercase">
          {startingSoon
            ? "Starting soon"
            : `Starts in ${formatDuration(untilKickoff)}`}
        </span>
      )}
    </div>
  )
}

interface MarketLockStatusProps {
  /** Market.locksAt — an ISO string from the API. */
  locksAt: string | null | undefined
  /** On-chain market status; the DB mirror is not updated by lock/settle. */
  status: string | null | undefined
}

/**
 * "What happens next" for a single market: when betting closes, or that it
 * already has. Silent once the market is settled or cancelled — at that point
 * the status badge and the settlement receipt tell the story.
 */
export function MarketLockStatus({ locksAt, status }: MarketLockStatusProps) {
  const now = useNow(1_000)

  if (status === "Settled" || status === "Cancelled") return null

  if (status === "Locked") {
    return (
      <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
        Locked
      </span>
    )
  }

  if (!locksAt) return null

  const locksAtMs = new Date(locksAt).getTime()
  if (!Number.isFinite(locksAtMs)) return null

  if (now === null) return null

  const untilLock = locksAtMs - now

  // Kickoff has passed but the lifecycle cron hasn't locked it on-chain yet —
  // say so rather than counting into negative time.
  if (untilLock <= 0) {
    return (
      <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
        Locking…
      </span>
    )
  }

  // Under an hour is when "betting is about to close" starts to matter.
  const urgent = untilLock <= 60 * 60 * 1000

  return (
    <span
      className={`font-mono text-[10px] tracking-widest uppercase tabular-nums ${
        urgent ? "text-primary" : "text-muted-foreground"
      }`}
    >
      Locks in {formatDuration(untilLock)}
    </span>
  )
}
