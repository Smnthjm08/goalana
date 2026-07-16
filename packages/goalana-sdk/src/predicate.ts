import crypto from "crypto";
import { type IdlTypes } from "@coral-xyz/anchor";
import { type GoalanaProgram } from "./types/goalana_program";

export type Predicate = IdlTypes<GoalanaProgram>["predicate"];

export function serializePredicate(predicate: Predicate): Buffer {
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

export function derivePredicateHash(predicate: Predicate): Uint8Array {
  const predicateBytes = serializePredicate(predicate);
  const hash = crypto.createHash("sha256").update(new Uint8Array(predicateBytes)).digest();
  return Uint8Array.from(hash);
}
