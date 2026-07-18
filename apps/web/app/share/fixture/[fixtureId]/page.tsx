import { redirect } from "next/navigation"

type Params = Promise<{ fixtureId: string }>

/**
 * /share/fixture/:fixtureId → canonical /fixtures/:fixtureId
 *
 * Feature 4 (Shareable Fixture) points share links here; the canonical fixture
 * page at /fixtures/:fixtureId already serves as the public, read-only, OG-ready
 * share target. This route keeps both paths functional so any externally
 * distributed /share/fixture/… links land correctly.
 */
export default async function ShareFixturePage({ params }: { params: Params }) {
  const { fixtureId } = await params
  redirect(`/fixtures/${fixtureId}`)
}
