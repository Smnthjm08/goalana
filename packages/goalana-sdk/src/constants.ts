import { PublicKey } from "@solana/web3.js";

/**
 * On-chain address of the deployed Goalana program on Devnet.
 */
export const GOALANA_PROGRAM_ID = new PublicKey(
  "AgxqK6wRkFKyabyArNiJF8dpoJ6TNLLxPnV5rg27pRQu"
);

/**
 * PDA seed strings used throughout the Goalana program.
 */
export const SEEDS = {
  CONFIG: "config",
  MARKET: "market",
  VAULT: "vault",
  POSITION: "position",
} as const;
