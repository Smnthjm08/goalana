import { Suspense } from "react"
import type { Metadata } from "next"
import { fetchApi } from "@/lib/server-api"
import { getSiteUrl } from "@/lib/site"
import { BetShareView } from "@/components/share/bet-share-view"

interface MarketMetaRow {
  question: string
  fixture: { competition: string; participant1: string; participant2: string }
}

type Params = Promise<{ shareId: string }>
type SearchParams = Promise<{ m?: string; odds?: string }>

// `m` (marketPda) and `odds` are optional hints captured by the Share button
// at share time, purely so a crawler-rendered preview doesn't need an
// on-chain RPC round trip — the page itself always re-derives everything
// live from the Position account regardless of what's in the query string.
export async function generateMetadata({
  params,
  searchParams,
}: {
  params: Params
  searchParams: SearchParams
}): Promise<Metadata> {
  const { shareId } = await params
  const { m, odds } = await searchParams

  const market = m ? await fetchApi<MarketMetaRow>(`/markets/${m}`) : null
  const url = `${getSiteUrl()}/share/bet/${shareId}${m ? `?m=${m}` : ""}`

  if (!market) {
    return {
      title: "Bet Slip",
      description: "A Goalana bet slip, verifiable on-chain.",
      alternates: { canonical: url },
    }
  }

  const title = `Bet Slip — ${market.question}`
  const oddsLabel = odds ? ` at ${Number(odds).toFixed(1)}% YES` : ""
  const description = `${market.fixture.participant1} vs ${market.fixture.participant2} · ${market.fixture.competition}${oddsLabel} — verifiable on-chain.`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  }
}

export default async function BetSharePage({ params }: { params: Params }) {
  const { shareId } = await params
  return (
    <Suspense fallback={null}>
      <BetShareView shareId={shareId} />
    </Suspense>
  )
}
