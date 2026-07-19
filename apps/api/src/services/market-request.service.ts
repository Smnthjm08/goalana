// ─── Challenge Pool requests (final-features.md #1) ──────────────────────────
//
// User-proposed, fixed-stake, N-vs-N "challenge pools". Anyone submits a
// request; the house reviews and, on approval, signs the SAME authority-gated
// `create_market` instruction the cron already uses (create_market.rs enforces
// creator == config.market_authority). So this is community-DESIGNED markets
// with a house rubber-stamp — not permissionless on-chain creation, and no
// program change. The escrow underneath is the unchanged pari-mutuel path;
// equal fixed stakes on balanced sides simply make each winner double up.

import { prisma } from "@workspace/db";
import { type Predicate, TXLINE_STAT_KEYS, TXLINE_STAT_LABELS } from "@workspace/goalana-sdk";
import { createChallengeMarketForFixture } from "./goalana.service";
import { logger } from "../utils/logger";
import { LAMPORTS_PER_SOL, PublicKey } from "@solana/web3.js";

// Only stat pairs whose keys we've validated on-chain against real fixtures
// (see todo.md's stat-key validation) may back a challenge pool — the same
// three the parametric prop markets already settle on.
export const CHALLENGE_STATS = {
  GOALS: {
    label: "Total goals",
    statAKey: TXLINE_STAT_KEYS.HOME_GOALS,
    statBKey: TXLINE_STAT_KEYS.AWAY_GOALS,
  },
  CORNERS: {
    label: "Total corners",
    statAKey: TXLINE_STAT_KEYS.HOME_CORNERS,
    statBKey: TXLINE_STAT_KEYS.AWAY_CORNERS,
  },
  CARDS: {
    label: "Total yellow cards",
    statAKey: TXLINE_STAT_KEYS.HOME_YELLOW_CARDS,
    statBKey: TXLINE_STAT_KEYS.AWAY_YELLOW_CARDS,
  },
} as const;

export type ChallengeStat = keyof typeof CHALLENGE_STATS;

// Guard rails so a rogue request can't create an absurd on-chain market.
const MIN_STAKE_LAMPORTS = 0.001 * LAMPORTS_PER_SOL;
const MAX_STAKE_LAMPORTS = 5 * LAMPORTS_PER_SOL;
const MIN_SLOTS_PER_SIDE = 1;
const MAX_SLOTS_PER_SIDE = 11; // a full-team "11v11", generous upper bound
const MIN_THRESHOLD = 0;
const MAX_THRESHOLD = 50;

export interface CreateChallengeRequestInput {
  fixtureId: bigint;
  requesterWallet: string;
  stat: ChallengeStat;
  threshold: number;
  fixedStakeSol: number;
  slotsPerSide: number;
}

export class ChallengeRequestError extends Error {}

/**
 * Validate + persist a PENDING challenge-pool request. Does NOT touch the
 * chain — approval is a separate, house-gated step.
 */
export async function createChallengeRequest(input: CreateChallengeRequestInput) {
  const stat = CHALLENGE_STATS[input.stat];
  if (!stat) {
    throw new ChallengeRequestError(`Unknown stat "${input.stat}"`);
  }

  if (!input.requesterWallet || input.requesterWallet.length < 32) {
    throw new ChallengeRequestError("A valid requester wallet is required");
  }

  if (
    !Number.isInteger(input.threshold) ||
    input.threshold < MIN_THRESHOLD ||
    input.threshold > MAX_THRESHOLD
  ) {
    throw new ChallengeRequestError(
      `threshold must be a whole number between ${MIN_THRESHOLD} and ${MAX_THRESHOLD}`
    );
  }

  if (
    !Number.isInteger(input.slotsPerSide) ||
    input.slotsPerSide < MIN_SLOTS_PER_SIDE ||
    input.slotsPerSide > MAX_SLOTS_PER_SIDE
  ) {
    throw new ChallengeRequestError(
      `slotsPerSide must be a whole number between ${MIN_SLOTS_PER_SIDE} and ${MAX_SLOTS_PER_SIDE}`
    );
  }

  const fixedStakeLamports = Math.round(input.fixedStakeSol * LAMPORTS_PER_SOL);
  if (
    !Number.isFinite(fixedStakeLamports) ||
    fixedStakeLamports < MIN_STAKE_LAMPORTS ||
    fixedStakeLamports > MAX_STAKE_LAMPORTS
  ) {
    throw new ChallengeRequestError(
      `fixedStakeSol must be between ${MIN_STAKE_LAMPORTS / LAMPORTS_PER_SOL} and ${MAX_STAKE_LAMPORTS / LAMPORTS_PER_SOL} SOL`
    );
  }

  const fixture = await prisma.fixture.findUnique({
    where: { fixtureId: input.fixtureId },
  });
  if (!fixture) {
    throw new ChallengeRequestError(`Fixture ${input.fixtureId} not found`);
  }

  // Only pools on matches that haven't kicked off yet — a market must have
  // locks_at (kickoff) in the future for create_market to accept it.
  if (Number(fixture.startTime) <= Date.now()) {
    throw new ChallengeRequestError(
      "This match has already started — challenge pools must be proposed before kickoff"
    );
  }

  const question = buildQuestion(input.stat, input.threshold);

  return prisma.marketRequest.create({
    data: {
      fixtureId: input.fixtureId,
      requesterWallet: input.requesterWallet,
      question,
      statAKey: stat.statAKey,
      statBKey: stat.statBKey,
      op: "add",
      comparison: "greaterThan",
      threshold: input.threshold,
      fixedStakeLamports: BigInt(fixedStakeLamports),
      slotsPerSide: input.slotsPerSide,
      status: "PENDING",
    },
  });
}

