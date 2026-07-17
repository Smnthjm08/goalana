import * as anchor from "@coral-xyz/anchor";
import type { Txoracle } from "./types/txoracle";
import txoracleIdl from "./idl/txoracle.json";
import {
    ASSOCIATED_TOKEN_PROGRAM_ID,
    TOKEN_2022_PROGRAM_ID,
    getAssociatedTokenAddressSync,
} from "@solana/spl-token";
import { Connection, PublicKey, SystemProgram } from "@solana/web3.js";
import axios from "axios";
import nacl from "tweetnacl";
import path from "path";

// ---- 1. Pick network (must match RPC, program, mint, JWT origin, activation endpoint) ----
const NETWORK: "mainnet" | "devnet" = "devnet"; // start on devnet to test safely

const CONFIG = {
    mainnet: {
        rpcUrl: "https://api.mainnet-beta.solana.com",
        apiOrigin: "https://txline.txodds.com",
        programId: new PublicKey("9ExbZjAapQww1vfcisDmrngPinHTEfpjYRWMunJgcKaA"),
        txlTokenMint: new PublicKey("Zhw9TVKp68a1QrftncMSd6ELXKDtpVMNuMGr1jNwdeL"),
    },
    devnet: {
        rpcUrl: "https://api.devnet.solana.com",
        apiOrigin: "https://txline-dev.txodds.com",
        programId: new PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J"),
        txlTokenMint: new PublicKey("4Zao8ocPhmMgq7PdsYWyxvqySMGx7xb9cMftPMkEokRG"),
    },
} as const;

const { rpcUrl, apiOrigin, programId, txlTokenMint } = CONFIG[NETWORK];
const apiBaseUrl = `${apiOrigin}/api`;

async function main(wallet: anchor.Wallet) {
    const connection = new Connection(rpcUrl, "confirmed");
    const provider = new anchor.AnchorProvider(connection, wallet, { commitment: "confirmed" });
    anchor.setProvider(provider);

    const program = new anchor.Program<Txoracle>(txoracleIdl as Txoracle, provider);

    if (!program.programId.equals(programId)) {
        throw new Error(`IDL program ${program.programId.toBase58()} != ${NETWORK} program ${programId.toBase58()}`);
    }

    // ---- 2. Subscribe on-chain ----
    const [tokenTreasuryPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("token_treasury_v2")],
        program.programId
    );
    const tokenTreasuryVault = getAssociatedTokenAddressSync(
        txlTokenMint, tokenTreasuryPda, true, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
    );
    const [pricingMatrixPda] = PublicKey.findProgramAddressSync(
        [Buffer.from("pricing_matrix")],
        program.programId
    );
    const userTokenAccount = getAssociatedTokenAddressSync(
        txlTokenMint, provider.wallet.publicKey, false, TOKEN_2022_PROGRAM_ID, ASSOCIATED_TOKEN_PROGRAM_ID
    );

    const SERVICE_LEVEL_ID = 1;      // e.g. 1 = standard, 3 = custom leagues, 1/12 = free World Cup tiers
    const DURATION_WEEKS = 4;
    const SELECTED_LEAGUES: number[] = []; // leave empty for standard bundle

    const txSig = await program.methods
        .subscribe(SERVICE_LEVEL_ID, DURATION_WEEKS)
        .accounts({
            user: provider.wallet.publicKey,
            pricingMatrix: pricingMatrixPda,
            tokenMint: txlTokenMint,
            userTokenAccount,
            tokenTreasuryVault,
            tokenTreasuryPda,
            tokenProgram: TOKEN_2022_PROGRAM_ID,
            associatedTokenProgram: ASSOCIATED_TOKEN_PROGRAM_ID,
            systemProgram: SystemProgram.programId,
        })
        .rpc();

    console.log("Subscribed, tx:", txSig);

    // ---- 3. Get a guest JWT ----
    const authResponse = await axios.post(`${apiOrigin}/auth/guest/start`);
    const jwt: string = authResponse.data.token;

    // ---- 4. Sign the activation message ----
    const messageString = `${txSig}:${SELECTED_LEAGUES.join(",")}:${jwt}`;
    //    @ts-ignore
    const message = new TextEncoder().encode(messageString);

    async function signActivationMessage(msg: Uint8Array): Promise<Uint8Array> {
        if ("signMessage" in wallet && (wallet as any).signMessage) {
            return (wallet as any).signMessage(msg);
        }
        const localPayer = (provider.wallet as anchor.Wallet & { payer?: anchor.web3.Keypair }).payer;
        if (localPayer) {
            return nacl.sign.detached(msg, localPayer.secretKey);
        }
        throw new Error("Wallet must support signMessage, or run with a local Anchor payer.");
    }

    const signatureBytes = await signActivationMessage(message);
    const walletSignature = Buffer.from(signatureBytes).toString("base64");

    // ---- 5. Activate the API token ----
    const activationResponse = await axios.post(
        `${apiBaseUrl}/token/activate`,
        { txSig, walletSignature, leagues: SELECTED_LEAGUES },
        { headers: { Authorization: `Bearer ${jwt}` } }
    );

    const apiToken = activationResponse.data.token || activationResponse.data;

    // Full credentials go to a gitignored local file, not stdout — this script
    // is run interactively and a plaintext JWT/token in scrollback or a
    // recorded terminal session is a real leak vector for a live TxLINE key.
    const outPath = path.resolve(import.meta.dirname, "../../.env.activation.local");
    fs.writeFileSync(outPath, `TXLINE_JWT=${jwt}\nTXLINE_API_TOKEN=${apiToken}\n`, { mode: 0o600 });
    const mask = (v: string) => `${v.slice(0, 6)}...${v.slice(-4)}`;
    console.log(`Activation succeeded. JWT ${mask(jwt)}, API token ${mask(apiToken)}.`);
    console.log(`Full values written to ${outPath} — copy into .env then delete this file.`);

    // ---- 6. Use both on data API requests ----
    // headers: {
    //   Authorization: `Bearer ${jwt}`,
    //   "X-Api-Token": apiToken
    // }

    return { jwt, apiToken };
}

import fs from "fs";
import { Keypair } from "@solana/web3.js";

// Load devnet keypair
const secretKey = JSON.parse(fs.readFileSync("./devnet-wallet.json", "utf-8"));
const keypair = Keypair.fromSecretKey(new Uint8Array(secretKey));
const wallet = new anchor.Wallet(keypair);

main(wallet).catch(console.error);