// ── Goalana SDK ──────────────────────────────────────────────────────────────
//
// Re-exports everything consumers need to interact with the Goalana on-chain
// program using @solana/kit (web3.js 2.0).
//
// Usage:
//   import { createGoalanaClient, getMarketPda, GOALANA_PROGRAM_ID } from "@workspace/goalana-sdk";

export * from "./constants";
export * from "./pdas";
export * from "./client";
export * from "./predicate";export * from "./txline-stats";
