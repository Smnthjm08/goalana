"use client"

import { useEffect, useRef, type DependencyList } from "react"

type PollContext = {
  cancelled: () => boolean
}

interface SmartPollingOptions {
  immediate?: boolean
  pauseWhenHidden?: boolean
}

/**
 * Polls on a timer without overlapping requests and pauses in background tabs.
 */
export function useSmartPolling(
  callback: (context: PollContext) => void | Promise<void>,
  intervalMs: number,
  deps: DependencyList,
  options: SmartPollingOptions = {}
) {
  const callbackRef = useRef(callback)
  callbackRef.current = callback

  const immediate = options.immediate !== false
  const pauseWhenHidden = options.pauseWhenHidden !== false

  useEffect(() => {
    let cancelled = false
    let inFlight = false
    let timer: ReturnType<typeof setTimeout> | null = null

    const isCancelled = () => cancelled

    const clearTimer = () => {
      if (timer !== null) {
        clearTimeout(timer)
        timer = null
      }
    }

    const schedule = () => {
      if (cancelled) return
      clearTimer()
      timer = setTimeout(() => {
        void run()
      }, intervalMs)
    }

    const run = async () => {
      if (cancelled) return
      if (pauseWhenHidden && document.hidden) {
        schedule()
        return
      }
      if (inFlight) return

      inFlight = true
      try {
        await callbackRef.current({ cancelled: isCancelled })
      } finally {
        inFlight = false
        schedule()
      }
    }

    const handleVisibilityChange = () => {
      if (cancelled || !pauseWhenHidden || document.hidden) return
      clearTimer()
      if (!inFlight) {
        void run()
      }
    }

    if (immediate) {
      void run()
    } else {
      schedule()
    }

    if (pauseWhenHidden) {
      document.addEventListener("visibilitychange", handleVisibilityChange)
    }

    return () => {
      cancelled = true
      clearTimer()
      if (pauseWhenHidden) {
        document.removeEventListener("visibilitychange", handleVisibilityChange)
      }
    }
  }, [immediate, intervalMs, pauseWhenHidden, ...deps])
}