import { prisma } from "@workspace/db";

export interface WalletUser {
  id: string;
  walletAddress: string;
  displayName: string | null;
  totalWagered: string;
  totalWon: string;
  createdAt: Date;
  lastActiveAt: Date | null;
}

function serialize(user: {
  id: string;
  walletAddress: string;
  displayName: string | null;
  totalWagered: bigint;
  totalWon: bigint;
  createdAt: Date;
  lastActiveAt: Date | null;
}): WalletUser {
  return {
    ...user,
    totalWagered: user.totalWagered.toString(),
    totalWon: user.totalWon.toString(),
  };
}

/**
 * Wallet address is the only identity Goalana has (no email/password) —
 * connecting a wallet either recognizes an existing user or silently
 * registers a new one. Idempotent by design: called on every wallet
 * connect, not just the first one, so it also bumps `lastActiveAt`.
 */
export async function upsertUserForWallet(
  walletAddress: string
): Promise<{ user: WalletUser; isNewUser: boolean }> {
  const existing = await prisma.user.findUnique({ where: { walletAddress } });

  const user = await prisma.user.upsert({
    where: { walletAddress },
    update: { lastActiveAt: new Date() },
    create: { walletAddress, lastActiveAt: new Date() },
  });

  return { user: serialize(user), isNewUser: existing === null };
}
