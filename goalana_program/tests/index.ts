import * as anchor from "@coral-xyz/anchor";
import { type GoalanaProgram } from "../target/types/goalana_program.ts";
import crypto from "crypto";
import { expect } from "chai";

type PredicateInput = {
  statAKey: number;
  statBKey: number | null;
  op: { add: {} } | { subtract: {} } | null;
  threshold: number;
  comparison:
  | { greaterThan: {} }
  | { greaterThanOrEqual: {} }
  | { lessThan: {} }
  | { lessThanOrEqual: {} }
  | { equal: {} }
  | { notEqual: {} };
};

const serializePredicate = (predicate: PredicateInput) => {
  const bytes = Buffer.alloc(16);

  bytes.writeUInt32LE(predicate.statAKey, 0);
  bytes.writeUInt8(predicate.statBKey === null ? 0 : 1, 4);

  if (predicate.statBKey !== null) {
    bytes.writeUInt32LE(predicate.statBKey, 5);
  }

  bytes.writeUInt8(predicate.op === null ? 0 : 1, 9);

  if (predicate.op !== null) {
    bytes.writeUInt8("add" in predicate.op ? 0 : 1, 10);
  }

  bytes.writeInt32LE(predicate.threshold, 11);

  const comparisonIndex =
    "greaterThan" in predicate.comparison
      ? 0
      : "greaterThanOrEqual" in predicate.comparison
        ? 1
        : "lessThan" in predicate.comparison
          ? 2
          : "lessThanOrEqual" in predicate.comparison
            ? 3
            : "equal" in predicate.comparison
              ? 4
              : 5;

  bytes.writeUInt8(comparisonIndex, 15);

  return bytes;
};

describe("goalana", () => {
  const provider = anchor.AnchorProvider.env();
  anchor.setProvider(provider);

  const program = anchor.workspace.GoalanaProgram as anchor.Program<GoalanaProgram>;

  it("derives the expected predicate hash and market PDA", async () => {
    const fixtureId = 42;
    const predicate: PredicateInput = {
      statAKey: 7,
      statBKey: 11,
      op: { add: {} },
      threshold: 19,
      comparison: { greaterThanOrEqual: {} },
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
      statBKey: 11,
      op: { add: {} },
      threshold: 19,
      comparison: { greaterThanOrEqual: {} },
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

    const instruction = await program.methods
      .createMarket(
        new anchor.BN(fixtureId),
        predicate,
        [...predicateHash],
        locksAt,
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
      statBKey: 11,
      op: { add: {} },
      threshold: 19,
      comparison: { greaterThanOrEqual: {} },
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
      statBKey: 11,
      op: { add: {} },
      threshold: 19,
      comparison: { greaterThanOrEqual: {} },
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
        statAKey: 7, statBKey: 11, op: { add: {} }, threshold: 19, comparison: { greaterThanOrEqual: {} }
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

      await program.methods
        .createMarket(new anchor.BN(fixtureId), predicate, [...predicateHash], locksAt)
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

    it("succeeds to create market if locks_at > now", async () => {
      const now = Math.floor(Date.now() / 1000);
      const marketPda = await createMarketWithLocksAt(baseFixtureId + 103, now + 3600);
      const market = await program.account.market.fetch(marketPda);
      expect(market.locksAt.toNumber()).to.equal(now + 3600);
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
