import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const TARGET_PROGRAM_ID = "ELiJEqT95P8LzEiTrA86TEXXoLbK61cxxHFevvPDGE42";

// Find workspace root relative to this script: packages/goalana-sdk/scripts/sync-idl.ts -> go up 3 directories
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const workspaceRoot = path.resolve(__dirname, "../../..");

const sourceIdlPath = path.join(workspaceRoot, "goalana_program/target/idl/goalana_program.json");
const sourceTypesPath = path.join(workspaceRoot, "goalana_program/target/types/goalana_program.ts");

const destIdlPath = path.join(workspaceRoot, "packages/goalana-sdk/src/idl/goalana_program.json");
const destTypesPath = path.join(workspaceRoot, "packages/goalana-sdk/src/types/goalana_program.ts");

function syncFile(sourcePath: string, destPath: string, isJson: boolean) {
  if (!fs.existsSync(sourcePath)) {
    console.error(`Source file not found: ${sourcePath}`);
    return;
  }

  console.log(`Syncing ${path.basename(sourcePath)}...`);
  let content = fs.readFileSync(sourcePath, "utf-8");

  // Only the program's own top-level "address" field should be normalized to
  // TARGET_PROGRAM_ID. Instruction accounts can carry their own fixed
  // "address" (e.g. the System Program or the TxOracle program) — a blanket
  // replace would silently corrupt those and break any call that doesn't
  // manually override the account (e.g. initializeConfig()).
  if (isJson) {
    const parsed = JSON.parse(content);
    parsed.address = TARGET_PROGRAM_ID;
    content = JSON.stringify(parsed, null, 2) + "\n";
  } else {
    // TS type declaration: not valid JSON, but the top-level "address" field
    // is always the first occurrence in the file, so a single (non-global)
    // replace is safe without touching nested account addresses.
    const addressRegex = /"address"\s*:\s*"[^"]*"/;
    content = content.replace(addressRegex, `"address": "${TARGET_PROGRAM_ID}"`);
  }

  // Ensure destination directory exists
  fs.mkdirSync(path.dirname(destPath), { recursive: true });
  fs.writeFileSync(destPath, content, "utf-8");
  console.log(`Successfully synced and updated address in: ${destPath}`);
}

async function main() {
  console.log("Syncing up Anchor build artifacts to Goalana SDK...");
  syncFile(sourceIdlPath, destIdlPath, true);
  syncFile(sourceTypesPath, destTypesPath, false);
  console.log("Sync complete!");
}

main().catch(console.error);
