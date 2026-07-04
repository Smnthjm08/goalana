-- CreateEnum
CREATE TYPE "Network" AS ENUM ('MAINNET', 'DEVNET');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "walletAddress" TEXT NOT NULL,
    "displayName" TEXT,
    "totalWagered" BIGINT NOT NULL DEFAULT 0,
    "totalWon" BIGINT NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastLoggedInAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "txline_tokens" (
    "id" TEXT NOT NULL,
    "network" "Network" NOT NULL DEFAULT 'DEVNET',
    "jwt" TEXT NOT NULL,
    "apiToken" TEXT NOT NULL,
    "jwtExpiresAt" TIMESTAMP(3) NOT NULL,
    "subscriptionExpiresAt" TIMESTAMP(3) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "txline_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_walletAddress_key" ON "users"("walletAddress");

-- CreateIndex
CREATE UNIQUE INDEX "txline_tokens_jwt_key" ON "txline_tokens"("jwt");

-- CreateIndex
CREATE UNIQUE INDEX "txline_tokens_apiToken_key" ON "txline_tokens"("apiToken");
