import { prisma } from "@workspace/db";
import { PublicKey } from "@solana/web3.js";
import { fetchMarketAccount, lockMarketOnChain } from "./goalana.service";
import { logger } from "../utils/logger";

/**
 * Locks every Market whose on-chain kickoff (`locksAt`) has passed but is
 * still `Open`. Without this, `place_bet` stays callable on-chain past
 * kickoff indefinitely — see docs/MARKET_LIFECYCLE.md#5-locking.
 *
 * Idempotent: the on-chain Market is re-read before every lock attempt — if
 * it's already Locked/Settled/Cancelled (a previous run succeeded on-chain
 * but crashed before the DB write, or a manual action), this syncs
 * Postgres and skips instead of re-submitting `lock_market` (which would
 * fail on-chain with MarketNotOpen anyway).
 */
export async function lockDueMarkets(): Promise<void> {
  const now = new Date();

  const candidates = await prisma.market.findMany({
    where: {
      status: "OPEN",
      locksAt: { lte: now },
    },
  });

  if (candidates.length === 0) {
    logger.info("lock.service", "No markets due to lock.");
    return;
  }

  logger.info("lock.service", `Locking ${candidates.length} due market(s)...`);

  for (const market of candidates) {
    try {
      const marketPda = new PublicKey(market.marketPda);
      const onChain = await fetchMarketAccount(marketPda);

      if (onChain.status !== "Open") {
        await prisma.market.update({
          where: { id: market.id },
          data: { status: onChain.status.toUpperCase() },
        });
        logger.info(
          "lock.service",
          `Market ${market.marketPda} already ${onChain.status} on-chain — synced DB, skipping.`
        );
        continue;
      }

      const { txSignature } = await lockMarketOnChain(marketPda);

      await prisma.market.update({
        where: { id: market.id },
        data: { status: "LOCKED" },
      });

      logger.success("lock.service", `Locked market ${market.marketPda} (tx ${txSignature})`);
    } catch (error) {
      logger.error("lock.service", `Failed to lock market ${market.marketPda}`, error);
    }
  }
}
