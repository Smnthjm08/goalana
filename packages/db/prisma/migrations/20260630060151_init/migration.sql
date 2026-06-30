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

-- CreateIndex
CREATE UNIQUE INDEX "users_walletAddress_key" ON "users"("walletAddress");
