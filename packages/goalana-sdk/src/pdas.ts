import { PublicKey } from "@solana/web3.js";
import { GOALANA_PROGRAM_ID, SEEDS, TXORACLE_PROGRAM_ID, TXORACLE_SEEDS } from "./constants";

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

/**
 * Derives the `Vault` PDA that holds a given Market's staked lamports.
 *
 * Seeds: [b"vault", market_pubkey]
 */
export function getVaultPda(market: PublicKey): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.VAULT), market.toBuffer()],
    GOALANA_PROGRAM_ID
  );
}

/**
 * Derives a user's `Position` PDA for a given Market.
 *
 * Seeds: [b"position", market_pubkey, user_pubkey]
 */
export function getPositionPda(
  market: PublicKey,
  user: PublicKey
): [PublicKey, number] {
  return PublicKey.findProgramAddressSync(
    [Buffer.from(SEEDS.POSITION), market.toBuffer(), user.toBuffer()],
    GOALANA_PROGRAM_ID
  );
}

/**
 * Derives TxLINE oracle's `daily_scores_roots` PDA for the day containing a
 * given oracle timestamp (milliseconds since epoch).
 *
 * Mirrors `settle_market.rs`'s derivation exactly: `epoch_day = oracle_ts_ms
 * / 86_400_000` as a little-endian u16. Must match byte-for-byte or the
 * on-chain `settle_market` handler rejects the account with
 * `InvalidOraclePda`.
 *
 * Seeds: [b"daily_scores_roots", epoch_day (u16 le)]
 */
export function getDailyScoresRootsPda(oracleTsMs: number): [PublicKey, number] {
  const epochDay = Math.floor(oracleTsMs / 86_400_000);

  if (epochDay < 0 || epochDay > 0xffff) {
    throw new Error(`epoch_day ${epochDay} out of u16 range for oracleTsMs=${oracleTsMs}`);
  }

  const epochDayBytes = Buffer.alloc(2);
  epochDayBytes.writeUInt16LE(epochDay, 0);

  return PublicKey.findProgramAddressSync(
    [Buffer.from(TXORACLE_SEEDS.DAILY_SCORES_ROOTS), epochDayBytes],
    TXORACLE_PROGRAM_ID
  );
}

