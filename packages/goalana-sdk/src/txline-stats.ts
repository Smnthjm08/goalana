// TxLINE stat-validation base stat keys (period is a separate field, not the
// composite period*1000+base encoding of the live Stats map). Verified against
// the real feed on 2026-07-17: for France 0–2 Spain (fixture 18237038, final),
// stat-validation returned key 1 = 0 and key 2 = 2 (matching the goals), while
// keys 7/8 returned 7/1 (corners) and 3/4 returned 2/1 (yellow cards). The
// previous 7/8 values silently proved CORNERS instead of goals — see
// docs/TXLINE.md and TXLINE_ENDPOINTS.md (base 1=home goals, 2=away goals).
//
// Keys are participant-relative: key 1 is participant1, key 2 is participant2
// (orient via Fixture.participant1IsHome when a home/away framing is needed).
//
// The non-goal keys below were confirmed by the same triangulation
// (apps/api/src/scripts/verify-stat-keys.ts) and are proven by the identical
// Merkle machinery as goals — settlement is stat-agnostic, so any of these can
// be verified on-chain by `validate_stat`. Only goals currently back a tradeable
// market, because TxLINE prices no corners/cards odds for this competition.
export const TXLINE_STAT_KEYS = {
  HOME_GOALS: 1,
  AWAY_GOALS: 2,
  HOME_YELLOW_CARDS: 3,
  AWAY_YELLOW_CARDS: 4,
  HOME_CORNERS: 7,
  AWAY_CORNERS: 8,
} as const;

/**
 * Human labels for the base stat keys above. `settlement.service` and the
 * frontend receipt both decode raw keys for display; keep them in one place so
 * a key never renders as a bare number in one surface and a name in another.
 */
export const TXLINE_STAT_LABELS: Record<number, string> = {
  1: "Home goals",
  2: "Away goals",
  3: "Home yellow cards",
  4: "Away yellow cards",
  5: "Home red cards",
  6: "Away red cards",
  7: "Home corners",
  8: "Away corners",
};

/**
 * TxLINE `period` values seen on real stat-validation proofs.
 *
 * TXLINE_ENDPOINTS.md documents 0–5, but every real full-match proof we have
 * fetched returns **100**, and its values match the official full-match
 * scoreline exactly (verified across every completed fixture — see
 * verify-stat-keys.ts). 100 is therefore mapped to "Full match" on observed
 * evidence. The documented 0–5 values are retained but have NOT been seen in
 * the wild; any non-full-match period remains unverified against `settle_market`
 * (this is why extra-time/penalty markets stay deferred).
 */
export const TXLINE_PERIOD_LABELS: Record<number, string> = {
  0: "Full match",
  1: "1st half",
  2: "2nd half",
  3: "Extra time 1",
  4: "Extra time 2",
  5: "Penalties",
  100: "Full match",
};
