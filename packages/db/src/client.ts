import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import dotenv from "dotenv";

dotenv.config({ path: "../../.env" });

const databaseUrl = process.env.DATABASE_URL;

if (!databaseUrl) {
    throw new Error("DATABASE_URL is not defined");
}

import pg from "pg";

const globalForPrisma = globalThis as unknown as {
    prisma: PrismaClient;
};

export const prisma =
    globalForPrisma.prisma ||
    (() => {
        // Only initialize the pool and adapter once per process
        const pool = new pg.Pool({ connectionString: databaseUrl });
        const adapter = new PrismaPg(pool);
        return new PrismaClient({ adapter });
    })();

if (process.env.NODE_ENV !== "production") {
    globalForPrisma.prisma = prisma;
}