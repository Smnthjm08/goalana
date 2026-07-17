"use client"

interface NormalizedMatchEvent {
  id: string
  type: string
  team: "HOME" | "AWAY" | null
  minute: number | null
  minuteLabel: string | null
  title: string
  description: string | null
  confirmed: boolean
  discarded: boolean
  timestamp: string
}

interface MatchEventTimelineProps {
  events: NormalizedMatchEvent[]
  participant1: string
  participant2: string
  participant1IsHome: boolean
}

const EVENT_ICONS: Record<string, string> = {
  kickoff: "▶",
  period_start: "▶",
  goal: "⚽",
  yellow_card: "🟨",
  red_card: "🟥",
  substitution: "🔄",
  half_time: "⏸",
  full_time: "🏁",
  var_overturned: "🔍",
  penalty_outcome: "🥅",
}

export function MatchEventTimeline({
  events,
  participant1,
  participant2,
  participant1IsHome,
}: MatchEventTimelineProps) {
  const teamName = (team: "HOME" | "AWAY" | null) => {
    if (team === null) return null
    const isParticipant1 = (team === "HOME") === participant1IsHome
    return isParticipant1 ? participant1 : participant2
  }

  if (events.length === 0) {
    return (
      <div className="rounded-sm border border-border bg-card p-8 text-center">
        <span className="font-mono text-sm tracking-wider text-muted-foreground uppercase">
          No match events yet.
        </span>
      </div>
    )
  }

  return (
    <div className="divide-y divide-border rounded-sm border border-border bg-card">
      {events.map((event) => {
        const name = teamName(event.team)
        const icon = EVENT_ICONS[event.type] ?? "•"

        return (
          <div
            key={event.id}
            className={`flex items-start gap-4 p-4 transition-opacity ${
              event.discarded
                ? "opacity-60"
                : !event.confirmed
                  ? "opacity-70"
                  : ""
            }`}
          >
            <span className="w-10 shrink-0 pt-0.5 font-mono text-xs text-muted-foreground tabular-nums">
              {event.minuteLabel ?? "—"}
            </span>
            <span className="shrink-0 text-lg leading-none" aria-hidden>
              {icon}
            </span>
            <div className="flex min-w-0 flex-col gap-0.5">
              <div className="flex flex-wrap items-center gap-2">
                <span
                  className={`font-sans text-sm font-semibold text-foreground ${
                    event.discarded ? "line-through decoration-destructive" : ""
                  }`}
                >
                  {event.title}
                </span>
                {name && (
                  <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
                    {name}
                  </span>
                )}
                {event.discarded && (
                  <span className="rounded-full border border-destructive/40 px-1.5 py-0.5 font-mono text-[9px] tracking-widest text-destructive uppercase">
                    Disallowed
                  </span>
                )}
                {!event.confirmed && !event.discarded && (
                  <span className="animate-pulse rounded-full border border-primary/40 px-1.5 py-0.5 font-mono text-[9px] tracking-widest text-primary uppercase">
                    Pending
                  </span>
                )}
              </div>
              {event.description && (
                <span className="font-mono text-[10px] text-muted-foreground">
                  {event.description}
                </span>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}
