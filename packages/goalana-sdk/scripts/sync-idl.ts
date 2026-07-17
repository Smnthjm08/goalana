import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const TARGET_PROGRAM_ID = "AgxqK6wRkFKyabyArNiJF8dpoJ6TNLLxPnV5rg27pRQu";

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

  // Replace any address field / hardcoded address with the correct Program ID
  // For JSON: "address": "..."
  // For TS helper: "address": "..."
  const addressRegex = /"address"\s*:\s*"[^"]*"/g;
  content = content.replace(addressRegex, `"address": "${TARGET_PROGRAM_ID}"`);

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
