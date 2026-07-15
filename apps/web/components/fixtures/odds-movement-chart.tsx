"use client"

import { useEffect, useState } from "react"
import axiosInstance from "@/lib/axios-instance"
import { Button } from "@workspace/ui/components/button"
import {
  ChartContainer,
  ChartTooltip,
  ChartTooltipContent,
  ChartLegend,
  ChartLegendContent,
  type ChartConfig,
} from "@workspace/ui/components/chart"
import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  XAxis,
  YAxis,
} from "recharts"

const POLL_INTERVAL_MS = 8_000

interface OddsMovementChartProps {
  fixtureId: string | number
  participant1: string
  participant2: string
  /** Fixture kickoff time (ms epoch, as returned by the API — a string since BigInt is JSON-serialized as string). */
  startTime: string | number
}

interface OutcomeProbabilities {
  home: number
  draw: number
  away: number
}

interface RawHistoryPoint extends OutcomeProbabilities {
  timestamp: number
}

interface OddsHistoryResponse {
  opening: OutcomeProbabilities
  latest: OutcomeProbabilities
  history: RawHistoryPoint[]
}

type ChartPoint = RawHistoryPoint

/**
 * The single normalization pass for this chart: filter out any non-finite
 * values a partial/corrupt update could produce, then sort chronologically.
 * Every other part of this component consumes `chartData` as-is — no further
 * re-parsing of these numbers happens downstream.
 */
function toChartData(raw: OddsHistoryResponse | null): ChartPoint[] {
  if (!raw?.history?.length) return []

  return raw.history
    .filter(
      (point) =>
        Number.isFinite(point.timestamp) &&
        Number.isFinite(point.home) &&
        Number.isFinite(point.draw) &&
        Number.isFinite(point.away)
    )
    .slice()
    .sort((a, b) => a.timestamp - b.timestamp)
}

