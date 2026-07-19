import { PublicKey } from "@solana/web3.js";

/**
 * On-chain address of the deployed Goalana program on Devnet.
 */
export const GOALANA_PROGRAM_ID = new PublicKey(
  "ELiJEqT95P8LzEiTrA86TEXXoLbK61cxxHFevvPDGE42"
);

/**
 * TxLINE's real on-chain oracle program (devnet) — matches
 * `goalana_program/src/txline_cpi.rs`'s `declare_id!` and the devnet entry
 * in `apps/api/src/scripts/activate.ts`'s network config. Settlement CPIs
 * into this program to verify a stat's Merkle proof.
 */
export const TXORACLE_PROGRAM_ID = new PublicKey(
  "6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J"
);

/**
 * PDA seed strings used throughout the Goalana program.
 */
export const SEEDS = {
  CONFIG: "config",
  MARKET: "market",
  VAULT: "vault",
  POSITION: "position",
  CHALLENGE: "challenge",
} as const;

/** PDA seed used by TxLINE's oracle program for its daily scores roots account. */
export const TXORACLE_SEEDS = {
  DAILY_SCORES_ROOTS: "daily_scores_roots",
} as const;
