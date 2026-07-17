// Shared time formatting for the countdown/health/positions surfaces.
// One place so "2h 14m" and "19 Jul 2026 · 02:30 IST" read identically
// everywhere they appear.

/**
 * TxLINE timestamps arrive as ms when 13 digits, seconds otherwise. The API
 * serializes them as strings (BigInt), so normalize once, here.
 */
export function toMs(ts: string | number | null | undefined): number | null {
  if (ts === null || ts === undefined) return null
  const n = Number(ts)
  if (!Number.isFinite(n)) return null
  return n > 1e11 ? n : n * 1000
}

/** "19 Jul 2026" */
export function formatDate(ms: number): string {
  return new Date(ms).toLocaleDateString(undefined, {
    day: "2-digit",
    month: "short",
    year: "numeric",
  })
}

/**
 * "02:30 IST" — the viewer's own timezone, named, so a kickoff time is never
 * ambiguous about which clock it refers to.
 */
export function formatTimeWithZone(ms: number): string {
  return new Date(ms).toLocaleTimeString(undefined, {
    hour: "2-digit",
    minute: "2-digit",
    timeZoneName: "short",
  })
}

/**
 * Coarse duration for countdowns: "2h 14m", "45m", "38s".
 * Deliberately at most two units — a countdown is glanceable or it is noise.
 */
export function formatDuration(ms: number): string {
  const totalSeconds = Math.max(0, Math.floor(ms / 1000))

  const days = Math.floor(totalSeconds / 86400)
  const hours = Math.floor((totalSeconds % 86400) / 3600)
  const minutes = Math.floor((totalSeconds % 3600) / 60)
  const seconds = totalSeconds % 60

  if (days > 0) return `${days}d ${hours}h`
  if (hours > 0) return `${hours}h ${minutes}m`
  if (minutes > 0) return `${minutes}m`
  return `${seconds}s`
}

/** "12s ago", "4m ago", "3h ago" — for "last event received". */
export function formatRelativeAgo(
  ms: number,
  now: number = Date.now()
): string {
  const delta = now - ms
  if (delta < 0) return "just now"
  if (delta < 10_000) return "just now"
  return `${formatDuration(delta)} ago`
}
