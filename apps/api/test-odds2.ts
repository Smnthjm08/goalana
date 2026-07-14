import { OddsService } from "@workspace/txline";
import dotenv from "dotenv";
import path from "path";

dotenv.config({ path: path.resolve(__dirname, "../../.env.production") });

async function test() {
  const oddsService = new OddsService();
  const odds = await oddsService.getOddsSnapshots(18241006);
  console.log(JSON.stringify(odds, null, 2));
}

test().catch(console.error);
