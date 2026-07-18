// Server components (generateMetadata, etc.) run outside the browser, so the
// `/api/:path*` rewrite in next.config.ts — which only rewrites requests that
// hit the Next server's own router — doesn't apply. Hit the API directly by
// its real origin instead, same env var next.config.ts already uses for that
// rewrite's destination.
const API_ORIGIN = (process.env.NEXT_PUBLIC_API_URL || "http://localhost:8081").replace(/\/$/, "")

/**
 * Best-effort server-side fetch against the Goalana API, for building page
 * metadata. Never throws — a metadata build failing to reach the API should
 * fall back to generic copy, not break the page render.
 */
export async function fetchApi<T>(path: string): Promise<T | null> {
  try {
    const res = await fetch(`${API_ORIGIN}/api${path}`, { cache: "no-store" })
    if (!res.ok) return null
    const json = await res.json()
    return (json?.data as T) ?? null
  } catch {
    return null
  }
}
