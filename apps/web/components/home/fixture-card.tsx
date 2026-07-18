import Link from "next/link"
import { Target } from "lucide-react"
import {
  Card,
  CardHeader,
  CardContent,
  CardFooter,
} from "@workspace/ui/components/card"
import { TeamBadge } from "@/components/team-badge"
import { MatchTimeStatus } from "@/components/fixtures/match-time-status"
import { IN_PROGRESS_STATUS_IDS } from "@/lib/match-status"

export function FixtureCard({ fixture }: { fixture: any }) {
  const isFinal = fixture.finalSeq != null
  const isLive =
    fixture.gameState === 3 ||
    (fixture.liveStatusId != null &&
      IN_PROGRESS_STATUS_IDS.has(fixture.liveStatusId))
  // Only show a scoreline when the feed has actually produced one —
  // never a hardcoded 0–0 for a match that hasn't kicked off.
  const hasScore =
    fixture.homeScore != null &&
    fixture.awayScore != null &&
    (isLive || isFinal)

  // The list endpoint returns raw Fixture rows, so there's no
  // computed `minuteLabel` here (that's built per-fixture in
  // /api/fixtures/:id) — the period label is the honest stand-in.
  const liveScore = {
    statusId: fixture.liveStatusId ?? null,
    minuteLabel: fixture.livePeriodLabel ?? null,
    isFinal,
  }

  return (
    <Link href={`/fixtures/${fixture.fixtureId}`}>
      <Card className="group relative flex h-full cursor-pointer flex-col transition-colors hover:border-primary">
        {/* Header: competition + what happens next */}
        <CardHeader className="flex flex-row items-start justify-between gap-3 space-y-0 border-b border-border px-3 py-2">
          <span className="font-mono text-[10px] text-muted-foreground uppercase">
            {fixture.competition}
          </span>
          <MatchTimeStatus
            startTime={fixture.startTime}
            liveScore={liveScore}
            variant="card"
          />
        </CardHeader>

        {/* Body: Teams (+ real score only when the match has one) */}
        <CardContent className="flex flex-col gap-2 px-3 py-3">
          <div className="flex items-center justify-between gap-3">
            <TeamBadge
              name={fixture.participant1}
              className="font-sans font-bold text-foreground"
            />
            {hasScore && (
              <span className="shrink-0 font-heading text-xl">
                {fixture.participant1IsHome
                  ? fixture.homeScore
                  : fixture.awayScore}
              </span>
            )}
          </div>
          <div className="flex items-center justify-between gap-3">
            <TeamBadge
              name={fixture.participant2}
              className="font-sans font-bold text-foreground"
            />
            {hasScore && (
              <span className="shrink-0 font-heading text-xl">
                {fixture.participant1IsHome
                  ? fixture.awayScore
                  : fixture.homeScore}
              </span>
            )}
          </div>
        </CardContent>

        {/* Footer: market count */}
        <CardFooter className="mt-auto flex flex-row items-center justify-between border-t border-border bg-muted/50 px-3 py-2">
          <span className="flex items-center gap-1.5 font-mono text-[10px] text-muted-foreground">
            <Target className="size-2.5 shrink-0" />
            {fixture._count?.markets > 0
              ? `${fixture._count.markets} market${fixture._count.markets === 1 ? "" : "s"}`
              : "No markets yet"}
          </span>
          <span className="font-mono text-[10px] text-primary/60 transition-colors group-hover:text-primary">
            View →
          </span>
        </CardFooter>
      </Card>
    </Link>
  )
}
