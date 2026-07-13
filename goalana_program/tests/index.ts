import * as anchor from "@coral-xyz/anchor";
import { type GoalanaProgram } from "../target/types/goalana_program.ts";
import crypto from "crypto";
import { expect } from "chai";

export interface PredicateInput {
  statAKey: number;
  statBKey: number | null;
  op: { add: {} } | { subtract: {} } | null;
  threshold: number;
  comparison:
  | { greaterThan: {} }
  | { lessThan: {} }
  | { equalTo: {} };
}

function serializePredicate(predicate: PredicateInput): Buffer {
  const opIndex =
    predicate.op === null
      ? 0
      : "add" in predicate.op
        ? 0
        : 1;

  const comparisonIndex =
    "greaterThan" in predicate.comparison
      ? 0
      : "lessThan" in predicate.comparison
        ? 1
        : 2;

  const buffer = Buffer.alloc(18);
  let offset = 0;

  buffer.writeUInt32LE(predicate.statAKey, offset);
  offset += 4;

  if (predicate.statBKey !== null) {
    buffer.writeUInt8(1, offset);
    offset += 1;
    buffer.writeUInt32LE(predicate.statBKey, offset);
    offset += 4;
  } else {
    buffer.writeUInt8(0, offset);
    offset += 1;
  }

  if (predicate.op !== null) {
    buffer.writeUInt8(1, offset);
    offset += 1;
    buffer.writeUInt8(opIndex, offset);
    offset += 1;
  } else {
    buffer.writeUInt8(0, offset);
    offset += 1;
  }

  buffer.writeInt32LE(predicate.threshold, offset);
  offset += 4;

  buffer.writeUInt8(comparisonIndex, offset);
  offset += 1;

  return buffer.slice(0, offset);
}

