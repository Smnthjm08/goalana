"use client"

// Movement in the TxLINE reference probability since the market was created.
// `initialYesPct`/`initialNoPct` are frozen on the Market row at creation and
// `currentYesPct`/`currentNoPct` are joined live from the current Odds row, so
// this is a genuine "since open" delta — no history query needed.

interface OddsDeltaProps {
  /** Live reference probability, in percent. */
  current: number
  /** Reference probability captured when the market opened, in percent. */
  initial: number
  /**
   * Render against a filled YES/NO button, where semantic red/green would
   * clash with the accent background — inherit the button's text color instead.
   */
  dimmed?: boolean
}

// Below this the line is noise, not signal — TxLINE re-prices constantly and a
// 0.04pt wobble is not "movement".
const UNCHANGED_THRESHOLD_PCT = 0.1

export function OddsDelta({ current, initial, dimmed }: OddsDeltaProps) {
  if (!Number.isFinite(current) || !Number.isFinite(initial)) return null

  const delta = current - initial

  if (Math.abs(delta) < UNCHANGED_THRESHOLD_PCT) {
    return (
      <span
        title="No movement since this market opened"
        className={`font-mono text-[10px] tabular-nums ${
          dimmed ? "text-current opacity-60" : "text-muted-foreground"
        }`}
      >
        → unchanged
      </span>
    )
  }

  const up = delta > 0

  return (
    <span
      title={`${up ? "Up" : "Down"} ${Math.abs(delta).toFixed(2)} points since this market opened`}
      className={`font-mono text-[10px] tabular-nums ${
        dimmed
          ? "text-current opacity-70"
          : up
            ? "text-lime-600 dark:text-lime-400"
            : "text-rose-600 dark:text-rose-400"
      }`}
    >
      {up ? "▲" : "▼"} {up ? "+" : "-"}
      {Math.abs(delta).toFixed(1)}%
    </span>
  )
}
