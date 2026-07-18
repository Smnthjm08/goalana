"use client"

interface CornerTallyProps {
  corners: { home: number; away: number } | null | undefined
  participant1: string
  participant2: string
  participant1IsHome: boolean
}

export function CornerTally({
  corners,
  participant1,
  participant2,
  participant1IsHome,
}: CornerTallyProps) {
  if (!corners || (corners.home === 0 && corners.away === 0)) return null

  const participant1Corners = participant1IsHome ? corners.home : corners.away
  const participant2Corners = participant1IsHome ? corners.away : corners.home

  return (
    <div className="mb-4 flex items-center justify-between rounded-sm border border-border bg-card px-4 py-3">
      <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
        Corners
      </span>
      <span className="font-mono text-sm font-semibold text-foreground tabular-nums">
        {participant1} {participant1Corners} — {participant2Corners}{" "}
        {participant2}
      </span>
    </div>
  )
}
