import { Connection, Keypair, SystemProgram } from "@solana/web3.js";
import { AnchorProvider, Wallet } from "@coral-xyz/anchor";
import fs from "fs";
import path from "path";
import { getGoalanaProgram } from "../src/client.js";
import { getConfigPda } from "../src/pdas.js";

async function main() {
  console.log("Starting Goalana Config Initialization...");

  // 1. Setup connection (Devnet)
  const connection = new Connection("https://api.devnet.solana.com", "confirmed");

  // 2. Load devnet-wallet.json from the workspace root
  const walletPath = path.resolve(process.cwd(), "devnet-wallet.json");
  if (!fs.existsSync(walletPath)) {
    throw new Error(`devnet-wallet.json not found at ${walletPath}. Make sure you run the script from the workspace root or place the file correctly.`);
  }

  const secretKey = JSON.parse(fs.readFileSync(walletPath, "utf-8"));
  const keypair = Keypair.fromSecretKey(new Uint8Array(secretKey));
  const wallet = new Wallet(keypair);

  console.log(`Loaded wallet public key: ${wallet.publicKey.toBase58()}`);

  // 3. Setup Anchor Provider and Program
  const provider = new AnchorProvider(connection, wallet, {
    commitment: "confirmed",
  });
  const program = getGoalanaProgram(provider);

  // 4. Derive config PDA
  const [configPda] = getConfigPda();
  console.log(`Config PDA derived: ${configPda.toBase58()}`);

  // 5. Check if config PDA already exists
  const accountInfo = await connection.getAccountInfo(configPda);
  if (accountInfo !== null) {
    console.log("Goalana Config PDA is already initialized.");
    return;
  }

  // 6. Initialize Config
  console.log("Config PDA not found. Initializing config on-chain...");
  try {
    const txSig = await program.methods
      .initializeConfig()
      .accounts({
        admin: wallet.publicKey,
        config: configPda,
        systemProgram: SystemProgram.programId,
      } as any)
      .rpc();

    console.log(`Initialization transaction successful! Signature: ${txSig}`);
  } catch (error) {
    console.error("Failed to initialize config:", error);
    process.exit(1);
  }
}

main();
