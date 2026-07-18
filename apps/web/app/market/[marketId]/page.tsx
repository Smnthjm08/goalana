import type { Metadata } from "next"
import { fetchApi } from "@/lib/server-api"
import { getSiteUrl } from "@/lib/site"
import { MarketDetailView } from "@/components/market/market-detail-view"

interface MarketMetaRow {
  marketPda: string
  question: string
  status: string
  currentYesPct: number | null
  currentNoPct: number | null
  initialYesPct: number | null
  initialNoPct: number | null
  fixture: { competition: string; participant1: string; participant2: string }
}

type Params = Promise<{ marketId: string }>

export async function generateMetadata({
  params,
}: {
  params: Params
}): Promise<Metadata> {
  const { marketId } = await params
  const market = await fetchApi<MarketMetaRow>(`/markets/${marketId}`)

  if (!market) {
    return { title: "Market" }
  }

  const yesPct = market.currentYesPct ?? market.initialYesPct
  const noPct = market.currentNoPct ?? market.initialNoPct
  const oddsLabel =
    yesPct !== null && noPct !== null
      ? ` — YES ${yesPct.toFixed(1)}% / NO ${noPct.toFixed(1)}%`
      : ""

  const title = market.question
  const description = `${market.fixture.participant1} vs ${market.fixture.participant2} · ${market.fixture.competition} · ${market.status}${oddsLabel}`
  const url = `${getSiteUrl()}/market/${market.marketPda}`

  return {
    title,
    description,
    alternates: { canonical: url },
    openGraph: { title, description, url, type: "website" },
    twitter: { card: "summary_large_image", title, description },
  }
}

export default async function MarketPage({ params }: { params: Params }) {
  const { marketId } = await params
  return <MarketDetailView marketId={marketId} />
}
