import { AnchorProvider, BN, Wallet } from "@coral-xyz/anchor";
import { Connection, Keypair, SystemProgram } from "@solana/web3.js";
import {
  getGoalanaProgram,
  getConfigPda,
  getMarketPda,
  derivePredicateHash,
  type Predicate,
} from "@workspace/goalana-sdk";
import bs58 from "bs58";
import { logger } from "../utils/logger";

// Ensure SOLANA_RPC_URL and WALLET_PRIVATE_KEY are set
const connection = new Connection(process.env.SOLANA_RPC_URL!);

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
