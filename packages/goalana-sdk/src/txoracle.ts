import { PublicKey, TransactionInstruction } from "@solana/web3.js";
import { TXORACLE_PROGRAM_ID } from "./constants";

/**
 * Client-side builder for TxLINE's `validate_stat` — the oracle instruction our
 * `settle_market` invokes by CPI to verify a Merkle proof and evaluate a
 * predicate on-chain.
 *
 * Why this exists outside settlement: `validate_stat` takes a single read-only
 * account and returns its verdict via `set_return_data`, so it can also be
 * called as a TOP-LEVEL instruction. That is the only way to exercise TxLINE's
 * real Merkle verification directly — `settle_market`'s own guards (fixture
 * match, settle_after window, stat-key binding) all fire before the CPI, and
 * the program deliberately forbids settling a fixture that finished before its
 * market existed. Calling the oracle directly isolates the cryptographic check
 * itself, which is what the proof-integrity evidence records.
 *
 * The byte layout below mirrors `goalana_program/src/txline_cpi.rs` exactly —
 * same discriminator, same field order. If that file's structs change, this
 * must change with it or the oracle will reject the instruction data.
 */

/** Anchor discriminator for `validate_stat` (see txline_cpi.rs). */
export const VALIDATE_STAT_DISCRIMINATOR = Uint8Array.from([
  107, 197, 232, 90, 191, 136, 105, 185,
]);

export interface OracleProofNode {
  hash: number[];
  isRightSibling: boolean;
}

export interface OracleScoreStat {
  key: number;
  value: number;
  period: number;
}

export interface OracleStatTerm {
  statToProve: OracleScoreStat;
  eventStatRoot: number[];
  statProof: OracleProofNode[];
}

export interface OracleBatchSummary {
  fixtureId: number;
  updateStats: {
    updateCount: number;
    minTimestamp: number;
    maxTimestamp: number;
  };
  eventsSubTreeRoot: number[];
}

/** Borsh enum indices — must match txline_cpi.rs's declaration order. */
export const ORACLE_COMPARISON = { greaterThan: 0, lessThan: 1, equalTo: 2 } as const;
export const ORACLE_BINARY_OP = { add: 0, subtract: 1 } as const;

export type OracleComparison = keyof typeof ORACLE_COMPARISON;
export type OracleBinaryOp = keyof typeof ORACLE_BINARY_OP;

// ── Borsh writers ────────────────────────────────────────────────────────────
//
// Uint8Array + DataView rather than Buffer: this module is exported from the
// SDK that the web app also imports, and Buffer is a Node global. Everything is
// little-endian, matching Borsh.

function concatBytes(parts: Uint8Array[]): Uint8Array {
  const total = parts.reduce((n, part) => n + part.length, 0);
  const out = new Uint8Array(total);
  let offset = 0;
  for (const part of parts) {
    out.set(part, offset);
    offset += part.length;
  }
  return out;
}

function i64(value: number | bigint): Uint8Array {
  const out = new Uint8Array(8);
  new DataView(out.buffer).setBigInt64(0, BigInt(value), true);
  return out;
}

function i32(value: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setInt32(0, value, true);
  return out;
}

function u32(value: number): Uint8Array {
  const out = new Uint8Array(4);
  new DataView(out.buffer).setUint32(0, value, true);
  return out;
}

function hash32(bytes: number[]): Uint8Array {
  if (bytes.length !== 32) {
    throw new Error(`Expected a 32-byte hash, received ${bytes.length} bytes`);
  }
  return Uint8Array.from(bytes);
}

function proofVec(nodes: OracleProofNode[]): Uint8Array {
  return concatBytes([
    u32(nodes.length),
    ...nodes.map((node) =>
      concatBytes([hash32(node.hash), Uint8Array.from([node.isRightSibling ? 1 : 0])])
    ),
  ]);
}

function statTerm(term: OracleStatTerm): Uint8Array {
  return concatBytes([
    u32(term.statToProve.key),
    i32(term.statToProve.value),
    i32(term.statToProve.period),
    hash32(term.eventStatRoot),
    proofVec(term.statProof),
  ]);
}

export interface ValidateStatArgs {
  /** Oracle stat timestamp in ms — also selects the daily-roots PDA. */
  oracleTsMs: number;
  summary: OracleBatchSummary;
  /** TxLINE's `subTreeProof` — event stat root → events-subtree root. */
  fixtureProof: OracleProofNode[];
  /** TxLINE's `mainTreeProof` — subtree root → anchored daily batch root. */
  mainTreeProof: OracleProofNode[];
  predicate: { threshold: number; comparison: OracleComparison };
  statA: OracleStatTerm;
  statB: OracleStatTerm | null;
  op: OracleBinaryOp | null;
  /** The `daily_scores_roots` PDA for this timestamp (see getDailyScoresRootsPda). */
  dailyScoresRootsPda: PublicKey;
}

/**
 * Builds a top-level `validate_stat` instruction against TxLINE's oracle.
 * Read-only: the single account is the oracle's own anchored-roots PDA, so this
 * can never touch a Goalana market, vault, or position.
 */
export function buildValidateStatIx(args: ValidateStatArgs): TransactionInstruction {
  const data = concatBytes([
    VALIDATE_STAT_DISCRIMINATOR,
    i64(args.oracleTsMs),
    // ScoresBatchSummary
    i64(args.summary.fixtureId),
    i32(args.summary.updateStats.updateCount),
    i64(args.summary.updateStats.minTimestamp),
    i64(args.summary.updateStats.maxTimestamp),
    hash32(args.summary.eventsSubTreeRoot),
    proofVec(args.fixtureProof),
    proofVec(args.mainTreeProof),
    // TraderPredicate
    i32(args.predicate.threshold),
    Uint8Array.from([ORACLE_COMPARISON[args.predicate.comparison]]),
    statTerm(args.statA),
    // Option<StatTerm>
    args.statB
      ? concatBytes([Uint8Array.from([1]), statTerm(args.statB)])
      : Uint8Array.from([0]),
    // Option<BinaryExpression>
    args.op === null
      ? Uint8Array.from([0])
      : Uint8Array.from([1, ORACLE_BINARY_OP[args.op]]),
  ]);

  return new TransactionInstruction({
    programId: TXORACLE_PROGRAM_ID,
    keys: [{ pubkey: args.dailyScoresRootsPda, isSigner: false, isWritable: false }],
    data: Buffer.from(data),
  });
}

/**
 * TxLINE oracle error codes seen from the real devnet program. Only codes we
 * have actually observed are named — anything else is reported by number rather
 * than guessed at.
 */
export const TXORACLE_ERRORS: Record<number, string> = {
  6023: "InvalidStatProof",
};

/** Names a TxLINE oracle custom error code, falling back to the raw number. */
export function describeOracleError(code: number): string {
  return TXORACLE_ERRORS[code] ?? `Custom error ${code}`;
}
