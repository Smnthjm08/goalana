"use client"

interface NormalizedMatchEvent {
  type: string
  team: "HOME" | "AWAY" | null
  minute: number | null
  minuteLabel: string | null
  discarded: boolean
}

interface TeamMatchBadgesProps {
  events: NormalizedMatchEvent[]
  team: "HOME" | "AWAY"
  align: "start" | "end"
}

export function TeamMatchBadges({ events, team, align }: TeamMatchBadgesProps) {
  const teamEvents = events.filter((e) => e.team === team && !e.discarded)
  const goals = teamEvents.filter((e) => e.type === "goal")
  const yellowCards = teamEvents.filter((e) => e.type === "yellow_card")
  const redCards = teamEvents.filter((e) => e.type === "red_card")

  if (goals.length === 0 && yellowCards.length === 0 && redCards.length === 0) {
    return null
  }

  return (
    <div
      className={`mt-1.5 flex flex-wrap items-center gap-x-2 gap-y-1 font-mono text-[10px] tracking-wide text-muted-foreground sm:mt-2 sm:text-xs ${
        align === "end" ? "justify-end text-right" : "justify-start"
      }`}
    >
      {goals.length > 0 && (
        <span className="flex items-center gap-1">
          <span aria-hidden>⚽</span>
          {goals
            .map(
              (g) => g.minuteLabel ?? (g.minute != null ? `${g.minute}'` : "—")
            )
            .join(", ")}
        </span>
      )}
      {yellowCards.length > 0 && (
        <span className="flex items-center gap-1">
          <span aria-hidden>🟨</span>
          {yellowCards.length}
        </span>
      )}
      {redCards.length > 0 && (
        <span className="flex items-center gap-1">
          <span aria-hidden>🟥</span>
          {redCards.length}
        </span>
      )}
    </div>
  )
}
