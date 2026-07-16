// TxLINE stat-validation base stat keys (period is a separate field, not the
// composite period*1000+base encoding of the live Stats map). Verified against
// the real feed on 2026-07-17: for France 0–2 Spain (fixture 18237038, final),
// stat-validation returned key 1 = 0 and key 2 = 2 (matching the goals), while
// keys 7/8 returned 7/1 (corners) and 3/4 returned 2/1 (yellow cards). The
// previous 7/8 values silently proved CORNERS instead of goals — see
// docs/TXLINE.md and TXLINE_ENDPOINTS.md (base 1=home goals, 2=away goals).
export const TXLINE_STAT_KEYS = {
  HOME_GOALS: 1,
  AWAY_GOALS: 2,
} as const;
