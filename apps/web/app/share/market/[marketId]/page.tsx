import { redirect } from "next/navigation"

type Params = Promise<{ marketId: string }>

/**
 * /share/market/:marketId → canonical /market/:marketId
 *
 * Feature 3 (Shareable Market) points share links here; the canonical market
 * page at /market/:marketId already serves as the public, read-only, OG-ready
 * share target. This route keeps both paths functional so any externally
 * distributed /share/market/… links land correctly.
 */
export default async function ShareMarketPage({ params }: { params: Params }) {
  const { marketId } = await params
  redirect(`/market/${marketId}`)
}
