/**
 * Shared Merkle proof primitives — used across Fixtures, Odds, and Scores validation.
 */

export interface ProofNode {
    /** Raw bytes of the sibling hash. */
    hash: number[];
    isRightSibling: boolean;
}

/** List_ProofNode: either empty (Nil) or an array of ProofNode. */
export type ProofList = [] | ProofNode[];
