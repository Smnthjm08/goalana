// Independent, client-side re-derivation of TxLINE's settlement Merkle proof.
//
// Reverse-engineered from real settled proofs (not documented anywhere in
// this repo or by TxLINE) by brute-forcing candidate leaf/node encodings
// against real England v Argentina and France v Spain fixture proofs until
// every intermediate hash reproduced bit-for-bit:
//   leaf  = sha256(u32_LE(key) || i32_LE(value) || i32_LE(period))   — 12 bytes, no domain prefix
//   node  = sha256(left || right), where `isRightSibling` on the sibling
//           node says which side it goes on (true → sibling is the right
//           operand, current hash is the left)
// Verified against real data for two full stages: stat leaf → eventStatRoot,
// and eventStatRoot → eventsSubTreeRoot (both explicitly present in every
// settlement proof, so both have a stated target to compare against). The
// third stage (→ anchored daily batch root) uses the identical node-combine
// step but has no independently stated target in this hackathon's proof
// payload to check against, so it is not claimed as verified here.
//
// Known edge case: a stat whose `value` is 0 (e.g. a team that scored zero
// goals) sometimes carries a sibling path that doesn't reproduce under this
// formula — observed on a real France v Spain proof where the away-goals
// stat (value 2) verified cleanly but the home-goals stat (value 0) didn't.
// TxLINE likely uses a distinct sparse/placeholder leaf encoding for
// zero-valued stats; this module reports per-stat results rather than
// failing the whole proof so a single such leaf doesn't read as fraud.

interface Stat {
  key: number
  value: number
  period: number
}
interface ProofNode {
  hash: string
  isRightSibling: boolean
}

function hexToBytes(hex: string): Uint8Array {
  const bytes = new Uint8Array(hex.length / 2)
  for (let i = 0; i < bytes.length; i++) {
    bytes[i] = parseInt(hex.slice(i * 2, i * 2 + 2), 16)
  }
  return bytes
}

function bytesToHex(bytes: Uint8Array): string {
  return Array.from(bytes)
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("")
}

function concatBytes(...arrs: Uint8Array[]): Uint8Array {
  const total = arrs.reduce((sum, a) => sum + a.length, 0)
  const out = new Uint8Array(total)
  let offset = 0
  for (const a of arrs) {
    out.set(a, offset)
    offset += a.length
  }
  return out
}

async function sha256(bytes: Uint8Array): Promise<Uint8Array> {
  const digest = await crypto.subtle.digest("SHA-256", bytes.slice().buffer as ArrayBuffer)
  return new Uint8Array(digest)
}

function leafBytes(stat: Stat): Uint8Array {
  const buf = new Uint8Array(12)
  const view = new DataView(buf.buffer)
  view.setUint32(0, stat.key >>> 0, true)
  view.setInt32(4, stat.value, true)
  view.setInt32(8, stat.period, true)
  return buf
}

async function leafHash(stat: Stat): Promise<Uint8Array> {
  return sha256(leafBytes(stat))
}

async function reproduceChain(
  leaf: Uint8Array,
  proof: ProofNode[]
): Promise<Uint8Array> {
  let current = leaf
  for (const node of proof) {
    const sibling = hexToBytes(node.hash)
    current = node.isRightSibling
      ? await sha256(concatBytes(current, sibling))
      : await sha256(concatBytes(sibling, current))
  }
  return current
}

/** Recomputes a single stat's leaf hash and chains it through its sibling
 *  path; returns whether the result matches the stated root. */
export async function verifyStatChain(
  stat: Stat,
  proof: ProofNode[],
  expectedRootHex: string
): Promise<{ matches: boolean; computedHex: string }> {
  const leaf = await leafHash(stat)
  const root = await reproduceChain(leaf, proof)
  const computedHex = bytesToHex(root)
  return { matches: computedHex === expectedRootHex, computedHex }
}

/** Recomputes an already-hashed root's chain through a further sibling path
 *  (used for the eventStatRoot → eventsSubTreeRoot stage). */
export async function verifyRootChain(
  rootHex: string,
  proof: ProofNode[],
  expectedRootHex: string
): Promise<{ matches: boolean; computedHex: string }> {
  const start = hexToBytes(rootHex)
  const root = await reproduceChain(start, proof)
  const computedHex = bytesToHex(root)
  return { matches: computedHex === expectedRootHex, computedHex }
}

export interface ProofVerificationResult {
  stat1: boolean
  stat2: boolean | null
  subTree: boolean
  /** true only if every stage that could be checked, checked out. */
  allVerified: boolean
}

export async function verifySettlementProof(proof: {
  statToProve: Stat
  statToProve2: Stat | null
  eventStatRoot: string
  statProof: ProofNode[]
  statProof2: ProofNode[]
  eventsSubTreeRoot: string
  subTreeProof: ProofNode[]
}): Promise<ProofVerificationResult> {
  const stat1Result = await verifyStatChain(
    proof.statToProve,
    proof.statProof,
    proof.eventStatRoot
  )
  const stat2Result = proof.statToProve2
    ? await verifyStatChain(proof.statToProve2, proof.statProof2, proof.eventStatRoot)
    : null
  const subTreeResult = await verifyRootChain(
    proof.eventStatRoot,
    proof.subTreeProof,
    proof.eventsSubTreeRoot
  )

  const stat1 = stat1Result.matches
  const stat2 = stat2Result ? stat2Result.matches : null
  const subTree = subTreeResult.matches

  return {
    stat1,
    stat2,
    subTree,
    allVerified: stat1 && (stat2 === null || stat2) && subTree,
  }
}
