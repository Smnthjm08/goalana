/** Absolute origin for building shareable URLs and `metadataBase`. */
export function getSiteUrl(): string {
  return (process.env.NEXT_PUBLIC_SITE_URL || "http://localhost:3000").replace(/\/$/, "")
}