export function OddsMovementChart({
  fixtureId,
  participant1,
  participant2,
  startTime,
}: OddsMovementChartProps) {
  const [oddsData, setOddsData] = useState<OddsHistoryResponse | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [visibleSeries, setVisibleSeries] = useState({
    home: true,
    draw: true,
    away: true,
  })

  useEffect(() => {
    if (!fixtureId) return

    let cancelled = false

    const fetchOddsHistory = () =>
      axiosInstance
        .get(`/fixtures/${fixtureId}/odds/history`)
        .then((res) => {
          if (cancelled) return
          setOddsData(res.data?.data ?? null)
          setError(null)
        })
        .catch((err) => {
          if (cancelled) return
          console.error("Error fetching odds history:", err)
          // Keep whatever was last rendered — a transient poll failure must
          // not blank out an already-visible chart.
          setError("Live update failed — showing last known data")
        })

    fetchOddsHistory().finally(() => {
      if (!cancelled) setLoading(false)
    })

    const intervalId = setInterval(() => {
      void fetchOddsHistory()
    }, POLL_INTERVAL_MS)

    return () => {
      cancelled = true
      clearInterval(intervalId)
    }
  }, [fixtureId])

  const toggleSeries = (series: "home" | "draw" | "away") => {
    setVisibleSeries((prev) => ({ ...prev, [series]: !prev[series] }))
  }

  // This project's theme (packages/ui/src/styles/globals.css) stores full color
  // values directly in each CSS variable (e.g. `--primary: #C0F830;`), not bare
  // HSL components — so these must be referenced as `var(--x)`, never wrapped
  // in `hsl(var(--x))` (which would produce the invalid `hsl(#C0F830)`).
  const chartConfig = {
    home: { label: participant1, color: "var(--primary)" },
    draw: { label: "Draw", color: "var(--muted-foreground)" },
    away: { label: participant2, color: "var(--chart-3)" },
  } satisfies ChartConfig

  const chartData = toChartData(oddsData)

  if (loading) {
    return (
      <div className="border border-border p-8 text-center bg-card rounded-sm">
        <span className="font-mono text-sm text-muted-foreground uppercase tracking-wider animate-pulse">
          [ Loading odds movement... ]
        </span>
      </div>
    )
  }

  if (error && chartData.length === 0) {
    return (
      <div className="border border-destructive/40 p-8 text-center bg-card rounded-sm">
        <span className="font-mono text-sm text-destructive uppercase tracking-wider">
          [ {error} ]
        </span>
      </div>
    )
  }

  if (chartData.length === 0) {
    return (
      <div className="border border-border p-8 text-center bg-card rounded-sm">
        <span className="font-mono text-sm text-muted-foreground uppercase tracking-wider">
          No odds history available yet for this fixture.
        </span>
      </div>
    )
  }

  const kickoffMs = Number(startTime)
  const domainStart = chartData[0]!.timestamp
  const domainEnd = chartData[chartData.length - 1]!.timestamp
  const showKickoffLine =
    Number.isFinite(kickoffMs) && kickoffMs >= domainStart && kickoffMs <= domainEnd

  const latest = oddsData?.latest

  return (
    <div className="border border-border bg-card rounded-sm p-6 lg:p-8 relative">
      {/* Header */}
      <div className="flex flex-col md:flex-row md:items-start justify-between gap-6">
        <div className="flex flex-col gap-1">
          <h3 className="font-heading text-xl uppercase tracking-widest text-foreground">
            Match Result
          </h3>
          <span className="font-mono text-[10px] text-muted-foreground tracking-widest uppercase">
            TxLINE Reference — Implied Probabilities
          </span>
        </div>

        {latest && (
          <div className="flex flex-wrap items-center gap-3">
            <Button
              variant="outline"
              onClick={() => toggleSeries("home")}
              className={`h-auto py-2 px-3 flex-col items-start gap-1 rounded-sm border transition-colors ${visibleSeries.home ? "border-primary/50 bg-primary/5" : "border-border bg-transparent opacity-50 hover:opacity-100"}`}
            >
              <span className="font-mono text-[10px] uppercase text-muted-foreground">{participant1}</span>
              <span className="font-heading text-lg text-foreground leading-none">{latest.home.toFixed(2)}%</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => toggleSeries("draw")}
              className={`h-auto py-2 px-3 flex-col items-start gap-1 rounded-sm border transition-colors ${visibleSeries.draw ? "border-muted-foreground/50 bg-muted/20" : "border-border bg-transparent opacity-50 hover:opacity-100"}`}
            >
              <span className="font-mono text-[10px] uppercase text-muted-foreground">DRAW</span>
              <span className="font-heading text-lg text-foreground leading-none">{latest.draw.toFixed(2)}%</span>
            </Button>

            <Button
              variant="outline"
              onClick={() => toggleSeries("away")}
              className={`h-auto py-2 px-3 flex-col items-start gap-1 rounded-sm border transition-colors ${visibleSeries.away ? "border-chart-3/50 bg-chart-3/5" : "border-border bg-transparent opacity-50 hover:opacity-100"}`}
            >
              <span className="font-mono text-[10px] uppercase text-muted-foreground">{participant2}</span>
              <span className="font-heading text-lg text-foreground leading-none">{latest.away.toFixed(2)}%</span>
            </Button>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3 text-right">
          <span className="font-mono text-[10px] text-destructive uppercase tracking-widest">
            [ {error} ]
          </span>
        </div>
      )}

      {/* Graph */}
      <div className="w-full mt-6">
        <ChartContainer config={chartConfig} className="h-100 w-full aspect-auto">
          <LineChart accessibilityLayer data={chartData} margin={{ top: 20, right: 20, bottom: 20, left: 0 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />

            <XAxis
              dataKey="timestamp"
              type="number"
              domain={["dataMin", "dataMax"]}
              tickFormatter={(val) => new Date(val).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })}
              stroke="var(--muted-foreground)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickMargin={10}
            />

            <YAxis
              domain={[0, 100]}
              tickFormatter={(val) => `${val}%`}
              stroke="var(--muted-foreground)"
              fontSize={10}
              tickLine={false}
              axisLine={false}
              tickMargin={10}
            />

            <ChartTooltip
              content={
                <ChartTooltipContent
                  labelFormatter={(label) =>
                    new Date(label).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit", second: "2-digit" })
                  }
                  formatter={(value, name, item) => (
                    <div className="flex w-full items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <div
                          className="h-2.5 w-2.5 shrink-0 rounded-xs"
                          style={{ backgroundColor: item.color }}
                        />
                        <span className="text-muted-foreground">
                          {typeof name === "string" ? name : String(name)}
                        </span>
                      </div>
                      <span className="font-mono font-medium text-foreground tabular-nums">
                        {Number(value).toFixed(2)}%
                      </span>
                    </div>
                  )}
                />
              }
              cursor={{ stroke: "var(--muted-foreground)", strokeWidth: 1, strokeDasharray: "3 3" }}
            />

            <ChartLegend content={<ChartLegendContent />} />

            {showKickoffLine && (
              <ReferenceLine
                x={kickoffMs}
                stroke="var(--primary)"
                strokeDasharray="3 3"
                label={{ position: "top", value: "KICKOFF", fill: "var(--primary)", fontSize: 10, fontFamily: "monospace" }}
              />
            )}

            {visibleSeries.home && (
              <Line
                type="stepAfter"
                dataKey="home"
                stroke="var(--color-home)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "var(--color-home)" }}
                isAnimationActive={false}
              />
            )}
            {visibleSeries.draw && (
              <Line
                type="stepAfter"
                dataKey="draw"
                stroke="var(--color-draw)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "var(--color-draw)" }}
                isAnimationActive={false}
              />
            )}
            {visibleSeries.away && (
              <Line
                type="stepAfter"
                dataKey="away"
                stroke="var(--color-away)"
                strokeWidth={2}
                dot={false}
                activeDot={{ r: 4, fill: "var(--color-away)" }}
                isAnimationActive={false}
              />
            )}
          </LineChart>
        </ChartContainer>
      </div>

      {/* Footer Metadata */}
      <div className="flex flex-col sm:flex-row items-center justify-between border-t border-border pt-4 mt-2 gap-4">
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest text-center sm:text-left">
          LATEST UPDATE / {new Date(domainEnd).toLocaleTimeString()}
        </span>
        <span className="font-mono text-[10px] text-muted-foreground uppercase tracking-widest text-center sm:text-right">
          HISTORY POINTS / {chartData.length} <br className="sm:hidden" />
          <span className="hidden sm:inline"> • </span>
          SOURCE / TXLINE
        </span>
      </div>
    </div>
  )
}
