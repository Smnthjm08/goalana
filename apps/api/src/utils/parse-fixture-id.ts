// Every fixture-id route param goes through this — a non-numeric id (typo,
// probe, or an accidental /api/fixtures/undefined from the client) must
// surface as a 400, not fall through to BigInt()'s SyntaxError, which the
// generic catch block turns into an indistinguishable-from-a-real-fault 500.
export function parseFixtureId(raw: string): bigint | null {
  if (!/^\d+$/.test(raw)) return null;
  try {
    return BigInt(raw);
  } catch {
    return null;
  }
}
