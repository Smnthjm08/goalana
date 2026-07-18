import type { Metadata } from "next"
import { fetchApi } from "@/lib/server-api"
import { getSiteUrl } from "@/lib/site"
import { FixtureDetailView } from "@/components/fixtures/fixture-detail-view"

interface FixtureMetaRow {
  fixtureId: string
  competition: string
  participant1: string
  participant2: string
  homeScore: number | null
  awayScore: number | null
  finalSeq: number | null
  livePeriodLabel: string | null
}

type Params = Promise<{ fixtureId: string }>

export async function generateMetadata({
  params,
}: {
  params: Params
}): Promise<Metadata> {
  const { fixtureId } = await params
  const fixture = await fetchApi<FixtureMetaRow>(`/fixtures/${fixtureId}`)

  if (!fixture) {
    return { title: "Fixture" }
  }

  const title = `${fixture.participant1} vs ${fixture.participant2}`
  const isFinal = fixture.finalSeq !== null
  const statusLabel = isFinal
    ? `FT ${fixture.homeScore ?? "-"}–${fixture.awayScore ?? "-"}`
    : fixture.livePeriodLabel === "HT"
      ? "Half-time"
      : "Upcoming"
  const description = `${fixture.competition} · ${statusLabel} — live odds and on-chain prediction markets on Goalana.`
  const url = `${getSiteUrl()}/fixtures/${fixture.fixtureId}`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  }
}

export default async function FixturePage({ params }: { params: Params }) {
  const { fixtureId } = await params
  return <FixtureDetailView fixtureId={fixtureId} />
}
