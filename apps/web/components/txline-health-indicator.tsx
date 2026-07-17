"use client"

import { useEffect, useState } from "react"
import axiosInstance from "@/lib/axios-instance"
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@workspace/ui/components/tooltip"
import { formatRelativeAgo } from "@/lib/time"

// Slow enough to be free, fast enough that a dropped stream surfaces within a
// demo beat. The endpoint caches its RPC probe, so this stays cheap.
const POLL_INTERVAL_MS = 15_000

interface StreamState {
  connected: boolean
  lastFrameAt: number | null
  lastEventAt: number | null
  eventCount: number
}

interface HealthSnapshot {
  status: "UP" | "DEGRADED"
  txline: {
    connected: boolean
    streams: { odds: StreamState; scores: StreamState }
    lastEventAt: number | null
    lastOddsUpdateAt: number | null
  }
  fixtures: { tracked: number; live: number; markets: number }
  rpc: { healthy: boolean; slot: number | null }
}

function Row({
  label,
  value,
  ok,
}: {
  label: string
  value: string
  ok?: boolean
}) {
  return (
    <div className="flex items-center justify-between gap-6">
      <span className="font-mono text-[10px] tracking-widest text-muted-foreground uppercase">
        {label}
      </span>
      <span
        className={`font-mono text-[10px] tabular-nums ${
          ok === undefined
            ? "text-foreground"
            : ok
              ? "text-primary"
              : "text-destructive"
        }`}
      >
        {value}
      </span>
    </div>
  )
}

export function TxlineHealthIndicator() {
  const [health, setHealth] = useState<HealthSnapshot | null>(null)
  const [reachable, setReachable] = useState(true)
  // Recomputed on each poll so "4m ago" doesn't silently go stale between them.
  const [now, setNow] = useState(() => Date.now())

  useEffect(() => {
    let cancelled = false

    const fetchHealth = () =>
      axiosInstance
        .get("/health")
        .then((res) => {
          if (cancelled) return
          setHealth(res.data?.data ?? null)
          setReachable(true)
          setNow(Date.now())
        })
        .catch(() => {
          if (cancelled) return
          // Backend unreachable is itself a disconnected state — keep the last
          // snapshot for detail, but the dot must go red.
          setReachable(false)
          setNow(Date.now())
        })

    void fetchHealth()
    const intervalId = setInterval(() => void fetchHealth(), POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [])

  const connected = reachable && Boolean(health?.txline.connected)
  const loading = health === null && reachable

  const label = loading
    ? "Connecting…"
    : connected
      ? "TxLINE Connected"
      : "Reconnecting…"

  const lastEventAt = health?.txline.lastEventAt ?? null
  const lastOddsAt = health?.txline.lastOddsUpdateAt ?? null

  // Between matches the feed carries heartbeats but no data events, so
  // "last event" alone would read as a dead stream. The heartbeat is what
  // actually proves the socket is open right now.
  const lastFrameAt = health
    ? [
        health.txline.streams.odds.lastFrameAt,
        health.txline.streams.scores.lastFrameAt,
      ]
        .filter((ts): ts is number => ts !== null)
        .reduce<number | null>(
          (max, ts) => (max === null || ts > max ? ts : max),
          null
        )
    : null

  return (
    <TooltipProvider delayDuration={100}>
      <Tooltip>
        <TooltipTrigger asChild>
          <button
            type="button"
            aria-label={`TxLINE feed status: ${label}`}
            className="flex cursor-default items-center gap-2 rounded-sm border border-border bg-card px-2 py-1.5 transition-colors hover:border-primary/50"
          >
            <span className="relative flex h-2 w-2 shrink-0">
              {connected && (
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-primary opacity-60" />
              )}
              <span
                className={`relative inline-flex h-2 w-2 rounded-full ${
                  loading
                    ? "bg-muted-foreground"
                    : connected
                      ? "bg-primary"
                      : "bg-destructive"
                }`}
              />
            </span>
            {/* The dot alone carries the state on narrow screens. */}
            <span className="hidden font-mono text-[10px] tracking-widest text-muted-foreground uppercase sm:inline">
              {label}
            </span>
          </button>
        </TooltipTrigger>

        <TooltipContent
          side="bottom"
          align="end"
          className="w-64 border border-border bg-popover p-3 text-popover-foreground"
        >
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-6 border-b border-border pb-2">
              <span className="font-heading text-[11px] tracking-widest text-foreground uppercase">
                Live Feed
              </span>
              <span
                className={`font-mono text-[10px] tracking-widest uppercase ${
                  connected ? "text-primary" : "text-destructive"
                }`}
              >
                {connected ? "Healthy" : "Degraded"}
              </span>
            </div>

            {!reachable ? (
              <span className="font-mono text-[10px] leading-relaxed text-muted-foreground">
                Backend unreachable — retrying every 15s.
              </span>
            ) : !health ? (
              <span className="font-mono text-[10px] text-muted-foreground">
                Loading…
              </span>
            ) : (
              <>
                <Row
                  label="SSE Odds"
                  value={
                    health.txline.streams.odds.connected ? "Connected" : "Down"
                  }
                  ok={health.txline.streams.odds.connected}
                />
                <Row
                  label="SSE Scores"
                  value={
                    health.txline.streams.scores.connected
                      ? "Connected"
                      : "Down"
                  }
                  ok={health.txline.streams.scores.connected}
                />
                <Row
                  label="Heartbeat"
                  value={
                    lastFrameAt ? formatRelativeAgo(lastFrameAt, now) : "—"
                  }
                />
                <Row
                  label="Last event"
                  value={
                    lastEventAt
                      ? formatRelativeAgo(lastEventAt, now)
                      : "None yet"
                  }
                />
                <Row
                  label="Last odds"
                  value={lastOddsAt ? formatRelativeAgo(lastOddsAt, now) : "—"}
                />
                <Row
                  label="Fixtures"
                  value={`${health.fixtures.tracked} tracked`}
                />
                <Row
                  label="RPC"
                  value={health.rpc.healthy ? "Healthy" : "Unreachable"}
                  ok={health.rpc.healthy}
                />

                <span className="border-t border-border pt-2 font-mono text-[9px] leading-relaxed text-muted-foreground">
                  Odds and scores stream live from TxLINE over SSE. Between
                  matches the feed is quiet — the heartbeat is what proves the
                  socket is open.
                </span>
              </>
            )}
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  )
}
