import { PublicKey } from "@solana/web3.js";
import { GOALANA_PROGRAM_ID } from "./constants.js";

/**
 * Derives the single global `ProtocolConfig` PDA.
 *
 * Seeds: [b"config"]
 */
export function getConfigPda(): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from("config")],
    GOALANA_PROGRAM_ID
  );
}

/**
 * Derives the `Market` PDA for a given fixture + predicate hash.
 *
 * Seeds: [b"market", fixture_id (i64 le), predicate_hash (32 bytes)]
 */
export function getMarketPda(
  fixtureId: bigint,
  predicateHash: Uint8Array
): [PublicKey, number] {
  const fixtureIdBytes = Buffer.alloc(8);
  fixtureIdBytes.writeBigInt64LE(fixtureId); // little-endian

  return PublicKey.findProgramAddressSync(
    [Buffer.from("market"), fixtureIdBytes, predicateHash],
    GOALANA_PROGRAM_ID
  );
}

