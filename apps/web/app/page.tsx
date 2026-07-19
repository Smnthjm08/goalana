"use client"
import { useEffect, useState } from "react"
import { AlertCircle, RefreshCw, CalendarOff } from "lucide-react"
import axiosInstance from "@/lib/axios-instance"
import { Skeleton } from "@workspace/ui/components/skeleton"
import { Button } from "@workspace/ui/components/button"
import {
  Empty,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
  EmptyDescription,
} from "@workspace/ui/components/empty"
import { Hero } from "@/components/home/hero"
import { FixtureCard } from "@/components/home/fixture-card"

export default function Page() {
  const [fixtures, setFixtures] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  function fetchFixtures() {
    setLoading(true)
    setError(null)
    axiosInstance
      .get("/fixtures")
      .then((res) => {
        if (res.data?.data) {
          setFixtures(res.data.data)
        }
      })
      .catch((err) => {
        console.error(err)
        setError("Could not load fixtures. Check the TxLINE status indicator.")
      })
      .finally(() => setLoading(false))
  }

  useEffect(() => {
    fetchFixtures()
  }, [])

  return (
    <div className="flex w-full flex-col p-4 md:p-8 lg:p-12">
      <div className="mx-auto flex w-full max-w-6xl flex-col gap-10">
        <Hero />

        <div className="flex flex-col gap-6">
          <h2 className="border-b border-border pb-4 font-heading text-2xl tracking-widest text-primary uppercase">
            Live & Upcoming Fixtures
          </h2>

          {loading ? (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {[1, 2, 3, 4, 5, 6].map((i) => (
                <Skeleton key={i} className="h-32 w-full rounded-sm" />
              ))}
            </div>
          ) : error ? (
            <div className="flex flex-col items-center gap-4 rounded-sm border border-destructive/40 bg-destructive/5 px-6 py-12 text-center">
              <AlertCircle className="size-8 text-destructive/60" />
              <div className="flex flex-col gap-1">
                <span className="font-heading text-sm tracking-widest text-destructive uppercase">
                  Feed Unavailable
                </span>
                <p className="max-w-sm font-mono text-[11px] leading-relaxed text-muted-foreground">
                  {error}
                </p>
              </div>
              <Button
                onClick={fetchFixtures}
                variant="outline"
                className="mt-1 gap-2 font-heading tracking-widest uppercase"
              >
                <RefreshCw className="size-3.5" />
                Retry
              </Button>
            </div>
          ) : fixtures.length === 0 ? (
            <Empty className="rounded-sm border border-dashed border-border bg-card py-16">
              <EmptyHeader>
                <EmptyMedia
                  variant="icon"
                  className="size-10 rounded-sm border border-border bg-muted/40 text-muted-foreground"
                >
                  <CalendarOff />
                </EmptyMedia>
                <EmptyTitle className="font-heading text-lg tracking-widest text-foreground uppercase">
                  No fixtures tracked
                </EmptyTitle>
                <EmptyDescription className="font-mono text-[11px] leading-relaxed">
                  Goalana syncs World Cup fixtures from the TxLINE feed. If this
                  stays empty, the feed is unreachable — check the status
                  indicator in the header.
                </EmptyDescription>
              </EmptyHeader>
            </Empty>
          ) : (
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2 lg:grid-cols-3">
              {fixtures.map((fixture) => (
                <FixtureCard key={fixture.fixtureId} fixture={fixture} />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