function buildQuestion(stat: ChallengeStat, threshold: number): string {
  const label = CHALLENGE_STATS[stat].label;
  // threshold N + greaterThan ⇒ "> N.5" reads naturally for whole-goal lines.
  return `Will ${label.toLowerCase()} exceed ${threshold}.5?`;
}

export async function listChallengeRequests(filter: {
  fixtureId?: bigint;
  status?: string;
}) {
  return prisma.marketRequest.findMany({
    where: {
      ...(filter.fixtureId ? { fixtureId: filter.fixtureId } : {}),
      ...(filter.status ? { status: filter.status } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
}

/**
 * House review step. Signs the same authority-gated create_market the cron
 * uses, then stamps the fixed-stake / slots metadata onto the resulting Market
 * row so the UI can render + enforce the N-vs-N pool. Idempotent-ish:
 * createMarketForFixture no-ops on-chain if the PDA already exists.
 */
export async function approveChallengeRequest(requestId: string, reviewNote?: string) {
  const request = await prisma.marketRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new ChallengeRequestError(`Request ${requestId} not found`);
  if (request.status === "APPROVED") {
    throw new ChallengeRequestError("Request is already approved");
  }

  const fixture = await prisma.fixture.findUnique({
    where: { fixtureId: request.fixtureId },
  });
  if (!fixture) throw new ChallengeRequestError(`Fixture ${request.fixtureId} not found`);

  const locksAt = new Date(Number(fixture.startTime));
  const settleAfter = new Date(locksAt.getTime() + 15 * 60 * 1000);

  if (locksAt.getTime() <= Date.now()) {
    throw new ChallengeRequestError(
      "This match has already kicked off — the pool can no longer be created on-chain"
    );
  }

  const predicate: Predicate = {
    statAKey: request.statAKey,
    statBKey: request.statBKey,
    op: { add: {} },
    threshold: request.threshold,
    comparison: { greaterThan: {} },
  };

  let proposedBy: PublicKey;
  try {
    proposedBy = new PublicKey(request.requesterWallet);
  } catch {
    throw new ChallengeRequestError("Requester wallet is not a valid public key");
  }

  // Creates the Market + the on-chain ChallengePool that commits + enforces
  // the fixed stake and per-side cap (place_challenge_bet checks them).
  const result = await createChallengeMarketForFixture(
    request.fixtureId,
    predicate,
    locksAt,
    settleAfter,
    request.fixedStakeLamports,
    request.slotsPerSide,
    proposedBy
  );

  const marketPda = result.marketPda.toBase58();
  const marketType = `CHALLENGE_${request.statAKey}_${request.statBKey}_OVER_${request.threshold}`;

  await prisma.market.upsert({
    where: { marketPda },
    update: {
      fixedStakeLamports: request.fixedStakeLamports,
      slotsPerSide: request.slotsPerSide,
      proposedByWallet: request.requesterWallet,
    },
    create: {
      fixtureId: request.fixtureId,
      marketPda,
      predicateHash: Array.from(result.predicateHash || []).join(","),
      marketType,
      question: request.question,
      locksAt,
      settleAfter,
      creationTx: result.txSignature,
      sourceOddsMessageId: `challenge-pool-v1:${request.id}`,
      initialYesPct: null,
      initialNoPct: null,
      status: "OPEN",
      fixedStakeLamports: request.fixedStakeLamports,
      slotsPerSide: request.slotsPerSide,
      proposedByWallet: request.requesterWallet,
    },
  });

  logger.success(
    "market-request.service",
    `Approved challenge pool ${request.id} → market ${marketPda} (${request.slotsPerSide}v${request.slotsPerSide} @ ${Number(request.fixedStakeLamports) / LAMPORTS_PER_SOL} SOL)`
  );

  return prisma.marketRequest.update({
    where: { id: requestId },
    data: {
      status: "APPROVED",
      marketPda,
      reviewNote: reviewNote ?? null,
    },
  });
}

export async function rejectChallengeRequest(requestId: string, reviewNote?: string) {
  const request = await prisma.marketRequest.findUnique({ where: { id: requestId } });
  if (!request) throw new ChallengeRequestError(`Request ${requestId} not found`);

  return prisma.marketRequest.update({
    where: { id: requestId },
    data: { status: "REJECTED", reviewNote: reviewNote ?? null },
  });
}

// Small helper the API layer reuses so the labels stay in one place.
export function statLabel(statKey: number): string {
  return TXLINE_STAT_LABELS[statKey] ?? `stat ${statKey}`;
}
