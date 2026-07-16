import { AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, PublicKey, SystemProgram } from "@solana/web3.js";
import {
  getGoalanaProgram,
  getConfigPda,
  getMarketPda,
  getVaultPda,
  getPositionPda,
  getDailyScoresRootsPda,
  derivePredicateHash,
  TXORACLE_PROGRAM_ID,
  type Predicate,
} from "@workspace/goalana-sdk";
import bs58 from "bs58";
import { logger } from "../utils/logger";

// Ensure SOLANA_RPC_URL and WALLET_PRIVATE_KEY are set
export const connection = new Connection(process.env.SOLANA_RPC_URL!);

// Handle different private key formats
let keypair: Keypair;
if (process.env.WALLET_PRIVATE_KEY) {
  try {
    // Try base58 first
    const secretKey = bs58.decode(process.env.WALLET_PRIVATE_KEY);
    keypair = Keypair.fromSecretKey(secretKey);
  } catch {
    // Fallback to JSON array string
    const secretKey = Uint8Array.from(JSON.parse(process.env.WALLET_PRIVATE_KEY));
    keypair = Keypair.fromSecretKey(secretKey);
  }
} else {
  logger.warn("goalana.service", "WALLET_PRIVATE_KEY is not set. Creating a dummy wallet. Transactions will fail.");
  keypair = Keypair.generate();
}

const wallet = new Wallet(keypair);
const provider = new AnchorProvider(connection, wallet, {
  commitment: "confirmed",
});

const program = getGoalanaProgram(provider);

/**
 * Initializes the global Goalana Protocol Config on-chain if it hasn't been created yet.
 */
export async function initializeGoalanaConfig() {
  const [configPda] = getConfigPda();
  
  const accountInfo = await connection.getAccountInfo(configPda);
  if (accountInfo) {
    logger.info("goalana.service", "Config PDA already initialized.");
    return;
  }

  logger.info("goalana.service", "Initializing Config PDA...");
  const tx = await program.methods
    .initializeConfig()
    .rpc();

  logger.success("goalana.service", `Config initialized in tx: ${tx}`);
}

/**
 * Creates a market on Devnet for a given fixture and predicate.
 */