describe("goalana", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.GoalanaProgram as anchor.Program<GoalanaProgram>;

  it("derives the expected predicate hash and market PDA", async () => {
    const fixtureId = 42;
    const predicate: PredicateInput = {
      statAKey: 7,
      statBKey: 8,
      op: { add: {} },
      threshold: 19,
      comparison: { greaterThan: {} },
    };

    const predicateBytes = serializePredicate(predicate);
    const predicateHash = crypto.createHash("sha256").update(predicateBytes).digest();

    const fixtureIdBytes = Buffer.alloc(8);
    fixtureIdBytes.writeBigInt64LE(BigInt(fixtureId));

    const [expectedMarketPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("market"), fixtureIdBytes, predicateHash],
      program.programId,
    );

    const [expectedConfigPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId,
    );

    expect(predicateHash).to.have.length(32);
    expect(expectedMarketPda).to.be.instanceOf(anchor.web3.PublicKey);
    expect(expectedConfigPda).to.be.instanceOf(anchor.web3.PublicKey);
    expect(expectedMarketPda.equals(expectedConfigPda)).to.equal(false);
  });

  it("builds the createMarket instruction with the correct accounts", async () => {
    const fixtureId = 42;
    const predicate: PredicateInput = {
      statAKey: 7,
      statBKey: 8,
      op: { add: {} },
      threshold: 19,
      comparison: { greaterThan: {} },
    };

    const predicateBytes = serializePredicate(predicate);
    const predicateHash = crypto.createHash("sha256").update(predicateBytes).digest();

    const fixtureIdBytes = Buffer.alloc(8);
    fixtureIdBytes.writeBigInt64LE(BigInt(fixtureId));

    const [marketPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("market"), fixtureIdBytes, predicateHash],
      program.programId,
    );

    const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId,
    );

    const locksAt = new anchor.BN(Math.floor(Date.now() / 1000) + 3600);
    const settleAfter = new anchor.BN(Math.floor(Date.now() / 1000) + 7200);

    const instruction = await program.methods
      .createMarket(
        new anchor.BN(fixtureId),
        predicate,
        [...predicateHash],
        locksAt,
        settleAfter,
      )
      .instruction();

    expect(instruction.programId.equals(program.programId)).to.equal(true);
    expect(instruction.keys).to.have.length(4);
    const marketKey = instruction.keys[0]!;
    const configKey = instruction.keys[1]!;
    const creatorKey = instruction.keys[2]!;
    const systemProgramKey = instruction.keys[3]!;

    expect(marketKey.pubkey.equals(marketPda)).to.equal(true);
    expect(marketKey.isWritable).to.equal(true);
    expect(configKey.pubkey.equals(configPda)).to.equal(true);
    expect(configKey.isWritable).to.equal(false);
    expect(creatorKey.pubkey.equals(provider.wallet.publicKey)).to.equal(true);
    expect(creatorKey.isSigner).to.equal(true);
    expect(creatorKey.isWritable).to.equal(true);
    expect(systemProgramKey.pubkey.equals(anchor.web3.SystemProgram.programId)).to.equal(true);
    expect(systemProgramKey.isSigner).to.equal(false);
    expect(systemProgramKey.isWritable).to.equal(false);
    expect(instruction.data.length).to.be.greaterThan(8);
  });

  it("builds the lockMarket instruction with the correct accounts", async () => {
    const fixtureId = 42;
    const predicate: PredicateInput = {
      statAKey: 7,
      statBKey: 8,
      op: { add: {} },
      threshold: 19,
      comparison: { greaterThan: {} },
    };

    const predicateBytes = serializePredicate(predicate);
    const predicateHash = crypto.createHash("sha256").update(predicateBytes).digest();

    const fixtureIdBytes = Buffer.alloc(8);
    fixtureIdBytes.writeBigInt64LE(BigInt(fixtureId));

    const [marketPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("market"), fixtureIdBytes, predicateHash],
      program.programId,
    );

    const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId,
    );

    const instruction = await program.methods
      .lockMarket()
      .accounts({
        market: marketPda,
      })
      .instruction();

    expect(instruction.programId.equals(program.programId)).to.equal(true);
    expect(instruction.keys).to.have.length(3);
    const marketKey = instruction.keys[0]!;
    const configKey = instruction.keys[1]!;
    const authorityKey = instruction.keys[2]!;

    expect(marketKey.pubkey.equals(marketPda)).to.equal(true);
    expect(marketKey.isWritable).to.equal(true);
    expect(configKey.pubkey.equals(configPda)).to.equal(true);
    expect(configKey.isWritable).to.equal(false);
    expect(authorityKey.pubkey.equals(provider.wallet.publicKey)).to.equal(true);
    expect(authorityKey.isSigner).to.equal(true);
    expect(authorityKey.isWritable).to.equal(false);
    expect(instruction.data.length).to.be.greaterThan(0);
  });

  it("builds the cancelMarket instruction with the correct accounts", async () => {
    const fixtureId = 42;
    const predicate: PredicateInput = {
      statAKey: 7,
      statBKey: 8,
      op: { add: {} },
      threshold: 19,
      comparison: { greaterThan: {} },
    };

    const predicateBytes = serializePredicate(predicate);
    const predicateHash = crypto.createHash("sha256").update(predicateBytes).digest();

    const fixtureIdBytes = Buffer.alloc(8);
    fixtureIdBytes.writeBigInt64LE(BigInt(fixtureId));

    const [marketPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("market"), fixtureIdBytes, predicateHash],
      program.programId,
    );

    const [configPda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("config")],
      program.programId,
    );

    const instruction = await program.methods
      .cancelMarket()
      .accounts({
        market: marketPda,
      })
      .instruction();

    expect(instruction.programId.equals(program.programId)).to.equal(true);
    expect(instruction.keys).to.have.length(3);
    const marketKey = instruction.keys[0]!;
    const configKey = instruction.keys[1]!;
    const authorityKey = instruction.keys[2]!;

    expect(marketKey.pubkey.equals(marketPda)).to.equal(true);
    expect(marketKey.isWritable).to.equal(true);
    expect(configKey.pubkey.equals(configPda)).to.equal(true);
    expect(configKey.isWritable).to.equal(false);
    expect(authorityKey.pubkey.equals(provider.wallet.publicKey)).to.equal(true);
    expect(authorityKey.isSigner).to.equal(true);
    expect(authorityKey.isWritable).to.equal(false);
    expect(instruction.data.length).to.be.greaterThan(0);
  });

  describe("rpc execution", () => {
    let unauthorizedWallet: anchor.web3.Keypair;
    const baseFixtureId = Math.floor(Math.random() * 1000000);

    before(async () => {
      unauthorizedWallet = anchor.web3.Keypair.generate();

      const sig = await provider.connection.requestAirdrop(unauthorizedWallet.publicKey, 1000000000);
      const latestBlockHash = await provider.connection.getLatestBlockhash();
      await provider.connection.confirmTransaction({
        blockhash: latestBlockHash.blockhash,
        lastValidBlockHeight: latestBlockHash.lastValidBlockHeight,
        signature: sig,
      });

      try {
        await program.methods.initializeConfig().rpc();
      } catch (e) {
        console.error("Initialize config failed:", e);
      }
    });

    const createMarketWithLocksAt = async (fixtureId: number, locksAtTime: number) => {
      const predicate: PredicateInput = {
        statAKey: 7, statBKey: 8, op: { add: {} }, threshold: 19, comparison: { greaterThan: {} }
      };
      const predicateBytes = serializePredicate(predicate);
      const predicateHash = crypto.createHash("sha256").update(predicateBytes).digest();
      const fixtureIdBytes = Buffer.alloc(8);
      fixtureIdBytes.writeBigInt64LE(BigInt(fixtureId));

      const [marketPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("market"), fixtureIdBytes, predicateHash],
        program.programId,
      );

      const locksAt = new anchor.BN(locksAtTime);
      const settleAfter = new anchor.BN(locksAtTime + 3600);

      await program.methods
        .createMarket(new anchor.BN(fixtureId), predicate, [...predicateHash], locksAt, settleAfter)
        .rpc();

      return marketPda;
    };

    it("fails to create market if locks_at < now", async () => {
      const now = Math.floor(Date.now() / 1000);
      try {
        await createMarketWithLocksAt(baseFixtureId + 101, now - 100);
        expect.fail("Should have thrown InvalidLockTime");
      } catch (e: any) {
        if (e.name === "AssertionError") throw e;
        expect(e.message).to.include("InvalidLockTime");
      }
    });

    it("fails to create market if locks_at == now", async () => {
      // Fetch the on-chain time to avoid clock desync issues
      const slot = await provider.connection.getSlot();
      const onChainNow = await provider.connection.getBlockTime(slot);

      try {
        await createMarketWithLocksAt(baseFixtureId + 102, onChainNow!);
        expect.fail("Should have thrown InvalidLockTime");
      } catch (e: any) {
        if (e.name === "AssertionError") throw e;
        expect(e.message).to.include("InvalidLockTime");
      }
    });

    it("fails to create market if settle_after <= locks_at", async () => {
      const now = Math.floor(Date.now() / 1000);
      const fixtureId = baseFixtureId + 108;
      const predicate: PredicateInput = {
        statAKey: 7, statBKey: 8, op: { add: {} }, threshold: 19, comparison: { greaterThan: {} }
      };
      const predicateBytes = serializePredicate(predicate);
      const predicateHash = crypto.createHash("sha256").update(predicateBytes).digest();

      const locksAt = new anchor.BN(now + 3600);
      const settleAfter = new anchor.BN(now + 3600); // Equal to locksAt

      try {
        await program.methods
          .createMarket(new anchor.BN(fixtureId), predicate, [...predicateHash], locksAt, settleAfter)
          .rpc();
        expect.fail("Should have thrown InvalidSettlementTime");
      } catch (e: any) {
        if (e.name === "AssertionError") throw e;
        expect(e.message).to.include("InvalidSettlementTime");
      }
    });

    it("succeeds to create market if locks_at > now", async () => {
      const now = Math.floor(Date.now() / 1000);
      const marketPda = await createMarketWithLocksAt(baseFixtureId + 103, now + 3600);
      const market = await program.account.market.fetch(marketPda);
      expect(market.locksAt.toNumber()).to.equal(now + 3600);
      expect(market.settleAfter.toNumber()).to.equal(now + 7200);
    });

    it("Open -> Locked -> success", async () => {
      const now = Math.floor(Date.now() / 1000);
      const marketPda = await createMarketWithLocksAt(baseFixtureId + 104, now + 3600);

      await program.methods.lockMarket().accounts({ market: marketPda }).rpc();

      const market = await program.account.market.fetch(marketPda);
      expect(market.status).to.have.property("locked");
      expect(market.lockedAt).to.not.be.null;
    });

    it("Locked -> Locked -> fail", async () => {
      const now = Math.floor(Date.now() / 1000);
      const marketPda = await createMarketWithLocksAt(baseFixtureId + 105, now + 3600);

      await program.methods.lockMarket().accounts({ market: marketPda }).rpc();

      try {
        await program.methods.lockMarket().accounts({ market: marketPda }).rpc();
        expect.fail("Should have thrown MarketNotOpen");
      } catch (e: any) {
        expect(e.message).to.include("MarketNotOpen");
      }
    });

    it("Cancelled -> Locked -> fail", async () => {
      const now = Math.floor(Date.now() / 1000);
      const marketPda = await createMarketWithLocksAt(baseFixtureId + 106, now + 3600);

      await program.methods.cancelMarket().accounts({ market: marketPda }).rpc();

      try {
        await program.methods.lockMarket().accounts({ market: marketPda }).rpc();
        expect.fail("Should have thrown MarketNotOpen");
      } catch (e: any) {
        expect(e.message).to.include("MarketNotOpen");
      }
    });

    it("Unauthorized wallet -> Locked -> fail", async () => {
      const now = Math.floor(Date.now() / 1000);
      const marketPda = await createMarketWithLocksAt(baseFixtureId + 107, now + 3600);

      try {
        await program.methods.lockMarket()
          .accounts({ market: marketPda, authority: unauthorizedWallet.publicKey })
          .signers([unauthorizedWallet])
          .rpc();
        expect.fail("Should have thrown UnauthorizedMarketAuthority");
      } catch (e: any) {
        if (e.name === "AssertionError") throw e;
        expect(e.message).to.include("UnauthorizedMarketAuthority");
      }
    });
  });

});
