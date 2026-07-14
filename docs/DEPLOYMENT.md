# Goalana VM Manual Deployment Guide

This guide covers deploying the Goalana backend API (`apps/api`) manually to a Virtual Machine (e.g., AWS EC2, DigitalOcean Droplet) using Bun and PM2.

## 1. Prerequisites on the VM

Make sure you have **Bun** and **Git** installed on your VM.

```bash
# Install Bun
curl -fsSL https://bun.sh/install | bash
```

## 2. Clone and Install

SSH into your VM, clone your repository, and install the monorepo dependencies.

```bash
git clone <your-repo-url>
cd goalana

# Install all dependencies across the monorepo
bun install
```

## 3. Set up Environment Variables

Create your `.env` file on the VM. You can copy the structure from your local environment. 

> [!CAUTION]
> **Never commit `.env` or `.env.production` files containing real secrets to version control.** Always inject them securely on the server.

```bash
nano .env
# Paste your production env vars (DATABASE_URL, SOLANA_RPC_URL, WALLET_PRIVATE_KEY, etc.)
```

## 4. Run Production Migrations

Apply your Prisma schema to the production database safely using the `migrate:deploy` command.

```bash
cd packages/db
bun run migrate:deploy
cd ../../
```

## 5. Start the API Server

For a VM, you should use a process manager like **PM2** so the server stays running in the background and restarts automatically if it crashes or the server reboots.

```bash
# Install pm2 globally
bun add -g pm2

# Start the API using Bun through PM2
pm2 start "bun run start" --name "goalana-api" --cwd "./apps/api"

# Save the PM2 process list so it restarts on server reboots
pm2 save
pm2 startup
```

---

## 6. Verifying the Solana Anchor Wallet Key

If you are passing the `WALLET_PRIVATE_KEY` as a JSON byte array string in your `.env` (e.g., `WALLET_PRIVATE_KEY='[190,65,244,...]'`), you can quickly verify that it is properly formatted and ready for the Anchor program by running a small script.

Create a temporary script to test parsing the key into a valid Solana Keypair:

```bash
# Create a test script
cat << 'EOF' > test-key.ts
import { Keypair } from "@solana/web3.js";
import "dotenv/config";

try {
  // Parse the JSON array string from .env
  const secretKeyString = process.env.WALLET_PRIVATE_KEY;
  if (!secretKeyString) throw new Error("WALLET_PRIVATE_KEY not found in .env");
  
  const secretKeyArray = JSON.parse(secretKeyString);
  const secretKeyUint8 = new Uint8Array(secretKeyArray);
  
  // Attempt to create a Keypair from the parsed secret key
  const keypair = Keypair.fromSecretKey(secretKeyUint8);
  
  console.log("✅ Key is valid!");
  console.log("Public Key:", keypair.publicKey.toBase58());
} catch (error) {
  console.error("❌ Failed to parse key:", error.message);
}
EOF

# Run the script using bun (which automatically loads .env)
bun run test-key.ts

# Delete the script after testing
rm test-key.ts
```

If the script outputs `✅ Key is valid!` along with your expected Public Key, then your `WALLET_PRIVATE_KEY` is correctly formatted for Anchor and `@solana/web3.js` to use in production.
