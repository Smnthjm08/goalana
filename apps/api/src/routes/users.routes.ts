import { Router, type Router as RouterType } from "express";
import { PublicKey } from "@solana/web3.js";

import { upsertUserForWallet } from "../services/user.service";
import { logger } from "../utils/logger";

export const usersRouter: RouterType = Router();

// Wallet is the only identity Goalana has — the frontend calls this right
// after a wallet connects. Upsert-based, so it doubles as both "register a
// new wallet" and "recognize an existing one" in a single idempotent call.
usersRouter.post("/api/users/connect", async (req, res) => {
  try {
    const walletAddress = req.body?.walletAddress;

    if (typeof walletAddress !== "string" || walletAddress.length === 0) {
      return res.status(400).json({ error: "walletAddress is required" });
    }

    try {
      new PublicKey(walletAddress);
    } catch {
      return res.status(400).json({ error: "walletAddress is not a valid Solana address" });
    }

    const { user, isNewUser } = await upsertUserForWallet(walletAddress);

    return res.status(200).json({ data: { user, isNewUser } });
  } catch (error) {
    logger.error("api", "Error registering wallet", error);
    return res.status(500).json({ error: "internal server error" });
  }
});
