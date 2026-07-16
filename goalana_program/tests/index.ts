import * as anchor from "@coral-xyz/anchor";
import { type GoalanaProgram } from "../target/types/goalana_program.ts";
import crypto from "crypto";
import { expect } from "chai";
import fs from "fs";
import path from "path";

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
  const baseFixtureId = Math.floor(Math.random() * 1000000);

  const txoracleProgramId = new anchor.web3.PublicKey("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");

  function getDailyScoresRootsPda(tsMs: number): anchor.web3.PublicKey {
    const epochDay = Math.floor(tsMs / 86400000);
    const epochDayBuffer = Buffer.alloc(2);
    epochDayBuffer.writeUInt16LE(epochDay, 0);
    const [pda] = anchor.web3.PublicKey.findProgramAddressSync(
      [Buffer.from("daily_scores_roots"), epochDayBuffer],
      txoracleProgramId
    );
    return pda;
  }

  const getOnChainTime = async (): Promise<number> => {
    try {
      const clockPubkey = anchor.web3.SYSVAR_CLOCK_PUBKEY;
      const accountInfo = await provider.connection.getAccountInfo(clockPubkey);
      if (accountInfo) {
        const unixTimestamp = accountInfo.data.readBigInt64LE(32);
        return Number(unixTimestamp);
      }
    } catch (e) {
      console.warn("Failed to fetch Sysvar Clock, falling back to local system clock:", e);
    }
    return Math.floor(Date.now() / 1000);
  };

  const advanceTime = async (seconds: number) => {
    const startClock = await getOnChainTime();
    const targetClock = startClock + seconds;
    while (true) {
      const currentClock = await getOnChainTime();
      if (currentClock >= targetClock) {
        break;
      }
      const dummy = anchor.web3.Keypair.generate();
      const tx = new anchor.web3.Transaction().add(
        anchor.web3.SystemProgram.transfer({
          fromPubkey: provider.wallet.publicKey,
          toPubkey: dummy.publicKey,
          lamports: 1000,
        })
      );
      try {
        await provider.sendAndConfirm(tx);
      } catch (e) {
        // ignore
      }
      await new Promise(r => setTimeout(r, 100));
    }
  };

  const initializeDailyRoot = async (tsMs: number) => {
    const epochDay = Math.floor(tsMs / 86400000);
    const dailyScoresRoots = getDailyScoresRootsPda(tsMs);

    const info = await provider.connection.getAccountInfo(dailyScoresRoots);
    if (info === null) {
      const idlPath = path.resolve("./target/idl/txoracle_mock.json");
      const txoracleMockIdl = JSON.parse(fs.readFileSync(idlPath, "utf8"));
      txoracleMockIdl.address = txoracleProgramId.toBase58();
      const txoracleProgram = new anchor.Program(txoracleMockIdl, provider) as any;
      await txoracleProgram.methods
        .insertScoresRoot(
          epochDay,
          12,
          30,
          Array(32).fill(0)
        )
        .accounts({
          authority: provider.wallet.publicKey,
          dailyScoresRoots,
        } as any)
        .rpc();
    }
  };

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

  describe("settlement", () => {
    // Helpers moved to top-level describe block

    const createMarketForSettle = async (
      fixtureId: number,
      locksAtTime: number,
      settleAfterTime: number,
      predicate: PredicateInput
    ) => {
      const predicateBytes = serializePredicate(predicate);
      const predicateHash = crypto.createHash("sha256").update(predicateBytes).digest();
      const fixtureIdBytes = Buffer.alloc(8);
      fixtureIdBytes.writeBigInt64LE(BigInt(fixtureId));

      const [marketPda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("market"), fixtureIdBytes, predicateHash],
        program.programId,
      );

      const locksAt = new anchor.BN(locksAtTime);
      const settleAfter = new anchor.BN(settleAfterTime);

      await program.methods
        .createMarket(new anchor.BN(fixtureId), predicate, [...predicateHash], locksAt, settleAfter)
        .rpc();

      return { marketPda, predicateHash };
    };

    it("fails to settle before settle_after", async () => {
      const now = await getOnChainTime();
      const fixtureId = baseFixtureId + 201;
      const predicate: PredicateInput = {
        statAKey: 1, statBKey: null, op: null, threshold: 100, comparison: { greaterThan: {} }
      };
      // locksAt in 5s, settleAfter in 10s (too early to settle)
      const { marketPda } = await createMarketForSettle(fixtureId, now + 5, now + 10, predicate);

      const tsMs = (await getOnChainTime()) * 1000;
      await initializeDailyRoot(tsMs);
      const dailyScoresMerkleRoots = getDailyScoresRootsPda(tsMs);

      const fixtureSummary = {
        fixtureId: new anchor.BN(fixtureId),
        updateStats: { updateCount: 1, minTimestamp: new anchor.BN(now), maxTimestamp: new anchor.BN(now) },
        eventsSubTreeRoot: Array(32).fill(0),
      };

      const statA = {
        statToProve: { key: 1, value: 5, period: 1 },
        eventStatRoot: Array(32).fill(0),
        statProof: [],
      };

      try {
        await program.methods
          .settleMarket(
            new anchor.BN(tsMs),
            fixtureSummary,
            [],
            [],
            statA,
            null
          )
          .accounts({
            market: marketPda,
            txoracleProgram: txoracleProgramId,
            dailyScoresMerkleRoots,
          } as any)
          .rpc();
        expect.fail("Should have thrown SettlementTooEarly");
      } catch (e: any) {
        expect(e.message).to.include("SettlementTooEarly");
      }
    });

    it("fails to settle with wrong fixture ID", async () => {
      const now = await getOnChainTime();
      const fixtureId = baseFixtureId + 202;
      const predicate: PredicateInput = {
        statAKey: 1, statBKey: null, op: null, threshold: 100, comparison: { greaterThan: {} }
      };
      const { marketPda } = await createMarketForSettle(fixtureId, now + 2, now + 3, predicate);
      await advanceTime(3);

      const tsMs = (await getOnChainTime()) * 1000;
      await initializeDailyRoot(tsMs);
      const dailyScoresMerkleRoots = getDailyScoresRootsPda(tsMs);

      const fixtureSummary = {
        fixtureId: new anchor.BN(fixtureId + 1), // Mismatching fixture ID
        updateStats: { updateCount: 1, minTimestamp: new anchor.BN(now), maxTimestamp: new anchor.BN(now) },
        eventsSubTreeRoot: Array(32).fill(0),
      };

      const statA = {
        statToProve: { key: 1, value: 5, period: 1 },
        eventStatRoot: Array(32).fill(0),
        statProof: [],
      };

      try {
        await program.methods
          .settleMarket(
            new anchor.BN(tsMs),
            fixtureSummary,
            [],
            [],
            statA,
            null
          )
          .accounts({
            market: marketPda,
            txoracleProgram: txoracleProgramId,
            dailyScoresMerkleRoots,
          } as any)
          .rpc();
        expect.fail("Should have thrown FixtureMismatch");
      } catch (e: any) {
        expect(e.message).to.include("FixtureMismatch");
      }
    });

    it("fails to settle with wrong stat A key", async () => {
      const now = await getOnChainTime();
      const fixtureId = baseFixtureId + 203;
      const predicate: PredicateInput = {
        statAKey: 1, statBKey: null, op: null, threshold: 100, comparison: { greaterThan: {} }
      };
      const { marketPda } = await createMarketForSettle(fixtureId, now + 2, now + 3, predicate);
      await advanceTime(3);

      const tsMs = (await getOnChainTime()) * 1000;
      await initializeDailyRoot(tsMs);
      const dailyScoresMerkleRoots = getDailyScoresRootsPda(tsMs);

      const fixtureSummary = {
        fixtureId: new anchor.BN(fixtureId),
        updateStats: { updateCount: 1, minTimestamp: new anchor.BN(now), maxTimestamp: new anchor.BN(now) },
        eventsSubTreeRoot: Array(32).fill(0),
      };

      const statA = {
        statToProve: { key: 99, value: 5, period: 1 }, // mismatching key
        eventStatRoot: Array(32).fill(0),
        statProof: [],
      };

      try {
        await program.methods
          .settleMarket(
            new anchor.BN(tsMs),
            fixtureSummary,
            [],
            [],
            statA,
            null
          )
          .accounts({
            market: marketPda,
            txoracleProgram: txoracleProgramId,
            dailyScoresMerkleRoots,
          } as any)
          .rpc();
        expect.fail("Should have thrown StatKeyMismatch");
      } catch (e: any) {
        expect(e.message).to.include("StatKeyMismatch");
      }
    });

    it("fails to settle with wrong daily-root PDA", async () => {
      const now = await getOnChainTime();
      const fixtureId = baseFixtureId + 204;
      const predicate: PredicateInput = {
        statAKey: 1, statBKey: null, op: null, threshold: 100, comparison: { greaterThan: {} }
      };
      const { marketPda } = await createMarketForSettle(fixtureId, now + 2, now + 3, predicate);
      await advanceTime(3);

      const tsMs = (await getOnChainTime()) * 1000;
      await initializeDailyRoot(tsMs);
      await initializeDailyRoot(tsMs + 86400000 * 2); // initialize the mismatching PDA as well so it exists on-chain
      const dailyScoresMerkleRoots = getDailyScoresRootsPda(tsMs + 86400000 * 2); // mismatching PDA

      const fixtureSummary = {
        fixtureId: new anchor.BN(fixtureId),
        updateStats: { updateCount: 1, minTimestamp: new anchor.BN(now), maxTimestamp: new anchor.BN(now) },
        eventsSubTreeRoot: Array(32).fill(0),
      };

      const statA = {
        statToProve: { key: 1, value: 5, period: 1 },
        eventStatRoot: Array(32).fill(0),
        statProof: [],
      };

      try {
        await program.methods
          .settleMarket(
            new anchor.BN(tsMs),
            fixtureSummary,
            [],
            [],
            statA,
            null
          )
          .accounts({
            market: marketPda,
            txoracleProgram: txoracleProgramId,
            dailyScoresMerkleRoots,
          } as any)
          .rpc();
        expect.fail("Should have thrown InvalidOraclePda");
      } catch (e: any) {
        expect(e.message).to.include("InvalidOraclePda");
      }
    });

    it("succeeds to settle with outcome = true when mock validates", async () => {
      const now = await getOnChainTime();
      const fixtureId = baseFixtureId + 205;
      const predicate: PredicateInput = {
        statAKey: 1, statBKey: null, op: null, threshold: 100, comparison: { greaterThan: {} }
      };
      const { marketPda } = await createMarketForSettle(fixtureId, now + 2, now + 3, predicate);
      await advanceTime(3);

      const tsMs = (await getOnChainTime()) * 1000;
      await initializeDailyRoot(tsMs);
      const dailyScoresMerkleRoots = getDailyScoresRootsPda(tsMs);

      const fixtureSummary = {
        fixtureId: new anchor.BN(fixtureId),
        updateStats: { updateCount: 1, minTimestamp: new anchor.BN(now), maxTimestamp: new anchor.BN(now) },
        eventsSubTreeRoot: Array(32).fill(0),
      };

      const statA = {
        statToProve: { key: 1, value: 5, period: 1 },
        eventStatRoot: Array(32).fill(0),
        statProof: [],
      };

      await program.methods
        .settleMarket(
          new anchor.BN(tsMs),
          fixtureSummary,
          [],
          [],
          statA,
          null
        )
        .accounts({
          market: marketPda,
          txoracleProgram: txoracleProgramId,
          dailyScoresMerkleRoots,
        } as any)
        .rpc();

      const market = await program.account.market.fetch(marketPda);
      expect(market.status).to.have.property("settled");
      expect(market.outcome).to.equal(true);
      expect(market.settledAt).to.not.be.null;
    });

    it("succeeds to settle with outcome = false when mock invalidates", async () => {
      const now = await getOnChainTime();
      const fixtureId = baseFixtureId + 206;
      const predicate: PredicateInput = {
        statAKey: 1, statBKey: null, op: null, threshold: 50, comparison: { greaterThan: {} }
      };
      const { marketPda } = await createMarketForSettle(fixtureId, now + 2, now + 3, predicate);
      await advanceTime(3);

      const tsMs = (await getOnChainTime()) * 1000;
      await initializeDailyRoot(tsMs);
      const dailyScoresMerkleRoots = getDailyScoresRootsPda(tsMs);

      const fixtureSummary = {
        fixtureId: new anchor.BN(fixtureId),
        updateStats: { updateCount: 1, minTimestamp: new anchor.BN(now), maxTimestamp: new anchor.BN(now) },
        eventsSubTreeRoot: Array(32).fill(0),
      };

      const statA = {
        statToProve: { key: 1, value: 5, period: 1 },
        eventStatRoot: Array(32).fill(0),
        statProof: [],
      };

      await program.methods
        .settleMarket(
          new anchor.BN(tsMs),
          fixtureSummary,
          [],
          [],
          statA,
          null
        )
        .accounts({
          market: marketPda,
          txoracleProgram: txoracleProgramId,
          dailyScoresMerkleRoots,
        } as any)
        .rpc();

      const market = await program.account.market.fetch(marketPda);
      expect(market.status).to.have.property("settled");
      expect(market.outcome).to.equal(false);
      expect(market.settledAt).to.not.be.null;
    });

    it("fails to settle already settled market", async () => {
      const now = await getOnChainTime();
      const fixtureId = baseFixtureId + 207;
      const predicate: PredicateInput = {
        statAKey: 1, statBKey: null, op: null, threshold: 100, comparison: { greaterThan: {} }
      };
      const { marketPda } = await createMarketForSettle(fixtureId, now + 2, now + 3, predicate);
      await advanceTime(3);

      const tsMs = (await getOnChainTime()) * 1000;
      await initializeDailyRoot(tsMs);
      const dailyScoresMerkleRoots = getDailyScoresRootsPda(tsMs);

      const fixtureSummary = {
        fixtureId: new anchor.BN(fixtureId),
        updateStats: { updateCount: 1, minTimestamp: new anchor.BN(now), maxTimestamp: new anchor.BN(now) },
        eventsSubTreeRoot: Array(32).fill(0),
      };

      const statA = {
        statToProve: { key: 1, value: 5, period: 1 },
        eventStatRoot: Array(32).fill(0),
        statProof: [],
      };

      await program.methods
        .settleMarket(
          new anchor.BN(tsMs),
          fixtureSummary,
          [],
          [],
          statA,
          null
        )
        .accounts({
          market: marketPda,
          txoracleProgram: txoracleProgramId,
          dailyScoresMerkleRoots,
        } as any)
        .rpc();

      try {
        await program.methods
          .settleMarket(
            new anchor.BN(tsMs),
            fixtureSummary,
            [],
            [],
            statA,
            null
          )
          .accounts({
            market: marketPda,
            txoracleProgram: txoracleProgramId,
            dailyScoresMerkleRoots,
          } as any)
          .rpc();
        expect.fail("Should have thrown MarketNotSettleable");
      } catch (e: any) {
        // Status changes to Settled on first settlement, so settling it again throws MarketNotSettleable
        expect(e.message).to.include("MarketNotSettleable");
      }
    });

    it("fails to settle cancelled market", async () => {
      const now = await getOnChainTime();
      const fixtureId = baseFixtureId + 208;
      const predicate: PredicateInput = {
        statAKey: 1, statBKey: null, op: null, threshold: 100, comparison: { greaterThan: {} }
      };
      const { marketPda } = await createMarketForSettle(fixtureId, now + 2, now + 3, predicate);
      await advanceTime(3);

      await program.methods.cancelMarket().accounts({ market: marketPda }).rpc();

      const tsMs = (await getOnChainTime()) * 1000;
      await initializeDailyRoot(tsMs);
      const dailyScoresMerkleRoots = getDailyScoresRootsPda(tsMs);

      const fixtureSummary = {
        fixtureId: new anchor.BN(fixtureId),
        updateStats: { updateCount: 1, minTimestamp: new anchor.BN(now), maxTimestamp: new anchor.BN(now) },
        eventsSubTreeRoot: Array(32).fill(0),
      };

      const statA = {
        statToProve: { key: 1, value: 5, period: 1 },
        eventStatRoot: Array(32).fill(0),
        statProof: [],
      };

      try {
        await program.methods
          .settleMarket(
            new anchor.BN(tsMs),
            fixtureSummary,
            [],
            [],
            statA,
            null
          )
          .accounts({
            market: marketPda,
            txoracleProgram: txoracleProgramId,
            dailyScoresMerkleRoots,
          } as any)
          .rpc();
        expect.fail("Should have thrown MarketNotSettleable");
      } catch (e: any) {
        expect(e.message).to.include("MarketNotSettleable");
      }
    });

    it("fails to settle with stale oracle timestamp", async () => {
      const now = await getOnChainTime();
      const fixtureId = baseFixtureId + 209;
      const predicate: PredicateInput = {
        statAKey: 1, statBKey: null, op: null, threshold: 100, comparison: { greaterThan: {} }
      };
      const { marketPda } = await createMarketForSettle(fixtureId, now + 2, now + 3, predicate);
      await advanceTime(3);

      // Stale oracle timestamp (e.g., from 10 seconds before match started)
      const staleTsMs = (now - 10) * 1000;
      await initializeDailyRoot(staleTsMs);
      const dailyScoresMerkleRoots = getDailyScoresRootsPda(staleTsMs);

      const fixtureSummary = {
        fixtureId: new anchor.BN(fixtureId),
        updateStats: { updateCount: 1, minTimestamp: new anchor.BN(now), maxTimestamp: new anchor.BN(now) },
        eventsSubTreeRoot: Array(32).fill(0),
      };

      const statA = {
        statToProve: { key: 1, value: 5, period: 1 },
        eventStatRoot: Array(32).fill(0),
        statProof: [],
      };

      try {
        await program.methods
          .settleMarket(
            new anchor.BN(staleTsMs),
            fixtureSummary,
            [],
            [],
            statA,
            null
          )
          .accounts({
            market: marketPda,
            txoracleProgram: txoracleProgramId,
            dailyScoresMerkleRoots,
          } as any)
          .rpc();
        expect.fail("Should have thrown StaleOracleSnapshot");
      } catch (e: any) {
        expect(e.message).to.include("StaleOracleSnapshot");
      }
    });
  });

  describe("participation and payout", () => {
    // txoracleProgramId is defined globally

    const getVaultPda = (marketPda: anchor.web3.PublicKey): anchor.web3.PublicKey => {
      const [pda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("vault"), marketPda.toBuffer()],
        program.programId
      );
      return pda;
    };

    const getPositionPda = (marketPda: anchor.web3.PublicKey, userPubkey: anchor.web3.PublicKey): anchor.web3.PublicKey => {
      const [pda] = anchor.web3.PublicKey.findProgramAddressSync(
        [Buffer.from("position"), marketPda.toBuffer(), userPubkey.toBuffer()],
        program.programId
      );
      return pda;
    };

    const createMarketForBet = async (fixtureId: number, locksAtTime: number, settleAfterTime: number) => {
      const predicate: PredicateInput = {
        statAKey: 1, statBKey: null, op: null, threshold: 100, comparison: { greaterThan: {} }
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
      const settleAfter = new anchor.BN(settleAfterTime);

      await program.methods
        .createMarket(new anchor.BN(fixtureId), predicate, [...predicateHash], locksAt, settleAfter)
        .rpc();

      return { marketPda, predicateHash };
    };

    it("succeeds to place YES and NO bets, updates pools, and accumulates", async () => {
      const now = await getOnChainTime();
      const fixtureId = baseFixtureId + 301;
      const { marketPda } = await createMarketForBet(fixtureId, now + 100, now + 200);

      const vaultPda = getVaultPda(marketPda);
      const positionPda = getPositionPda(marketPda, provider.wallet.publicKey);

      // Place first bet: 1.5 SOL on YES
      const yesAmount = new anchor.BN(1.5 * anchor.web3.LAMPORTS_PER_SOL);
      await program.methods
        .placeBet({ yes: {} }, yesAmount)
        .accounts({
          market: marketPda,
          vault: vaultPda,
          position: positionPda,
        } as any)
        .rpc();

      let market = await program.account.market.fetch(marketPda);
      let position = await program.account.position.fetch(positionPda);
      let vaultBalance = await provider.connection.getBalance(vaultPda);

      expect(market.totalYes.toString()).to.equal(yesAmount.toString());
      expect(market.totalNo.toString()).to.equal("0");
      expect(position.yesAmount.toString()).to.equal(yesAmount.toString());
      expect(position.noAmount.toString()).to.equal("0");
      expect(position.claimed).to.equal(false);
      expect(vaultBalance).to.be.at.least(yesAmount.toNumber());

      // Place second bet: 0.5 SOL on NO from the same user
      const noAmount = new anchor.BN(0.5 * anchor.web3.LAMPORTS_PER_SOL);
      await program.methods
        .placeBet({ no: {} }, noAmount)
        .accounts({
          market: marketPda,
          vault: vaultPda,
          position: positionPda,
        } as any)
        .rpc();

      market = await program.account.market.fetch(marketPda);
      position = await program.account.position.fetch(positionPda);
      vaultBalance = await provider.connection.getBalance(vaultPda);

      expect(market.totalYes.toString()).to.equal(yesAmount.toString());
      expect(market.totalNo.toString()).to.equal(noAmount.toString());
      expect(position.yesAmount.toString()).to.equal(yesAmount.toString());
      expect(position.noAmount.toString()).to.equal(noAmount.toString());
      expect(vaultBalance).to.be.at.least(yesAmount.add(noAmount).toNumber());
    });

    it("fails to place bet after locks_at", async () => {
      const now = await getOnChainTime();
      const fixtureId = baseFixtureId + 302;
      const { marketPda } = await createMarketForBet(fixtureId, now + 2, now + 3);

      const vaultPda = getVaultPda(marketPda);
      const positionPda = getPositionPda(marketPda, provider.wallet.publicKey);

      await advanceTime(3);

      try {
        await program.methods
          .placeBet({ yes: {} }, new anchor.BN(1000))
          .accounts({
            market: marketPda,
            vault: vaultPda,
            position: positionPda,
          } as any)
          .rpc();
        expect.fail("Should have thrown BettingLocked");
      } catch (e: any) {
        expect(e.message).to.include("BettingLocked");
      }
    });

    it("succeeds to claim winnings proportionally", async () => {
      const now = await getOnChainTime();
      const fixtureId = baseFixtureId + 303;
      const { marketPda } = await createMarketForBet(fixtureId, now + 100, now + 200);

      const vaultPda = getVaultPda(marketPda);

      // We will bet with two different users:
      // User 1 (provider wallet): 2 SOL on YES
      const user1PositionPda = getPositionPda(marketPda, provider.wallet.publicKey);
      await program.methods
        .placeBet({ yes: {} }, new anchor.BN(2 * anchor.web3.LAMPORTS_PER_SOL))
        .accounts({
          market: marketPda,
          vault: vaultPda,
          position: user1PositionPda,
        } as any)
        .rpc();

      // User 2: 1 SOL on YES
      const user2 = anchor.web3.Keypair.generate();
      const airdropSig2 = await provider.connection.requestAirdrop(user2.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
      const latestBlockhash2 = await provider.connection.getLatestBlockhash();
      await provider.connection.confirmTransaction({
        blockhash: latestBlockhash2.blockhash,
        lastValidBlockHeight: latestBlockhash2.lastValidBlockHeight,
        signature: airdropSig2,
      });

      const user2PositionPda = getPositionPda(marketPda, user2.publicKey);
      await program.methods
        .placeBet({ yes: {} }, new anchor.BN(1 * anchor.web3.LAMPORTS_PER_SOL))
        .accounts({
          market: marketPda,
          vault: vaultPda,
          position: user2PositionPda,
          user: user2.publicKey,
        } as any)
        .signers([user2])
        .rpc();

      // User 3 (another random keypair): 3 SOL on NO
      const user3 = anchor.web3.Keypair.generate();
      // Airdrop User 3
      const airdropSig = await provider.connection.requestAirdrop(user3.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
      const latestBlockhash = await provider.connection.getLatestBlockhash();
      await provider.connection.confirmTransaction({
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        signature: airdropSig,
      });

      const user3PositionPda = getPositionPda(marketPda, user3.publicKey);
      await program.methods
        .placeBet({ no: {} }, new anchor.BN(3 * anchor.web3.LAMPORTS_PER_SOL))
        .accounts({
          market: marketPda,
          vault: vaultPda,
          position: user3PositionPda,
          user: user3.publicKey,
        } as any)
        .signers([user3])
        .rpc();

      // Total pool = 2 + 1 + 3 = 6 SOL.
      // YES winning pool = 3 SOL.
      // NO losing pool = 3 SOL.

      // Wait and settle market with outcome = true
      await advanceTime(200);
      const tsMs = (await getOnChainTime()) * 1000;
      await initializeDailyRoot(tsMs);
      const dailyScoresMerkleRoots = getDailyScoresRootsPda(tsMs);

      const fixtureSummary = {
        fixtureId: new anchor.BN(fixtureId),
        updateStats: { updateCount: 1, minTimestamp: new anchor.BN(now), maxTimestamp: new anchor.BN(now) },
        eventsSubTreeRoot: Array(32).fill(0),
      };

      const statA = {
        statToProve: { key: 1, value: 5, period: 1 },
        eventStatRoot: Array(32).fill(0),
        statProof: [],
      };

      // Evaluate YES as winning since predicate.threshold is 100 and mock returns true if threshold >= 100 (which it is!)
      await program.methods
        .settleMarket(
          new anchor.BN(tsMs),
          fixtureSummary,
          [],
          [],
          statA,
          null
        )
        .accounts({
          market: marketPda,
          txoracleProgram: txoracleProgramId,
          dailyScoresMerkleRoots,
        } as any)
        .rpc();

      // User 2 claims winnings:
      // Winning pool = 3 SOL. Total pool = 6 SOL.
      // User 2 stake = 1 SOL.
      // Expected payout = 1 * 6 / 3 = 2 SOL.
      const initialBalance = await provider.connection.getBalance(user2.publicKey);
      await program.methods
        .claimWinnings()
        .accounts({
          market: marketPda,
          vault: vaultPda,
          position: user2PositionPda,
          user: user2.publicKey,
        } as any)
        .signers([user2])
        .rpc();

      const finalBalance = await provider.connection.getBalance(user2.publicKey);
      const diff = finalBalance - initialBalance;
      // We check that diff is approximately 2 SOL (minus tx fee which is negligible on localnet but let's be safe)
      expect(diff).to.be.closeTo(2 * anchor.web3.LAMPORTS_PER_SOL, 0.01 * anchor.web3.LAMPORTS_PER_SOL);

      const user2Position = await program.account.position.fetch(user2PositionPda);
      expect(user2Position.claimed).to.equal(true);

      // Double-claim prevention: User 2 cannot claim winnings a second time.
      try {
        await program.methods
          .claimWinnings()
          .accounts({
            market: marketPda,
            vault: vaultPda,
            position: user2PositionPda,
            user: user2.publicKey,
          } as any)
          .signers([user2])
          .rpc();
        expect.fail("Should have thrown AlreadyClaimed");
      } catch (e: any) {
        expect(e.message).to.include("AlreadyClaimed");
      }

      // Loser (User 3) cannot claim winnings
      try {
        await program.methods
          .claimWinnings()
          .accounts({
            market: marketPda,
            vault: vaultPda,
            position: user3PositionPda,
            user: user3.publicKey,
          } as any)
          .signers([user3])
          .rpc();
        expect.fail("Should have thrown NoWinningStake");
      } catch (e: any) {
        expect(e.message).to.include("NoWinningStake");
      }
    });

    it("succeeds to claim refund in cancelled market", async () => {
      const now = await getOnChainTime();
      const fixtureId = baseFixtureId + 304;
      const { marketPda } = await createMarketForBet(fixtureId, now + 100, now + 200);

      const vaultPda = getVaultPda(marketPda);
      const positionPda = getPositionPda(marketPda, provider.wallet.publicKey);

      const amount = new anchor.BN(1 * anchor.web3.LAMPORTS_PER_SOL);
      await program.methods
        .placeBet({ yes: {} }, amount)
        .accounts({
          market: marketPda,
          vault: vaultPda,
          position: positionPda,
        } as any)
        .rpc();

      // Cancel market
      await program.methods.cancelMarket().accounts({ market: marketPda }).rpc();

      // Claim refund
      const initialBalance = await provider.connection.getBalance(provider.wallet.publicKey);
      await program.methods
        .claimRefund()
        .accounts({
          market: marketPda,
          vault: vaultPda,
          position: positionPda,
        } as any)
        .rpc();

      const finalBalance = await provider.connection.getBalance(provider.wallet.publicKey);
      const diff = finalBalance - initialBalance;
      expect(diff).to.be.closeTo(1 * anchor.web3.LAMPORTS_PER_SOL, 0.01 * anchor.web3.LAMPORTS_PER_SOL);

      const position = await program.account.position.fetch(positionPda);
      expect(position.claimed).to.equal(true);
    });

    it("succeeds to claim refund in settled market with empty winning pool", async () => {
      const now = await getOnChainTime();
      const fixtureId = baseFixtureId + 305;
      const { marketPda } = await createMarketForBet(fixtureId, now + 100, now + 200);

      const vaultPda = getVaultPda(marketPda);

      // Only User 3 bets on NO: 2 SOL
      const user3 = anchor.web3.Keypair.generate();
      const airdropSig = await provider.connection.requestAirdrop(user3.publicKey, 10 * anchor.web3.LAMPORTS_PER_SOL);
      const latestBlockhash = await provider.connection.getLatestBlockhash();
      await provider.connection.confirmTransaction({
        blockhash: latestBlockhash.blockhash,
        lastValidBlockHeight: latestBlockhash.lastValidBlockHeight,
        signature: airdropSig,
      });

      const user3PositionPda = getPositionPda(marketPda, user3.publicKey);
      await program.methods
        .placeBet({ no: {} }, new anchor.BN(2 * anchor.web3.LAMPORTS_PER_SOL))
        .accounts({
          market: marketPda,
          vault: vaultPda,
          position: user3PositionPda,
          user: user3.publicKey,
        } as any)
        .signers([user3])
        .rpc();

      // Total YES = 0. Total NO = 2.
      // Settle market with outcome = true (YES wins!).
      // Since YES wins but total_yes == 0, the winning pool is empty.

      await advanceTime(200);
      const tsMs = (await getOnChainTime()) * 1000;
      await initializeDailyRoot(tsMs);
      const dailyScoresMerkleRoots = getDailyScoresRootsPda(tsMs);

      const fixtureSummary = {
        fixtureId: new anchor.BN(fixtureId),
        updateStats: { updateCount: 1, minTimestamp: new anchor.BN(now), maxTimestamp: new anchor.BN(now) },
        eventsSubTreeRoot: Array(32).fill(0),
      };

      const statA = {
        statToProve: { key: 1, value: 5, period: 1 },
        eventStatRoot: Array(32).fill(0),
        statProof: [],
      };

      await program.methods
        .settleMarket(
          new anchor.BN(tsMs),
          fixtureSummary,
          [],
          [],
          statA,
          null
        )
        .accounts({
          market: marketPda,
          txoracleProgram: txoracleProgramId,
          dailyScoresMerkleRoots,
        } as any)
        .rpc();

      // Settle succeeded. Now User 3 (who bet on losing NO) should be allowed to refund their stake because the winning pool is empty!
      const initialBalance = await provider.connection.getBalance(user3.publicKey);
      await program.methods
        .claimRefund()
        .accounts({
          market: marketPda,
          vault: vaultPda,
          position: user3PositionPda,
          user: user3.publicKey,
        } as any)
        .signers([user3])
        .rpc();

      const finalBalance = await provider.connection.getBalance(user3.publicKey);
      const diff = finalBalance - initialBalance;
      expect(diff).to.be.closeTo(2 * anchor.web3.LAMPORTS_PER_SOL, 0.01 * anchor.web3.LAMPORTS_PER_SOL);

      const position = await program.account.position.fetch(user3PositionPda);
      expect(position.claimed).to.equal(true);
    });
  });

});
