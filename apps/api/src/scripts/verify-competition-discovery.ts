import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import { getActiveCompetitionId } from "../config/competition.js";
import { logger } from "../utils/logger.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
dotenv.config({ path: path.resolve(__dirname, "../../../../.env") });

async function run() {
  const id = await getActiveCompetitionId();
  logger.success("verify-competition-discovery", `Resolved active competition id: ${id}`);
  process.exit(0);
}

run();