export async function createMarketForFixture(
  fixtureId: bigint,
  predicate: Predicate,
  locksAtDate: Date,
  settleAfterDate: Date
) {
  const predicateHash = derivePredicateHash(predicate);
  const [marketPda] = getMarketPda(fixtureId, predicateHash);
  const [configPda] = getConfigPda();

  const accountInfo = await connection.getAccountInfo(marketPda);
  if (accountInfo) {
    logger.info("goalana.service", `Market for fixture ${fixtureId} already exists. Skipping.`);
    return { marketPda, predicateHash, txSignature: null, alreadyExists: true };
  }

  const locksAt = new BN(Math.floor(locksAtDate.getTime() / 1000));
  const settleAfter = new BN(Math.floor(settleAfterDate.getTime() / 1000));
  
  logger.info("goalana.service", `Creating market for fixture ${fixtureId}...`);

  const txSignature = await program.methods
    .createMarket(
      new BN(fixtureId.toString()),
      predicate,
      [...predicateHash],
      locksAt,
      settleAfter
    )
    .accounts({
      creator: provider.wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  logger.success("goalana.service", `Market created. Signature: ${txSignature}`);
  return { marketPda, predicateHash, txSignature, alreadyExists: false };
}

export type OnChainMarketStatus = "Open" | "Locked" | "Settled" | "Cancelled";

export interface OnChainMarket {
  status: OnChainMarketStatus;
  outcome: boolean | null;
  predicate: Predicate;
  locksAt: number;
  settleAfter: number;
}

function decodeMarketStatus(raw: Record<string, unknown>): OnChainMarketStatus {
  const key = Object.keys(raw)[0] ?? "open";
  return (key.charAt(0).toUpperCase() + key.slice(1)) as OnChainMarketStatus;
}

/**
 * Reads a Market account directly from chain — the source of truth for
 * lock/settlement automation. Postgres's `Market.status` is only a mirror
 * written at creation time; it is never updated by anything other than the
 * lock/settlement callers below, so any decision about *whether* to lock or
 * settle must check the chain first (idempotency against a crashed/partial
 * previous run, or drift from a manual on-chain action).
 */
export async function fetchMarketAccount(marketPda: PublicKey): Promise<OnChainMarket> {
  const account = await program.account.market.fetch(marketPda);

  return {
    status: decodeMarketStatus(account.status as unknown as Record<string, unknown>),
    outcome: (account.outcome as boolean | null) ?? null,
    predicate: account.predicate as unknown as Predicate,
    locksAt: Number(account.locksAt),
    settleAfter: Number(account.settleAfter),
  };
}

/**
 * Locks a Market on-chain (Open -> Locked). Authority-gated by the program
 * itself (`config.market_authority`) — this wallet is already that
 * authority since it's the one that created the market.
 */
export async function lockMarketOnChain(marketPda: PublicKey): Promise<{ txSignature: string }> {
  const [configPda] = getConfigPda();

  const txSignature = await program.methods
    .lockMarket()
    .accountsPartial({
      market: marketPda,
      config: configPda,
      authority: provider.wallet.publicKey,
    })
    .rpc();

  return { txSignature };
}

/**
 * Cancels a Market on-chain (Open or Locked -> Cancelled). Authority-gated,
 * same as lock — the program takes no proof and unconditionally flips
 * status, enabling refunds via claim_refund for any positions already
 * placed.
 */
export async function cancelMarketOnChain(marketPda: PublicKey): Promise<{ txSignature: string }> {
  const [configPda] = getConfigPda();

  const txSignature = await program.methods
    .cancelMarket()
    .accountsPartial({
      market: marketPda,
      config: configPda,
      authority: provider.wallet.publicKey,
    })
    .rpc();

  return { txSignature };
}

/**
 * Places a bet on-chain from the service wallet. Betting is normally a
 * client-side (user-signed) action; this server-side variant exists only for
 * scripted end-to-end validation (e.g. seeding a fully-settled demo market and
 * exercising the real claim_winnings payout path on Devnet).
 */
export async function placeBetOnChain(
  marketPda: PublicKey,
  side: "yes" | "no",
  lamports: number
): Promise<{ txSignature: string }> {
  const [vaultPda] = getVaultPda(marketPda);
  const [positionPda] = getPositionPda(marketPda, provider.wallet.publicKey);

  const txSignature = await program.methods
    .placeBet(side === "yes" ? { yes: {} } : { no: {} }, new BN(lamports))
    .accountsPartial({
      market: marketPda,
      vault: vaultPda,
      position: positionPda,
      user: provider.wallet.publicKey,
      systemProgram: SystemProgram.programId,
    })
    .rpc();

  return { txSignature };
}

/**
 * Claims winnings on-chain from the service wallet — the counterpart to the
 * scripted `placeBetOnChain` above. Used to validate the real win-payout math
 * on Devnet end-to-end (create → bet → lock → settle → claim).
 */
export async function claimWinningsOnChain(
  marketPda: PublicKey
): Promise<{ txSignature: string }> {
  const [vaultPda] = getVaultPda(marketPda);
  const [positionPda] = getPositionPda(marketPda, provider.wallet.publicKey);

  const txSignature = await program.methods
    .claimWinnings()
    .accountsPartial({
      market: marketPda,
      vault: vaultPda,
      position: positionPda,
      user: provider.wallet.publicKey,
    })
    .rpc();

  return { txSignature };
}

export interface SettleMarketParams {
  marketPda: PublicKey;
  oracleTsMs: BN;
  fixtureSummary: {
    fixtureId: BN;
    updateStats: {
      updateCount: number;
      minTimestamp: BN;
      maxTimestamp: BN;
    };
    eventsSubTreeRoot: number[];
  };
  fixtureProof: Array<{ hash: number[]; isRightSibling: boolean }>;
  mainTreeProof: Array<{ hash: number[]; isRightSibling: boolean }>;
  statA: {
    statToProve: { key: number; value: number; period: number };
    eventStatRoot: number[];
    statProof: Array<{ hash: number[]; isRightSibling: boolean }>;
  };
  statB: SettleMarketParams["statA"] | null;
}

/**
 * Submits `settle_market` — permissionless on the program side, but this is
 * Goalana's automated caller (per the hackathon design: the backend fetches
 * TxLINE's proof and calls settlement itself once a fixture is final). The
 * CPI into TxLINE's real oracle program (`txoracle_program` +
 * `daily_scores_merkle_roots`, derived from the proof's own oracle
 * timestamp) is what actually verifies the Merkle proof — this function
 * only handles the plumbing.
 */
export async function settleMarketOnChain(
  params: SettleMarketParams
): Promise<{ txSignature: string; outcome: boolean | null }> {
  const oracleTsMs = params.oracleTsMs.toNumber();
  const [dailyScoresMerkleRoots] = getDailyScoresRootsPda(oracleTsMs);

  const txSignature = await program.methods
    .settleMarket(
      params.oracleTsMs,
      params.fixtureSummary,
      params.fixtureProof,
      params.mainTreeProof,
      params.statA,
      params.statB
    )
    .accountsPartial({
      market: params.marketPda,
      txoracleProgram: TXORACLE_PROGRAM_ID,
      dailyScoresMerkleRoots,
    })
    .rpc();

  const updated = await program.account.market.fetch(params.marketPda);

  return { txSignature, outcome: (updated.outcome as boolean | null) ?? null };
}
