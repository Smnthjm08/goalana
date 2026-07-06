import * as anchor from "@coral-xyz/anchor"
import { type GoalanaProgram } from "../target/types/goalana_program.ts"

describe("goalana", () => {
  const provider = anchor.AnchorProvider.env()
  anchor.setProvider(provider)

  const program = anchor.workspace
    .GoalanaProgram as anchor.Program<GoalanaProgram>

  it("Creates a market", async () => {
    const fixtureId = new anchor.BN("844424948319266");

const marketType = {
  publicOrderbook: {},
};

const predicate = {
  statAKey: 1,
  statBKey: null,
  op: null,
  threshold: 1,
  comparison: {
    equal: {},
  },
};

const predicateSeed = Uint8Array.from([1, 0, 0, 0, 0, 0, 0, 0]);

await program.methods
  .createMarket(
    fixtureId,
    marketType,
    predicate,
    predicateSeed
  )
  .accountsPartial({
    creator: provider.wallet.publicKey,
  })
  .rpc();
})
})
