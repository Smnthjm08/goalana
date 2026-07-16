// Canonical on-chain identifiers + settlement facts, surfaced in the UI so a
// judge can verify Goalana's trustless claim without leaving the product.
// Keep these in sync with goalana_program/programs/*/src/lib.rs and the README
// "On-Chain Evidence" table.

/** Goalana prediction-market program (Anchor), Solana Devnet. */
export const GOALANA_PROGRAM_ID = "AgxqK6wRkFKyabyArNiJF8dpoJ6TNLLxPnV5rg27pRQu"

/**
 * TxLINE (TxODDS) oracle program that `settle_market` CPIs into. Settlement
 * verifies a match-result Merkle proof against this program's on-chain
 * `daily_scores_roots` account — the outcome is decided here, not by Goalana's
 * backend.
 */
export const TXLINE_ORACLE_PROGRAM_ID = "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J"

/** The one sentence that separates us from every "trustless" claim in the field. */
export const TRUST_STATEMENT =
  "No admin decides the winner. When a match ends, a TxLINE Merkle proof is verified on-chain inside the settle_market transaction — a wrong or tampered proof reverts the transaction, so the money can only move on a proof the oracle program itself accepts."

/** The full protocol lifecycle, house-created markets → trustless settlement → claim. */
export const LIFECYCLE_STEPS: Array<{ key: string; label: string; detail: string; trust?: boolean }> = [
  { key: "create", label: "Create", detail: "House opens on-chain markets for a real TxLINE World Cup fixture." },
  { key: "bet", label: "Bet", detail: "Anyone stakes devnet SOL into a pari-mutuel YES/NO pool." },
  { key: "lock", label: "Lock", detail: "Betting closes at kickoff; the pool is frozen on-chain." },
  { key: "settle", label: "Settle", detail: "settle_market CPIs into TxLINE's oracle and verifies a Merkle proof on-chain.", trust: true },
  { key: "claim", label: "Claim", detail: "Winners pull their share of the pool; losers' stake is redistributed." },
]
