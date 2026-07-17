/**
 * Records Goalana's proof-integrity evidence to Devnet and persists it.
 *
 * Submits real `validate_stat` transactions against TxLINE's oracle for a
 * finished fixture:
 *   • genuine proofs for goals, corners and yellow cards  → expected ACCEPTED
 *   • the goals proof with a forged value / forged path   → expected REJECTED
 *
 * The result is stored on `Fixture.proofIntegrity` and rendered by the
 * "Proof Integrity" tab. See proof-integrity.service.ts for why this is
 * recorded rather than run live, and why it calls the oracle directly instead
 * of going through settle_market.
 *
 * These transactions are read-only with respect to Goalana — `validate_stat`
 * takes only TxLINE's anchored-roots PDA, so no market, vault or position can
 * be touched. Cost is the signature fee (~5000 lamports) per case.
 *
 * Run (dry-run, sends nothing):  bun src/scripts/record-proof-integrity.ts <fixtureId>
 * Run (send + persist):          bun src/scripts/record-proof-integrity.ts <fixtureId> --execute
 */
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

const { prisma } = await import("@workspace/db");
const { recordProofIntegrity } = await import("../services/proof-integrity.service");
const { connection, serviceKeypair } = await import("../services/goalana.service");

function explorerTx(sig: string) {
  return `https://explorer.solana.com/tx/${sig}?cluster=devnet`;
}

async function main() {
  const args = process.argv.slice(2);
  const execute = args.includes("--execute");
  const fixtureArg = args.find((a) => !a.startsWith("--"));

  const candidates = await prisma.fixture.findMany({
    where: { finalSeq: { not: null } },
    orderBy: { startTime: "desc" },
  });

  if (candidates.length === 0) {
    console.error("No finished fixture available — nothing to prove.");
    process.exit(1);
  }

  const fixture = fixtureArg
    ? candidates.find((f) => String(f.fixtureId) === fixtureArg)
    : candidates[0];

  if (!fixture) {
    console.error(`Fixture ${fixtureArg} not found among finished fixtures:`);
    for (const c of candidates) console.error(`  ${c.fixtureId}  ${c.participant1} v ${c.participant2}`);
    process.exit(1);
  }

  console.log(`\n=== Proof integrity — fixture ${fixture.fixtureId} ===`);
  console.log(`${fixture.participant1} ${fixture.homeScore}–${fixture.awayScore} ${fixture.participant2} (finalSeq ${fixture.finalSeq})`);
  console.log(`Keeper: ${serviceKeypair.publicKey.toBase58()}`);

  const balance = await connection.getBalance(serviceKeypair.publicKey);
  console.log(`Balance: ${(balance / 1e9).toFixed(4)} SOL`);

  if (!execute) {
    console.log("\nDRY RUN — no transactions sent. Would submit:");
    console.log("  • genuine validate_stat: total goals > 1.5        (keys 1+2)");
    console.log("  • genuine validate_stat: total corners > 9.5      (keys 7+8)");
    console.log("  • genuine validate_stat: total yellow cards > 3.5 (keys 3+4)");
    console.log("  • tampered validate_stat: forged goal value");
    console.log("  • tampered validate_stat: forged Merkle path");
    console.log("\nRe-run with --execute to send and persist.");
    await prisma.$disconnect();
    return;
  }

  const artifact = await recordProofIntegrity(fixture.fixtureId);

  console.log(`\n=== Results (${artifact.cases.length} cases) ===`);
  let allAsExpected = true;
  for (const c of artifact.cases) {
    const asExpected =
      (c.expected === "accepted" && c.accepted) || (c.expected === "rejected" && !c.accepted);
    allAsExpected &&= asExpected;
    console.log(`\n${asExpected ? "✅" : "❌"} ${c.id} — expected ${c.expected}`);
    console.log(`   ${c.predicateLabel}`);
    if (c.tamper) console.log(`   tampered: ${c.tamper}`);
    console.log(`   accepted=${c.accepted} outcome=${c.outcome} cu=${c.computeUnits} err=${c.errorName ?? "none"}`);
    console.log(`   ${explorerTx(c.txSignature)}`);
  }

  await prisma.fixture.update({
    where: { fixtureId: fixture.fixtureId },
    data: { proofIntegrity: artifact as unknown as object },
  });

  console.log(`\nPersisted to Fixture.proofIntegrity for ${fixture.fixtureId}.`);
  console.log(allAsExpected ? "All cases behaved as expected. ✅" : "Some cases did NOT behave as expected. ❌");

  await prisma.$disconnect();
  if (!allAsExpected) process.exit(1);
}

main().catch(async (err) => {
  console.error(err);
  await prisma.$disconnect();
  process.exit(1);
});
