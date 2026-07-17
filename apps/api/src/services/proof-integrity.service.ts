import { prisma } from "@workspace/db";
import { ComputeBudgetProgram, Keypair, Transaction, type Connection } from "@solana/web3.js";
import { ScoresService, type ScoresStatValidation, type ScoresStatValidationV2 } from "@workspace/txline";
import {
  buildValidateStatIx,
  describeOracleError,
  getDailyScoresRootsPda,
  TXLINE_STAT_KEYS,
  TXLINE_STAT_LABELS,
  TXORACLE_PROGRAM_ID,
  type OracleBinaryOp,
  type OracleComparison,
  type OracleProofNode,
  type OracleStatTerm,
} from "@workspace/goalana-sdk";
import { connection, serviceKeypair } from "./goalana.service";
import { logger } from "../utils/logger";

const scoresService = new ScoresService();

/**
 * Records Goalana's proof-integrity evidence: real Devnet transactions against
 * TxLINE's oracle showing (a) genuine Merkle proofs for several DIFFERENT
 * statistics being accepted, and (b) tampered proofs being rejected.
 *
 * Why this is recorded rather than computed live:
 *
 *  1. TxLINE free-tier access ends on the submission deadline, so an on-demand
 *     proof fetch can fail exactly when someone is looking. A persisted artifact
 *     always renders — the same reasoning that made `Market.settlementProof`
 *     persisted rather than re-fetched.
 *  2. A recorded transaction signature is strictly better evidence than a live
 *     simulation: it is on the public ledger forever and can be independently
 *     inspected on Explorer without trusting this backend at all.
 *
 * Why it calls `validate_stat` directly instead of `settle_market`: the oracle
 * CPI is where Merkle verification actually happens, and `settle_market`'s own
 * guards (fixture binding, settle_after window, stat-key binding) all fire
 * before reaching it — the program deliberately cannot settle a fixture that
 * finished before its market existed. Calling the oracle directly isolates the
 * cryptographic check. It is the identical instruction `settle_market` invokes,
 * with the identical arguments, so a proof the oracle rejects here is a proof
 * that can never settle a market.
 *
 * NOTE: the localnet suite cannot cover any of this — `txoracle_mock` ignores
 * the proof entirely and returns `threshold >= 100`. Real Merkle verification
 * exists only in TxLINE's deployed oracle, so Devnet is the only place the
 * tamper-rejection property can actually be demonstrated.
 */

export interface ProofIntegrityCase {
  id: string;
  title: string;
  kind: "genuine" | "tampered";
  /** Plain-English statistic, e.g. "Total corners". */
  statLabel: string;
  statKeys: number[];
  provenValues: number[];
  /** Plain-English predicate the oracle evaluated, e.g. "corners(P1) + corners(P2) > 9". */
  predicateLabel: string;
  /** What was mutated, for tampered cases only. */
  tamper: string | null;
  expected: "accepted" | "rejected";
  txSignature: string;
  accepted: boolean;
  /** The oracle's returned predicate verdict — only meaningful when accepted. */
  outcome: boolean | null;
  computeUnits: number | null;
  errorCode: number | null;
  errorName: string | null;
  logs: string[];
  oracleTsMs: number;
  dailyRootsPda: string;
}

export interface ProofIntegrityArtifact {
  fixtureId: number;
  seq: number;
  oracleProgram: string;
  recordedAt: string;
  cases: ProofIntegrityCase[];
}

function isLegacyValidation(
  v: ScoresStatValidation | ScoresStatValidationV2
): v is ScoresStatValidation {
  return "statToProve" in v;
}

function toOracleNode(node: { hash: number[]; isRightSibling: boolean }): OracleProofNode {
  return { hash: node.hash, isRightSibling: node.isRightSibling };
}

/** A stat pair to prove, and the predicate to evaluate over it. */
interface StatPairSpec {
  id: string;
  title: string;
  statLabel: string;
  keyA: number;
  keyB: number;
  /** Integer threshold — "over N.5" is "> N" for integer stats. */
  threshold: number;
  op: OracleBinaryOp;
  comparison: OracleComparison;
}

