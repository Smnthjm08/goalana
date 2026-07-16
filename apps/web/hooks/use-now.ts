"use client"

import { useEffect, useState } from "react"

/**
 * Wall-clock time, re-rendered on an interval, for countdowns and "x ago" labels.
 *
 * Returns `null` on the first render and only becomes a number after mount.
 * That is deliberate: `Date.now()` and `toLocale*` differ between the server
 * and the browser (clock skew and timezone), so seeding state with a timestamp
 * during SSR produces a hydration mismatch. Callers render a neutral
 * placeholder while this is null.
 */
export function useNow(intervalMs: number = 1_000): number | null {
  const [now, setNow] = useState<number | null>(null)

  useEffect(() => {
    setNow(Date.now())

    const intervalId = setInterval(() => setNow(Date.now()), intervalMs)
    return () => clearInterval(intervalId)
  }, [intervalMs])

  return now
}