/**
 * The three statistics proven as genuine. Goals is the one that actually backs
 * a market today; corners and cards are here to demonstrate that settlement is
 * stat-agnostic — same predicate shape, same instruction, same oracle, only the
 * stat keys differ. All three key pairs were validated against the real feed
 * (verify-stat-keys.ts).
 */
const GENUINE_SPECS: StatPairSpec[] = [
  {
    id: "goals",
    title: "Total goals over 1.5",
    statLabel: "Total goals",
    keyA: TXLINE_STAT_KEYS.HOME_GOALS,
    keyB: TXLINE_STAT_KEYS.AWAY_GOALS,
    threshold: 1,
    op: "add",
    comparison: "greaterThan",
  },
  {
    id: "corners",
    title: "Total corners over 9.5",
    statLabel: "Total corners",
    keyA: TXLINE_STAT_KEYS.HOME_CORNERS,
    keyB: TXLINE_STAT_KEYS.AWAY_CORNERS,
    threshold: 9,
    op: "add",
    comparison: "greaterThan",
  },
  {
    id: "cards",
    title: "Total yellow cards over 3.5",
    statLabel: "Total yellow cards",
    keyA: TXLINE_STAT_KEYS.HOME_YELLOW_CARDS,
    keyB: TXLINE_STAT_KEYS.AWAY_YELLOW_CARDS,
    threshold: 3,
    op: "add",
    comparison: "greaterThan",
  },
];

function predicateLabel(spec: StatPairSpec, values: number[]): string {
  const noun = spec.statLabel.replace(/^Total /, "");
  return `${noun}(P1) + ${noun}(P2) > ${spec.threshold}   [${values[0]} + ${values[1]} = ${(values[0] ?? 0) + (values[1] ?? 0)}]`;
}

/**
 * Sends one `validate_stat` transaction and reports what the chain did with it.
 *
 * `skipPreflight` is required: preflight simulates first and would refuse to
 * submit a transaction it knows will fail, which is precisely the transaction
 * we need on the ledger as evidence. A failed instruction still lands in a
 * block (the fee is charged), so it gets a real, permanent, inspectable
 * signature.
 */
async function sendValidateStat(
  conn: Connection,
  payer: Keypair,
  ix: ReturnType<typeof buildValidateStatIx>
): Promise<{
  txSignature: string;
  accepted: boolean;
  outcome: boolean | null;
  computeUnits: number | null;
  errorCode: number | null;
  logs: string[];
}> {
  // The oracle costs up to ~199k CU on a deep proof — within a whisker of the
  // 200k single-instruction default. Request an explicit budget so the evidence
  // records the oracle's verdict, never an out-of-gas failure that looks like
  // one. Mirrors SETTLE_COMPUTE_UNIT_LIMIT in goalana.service.
  const tx = new Transaction()
    .add(ComputeBudgetProgram.setComputeUnitLimit({ units: 400_000 }))
    .add(ix);
  const latest = await conn.getLatestBlockhash();
  tx.feePayer = payer.publicKey;
  tx.recentBlockhash = latest.blockhash;
  tx.sign(payer);

  const txSignature = await conn.sendRawTransaction(tx.serialize(), {
    skipPreflight: true,
  });

  await conn.confirmTransaction(
    { signature: txSignature, ...latest },
    "confirmed"
  );

  const detail = await conn.getTransaction(txSignature, {
    commitment: "confirmed",
    maxSupportedTransactionVersion: 0,
  });

  const logs = detail?.meta?.logMessages ?? [];
  const err = detail?.meta?.err ?? null;
  const accepted = err === null;

  // Anchor custom errors surface as { InstructionError: [i, { Custom: code }] }.
  let errorCode: number | null = null;
  if (err && typeof err === "object" && "InstructionError" in err) {
    const detailPart = (err as { InstructionError: [number, unknown] }).InstructionError[1];
    if (detailPart && typeof detailPart === "object" && "Custom" in detailPart) {
      errorCode = (detailPart as { Custom: number }).Custom;
    }
  }

  // The oracle returns its verdict as a single byte via set_return_data.
  // web3.js populates meta.returnData at runtime but this version's
  // ConfirmedTransactionMeta type omits it, so narrow it explicitly rather than
  // widening the whole meta object to `any`.
  type MetaReturnData = { returnData?: { data?: [string, string] } };
  let outcome: boolean | null = null;
  const returnData = (detail?.meta as MetaReturnData | undefined)?.returnData?.data?.[0];
  if (accepted && returnData) {
    const byte = Buffer.from(returnData, "base64")[0];
    outcome = byte === 1 ? true : byte === 0 ? false : null;
  }

  return {
    txSignature,
    accepted,
    outcome,
    computeUnits: detail?.meta?.computeUnitsConsumed ?? null,
    errorCode,
    logs,
  };
}

/**
 * Runs the full evidence set against Devnet and returns the artifact.
 * Read-only with respect to Goalana: `validate_stat` touches only TxLINE's
 * anchored-roots PDA, so no market, vault, or position can be affected.
 */
export async function recordProofIntegrity(
  fixtureId: bigint,
  options: { conn?: Connection; payer?: Keypair } = {}
): Promise<ProofIntegrityArtifact> {
  const conn = options.conn ?? connection;
  const payer = options.payer ?? serviceKeypair;

  const fixture = await prisma.fixture.findUnique({ where: { fixtureId } });
  if (!fixture || fixture.finalSeq === null) {
    throw new Error(`Fixture ${fixtureId} is not final — no proof to record`);
  }
  const seq = fixture.finalSeq;

  const cases: ProofIntegrityCase[] = [];

  // ── Genuine proofs, one per statistic ──────────────────────────────────────
  // Keeps the goals proof around afterwards so the tampered cases mutate the
  // exact same input — the only difference between accepted and rejected must
  // be the tampering itself, or the comparison proves nothing.
  let goalsValidation: ScoresStatValidation | null = null;
  let goalsSpec: StatPairSpec | null = null;

  for (const spec of GENUINE_SPECS) {
    const validation = await scoresService.getScoresStatValidation({
      fixtureId: Number(fixtureId),
      seq,
      statKey: spec.keyA,
      statKey2: spec.keyB,
    });

    if (!isLegacyValidation(validation) || !validation.statToProve2) {
      logger.warn(
        "proof-integrity",
        `Skipping ${spec.id} — unexpected stat-validation shape for fixture ${fixtureId}`
      );
      continue;
    }

    if (spec.id === "goals") {
      goalsValidation = validation;
      goalsSpec = spec;
    }

    const [dailyRootsPda] = getDailyScoresRootsPda(validation.ts);
    const values = [validation.statToProve.value, validation.statToProve2.value];

    const ix = buildValidateStatIx({
      oracleTsMs: validation.ts,
      summary: {
        fixtureId: validation.summary.fixtureId,
        updateStats: {
          updateCount: validation.summary.updateStats.updateCount,
          minTimestamp: validation.summary.updateStats.minTimestamp,
          maxTimestamp: validation.summary.updateStats.maxTimestamp,
        },
        eventsSubTreeRoot: validation.summary.eventStatsSubTreeRoot,
      },
      fixtureProof: validation.subTreeProof.map(toOracleNode),
      mainTreeProof: validation.mainTreeProof.map(toOracleNode),
      predicate: { threshold: spec.threshold, comparison: spec.comparison },
      statA: {
        statToProve: validation.statToProve,
        eventStatRoot: validation.eventStatRoot,
        statProof: validation.statProof.map(toOracleNode),
      },
      statB: {
        statToProve: validation.statToProve2,
        eventStatRoot: validation.eventStatRoot,
        statProof: (validation.statProof2 ?? []).map(toOracleNode),
      },
      op: spec.op,
      dailyScoresRootsPda: dailyRootsPda,
    });

    logger.info("proof-integrity", `Submitting genuine validate_stat for ${spec.id}...`);
    const result = await sendValidateStat(conn, payer, ix);

    cases.push({
      id: `${spec.id}-genuine`,
      title: spec.title,
      kind: "genuine",
      statLabel: spec.statLabel,
      statKeys: [spec.keyA, spec.keyB],
      provenValues: values,
      predicateLabel: predicateLabel(spec, values),
      tamper: null,
      expected: "accepted",
      oracleTsMs: validation.ts,
      dailyRootsPda: dailyRootsPda.toBase58(),
      errorName: result.errorCode !== null ? describeOracleError(result.errorCode) : null,
      ...result,
    });

    logger.success(
      "proof-integrity",
      `${spec.id}: accepted=${result.accepted} outcome=${result.outcome} cu=${result.computeUnits} tx=${result.txSignature}`
    );
  }

  // ── Tampered proofs, mutating the goals proof only ─────────────────────────
  if (goalsValidation && goalsSpec) {
    const validation = goalsValidation;
    const spec = goalsSpec;
    const [dailyRootsPda] = getDailyScoresRootsPda(validation.ts);
    const statB: OracleStatTerm = {
      statToProve: validation.statToProve2!,
      eventStatRoot: validation.eventStatRoot,
      statProof: (validation.statProof2 ?? []).map(toOracleNode),
    };

    const baseArgs = {
      oracleTsMs: validation.ts,
      summary: {
        fixtureId: validation.summary.fixtureId,
        updateStats: {
          updateCount: validation.summary.updateStats.updateCount,
          minTimestamp: validation.summary.updateStats.minTimestamp,
          maxTimestamp: validation.summary.updateStats.maxTimestamp,
        },
        eventsSubTreeRoot: validation.summary.eventStatsSubTreeRoot,
      },
      fixtureProof: validation.subTreeProof.map(toOracleNode),
      mainTreeProof: validation.mainTreeProof.map(toOracleNode),
      predicate: { threshold: spec.threshold, comparison: spec.comparison },
      statB,
      op: spec.op as OracleBinaryOp,
      dailyScoresRootsPda: dailyRootsPda,
    };

    const forgedValue = validation.statToProve.value + 5;

    // Two distinct forgeries: lie about the number, or lie about the path to
    // the root. Both are what an attacker would actually try.
    const tamperCases: Array<{
      id: string;
      title: string;
      tamper: string;
      statA: OracleStatTerm;
    }> = [
      {
        id: "goals-tampered-value",
        title: "Forged goal count",
        tamper: `stat value ${validation.statToProve.value} → ${forgedValue} (claiming goals that were never scored)`,
        statA: {
          statToProve: { ...validation.statToProve, value: forgedValue },
          eventStatRoot: validation.eventStatRoot,
          statProof: validation.statProof.map(toOracleNode),
        },
      },
      {
        id: "goals-tampered-path",
        title: "Forged Merkle path",
        tamper: "final byte of the first sibling hash flipped (a fabricated proof path)",
        statA: {
          statToProve: validation.statToProve,
          eventStatRoot: validation.eventStatRoot,
          statProof: validation.statProof.map((node, i) =>
            i === 0
              ? {
                  hash: [...node.hash.slice(0, 31), (node.hash[31]! ^ 0xff) & 0xff],
                  isRightSibling: node.isRightSibling,
                }
              : toOracleNode(node)
          ),
        },
      },
    ];

    for (const tc of tamperCases) {
      if (tc.id === "goals-tampered-path" && validation.statProof.length === 0) continue;

      const ix = buildValidateStatIx({ ...baseArgs, statA: tc.statA });
      logger.info("proof-integrity", `Submitting tampered validate_stat (${tc.id})...`);
      const result = await sendValidateStat(conn, payer, ix);

      cases.push({
        id: tc.id,
        title: tc.title,
        kind: "tampered",
        statLabel: spec.statLabel,
        statKeys: [spec.keyA, spec.keyB],
        provenValues: [tc.statA.statToProve.value, statB.statToProve.value],
        predicateLabel: predicateLabel(spec, [
          tc.statA.statToProve.value,
          statB.statToProve.value,
        ]),
        tamper: tc.tamper,
        expected: "rejected",
        oracleTsMs: validation.ts,
        dailyRootsPda: dailyRootsPda.toBase58(),
        errorName: result.errorCode !== null ? describeOracleError(result.errorCode) : null,
        ...result,
      });

      logger.success(
        "proof-integrity",
        `${tc.id}: accepted=${result.accepted} err=${result.errorCode} tx=${result.txSignature}`
      );
    }
  }

  const artifact: ProofIntegrityArtifact = {
    fixtureId: Number(fixtureId),
    seq,
    oracleProgram: TXORACLE_PROGRAM_ID.toBase58(),
    recordedAt: new Date().toISOString(),
    cases,
  };

  return artifact;
}
