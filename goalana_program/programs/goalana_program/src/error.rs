use anchor_lang::prelude::*;

#[error_code]
pub enum GoalanaError {
    #[msg("Predicate hash does not match the provided predicate.")]
    InvalidPredicateHash,

    #[msg("Predicate structure is invalid.")]
    InvalidPredicateStructure,

    #[msg("Unauthorized market authority.")]
    UnauthorizedMarketAuthority,

    #[msg("Market is not open.")]
    MarketNotOpen,

    #[msg("Market is not settled.")]
    MarketNotSettled,

    #[msg("Market is not a public orderbook.")]
    NotPublicOrderbook,

    #[msg("Unauthorized caller.")]
    Unauthorized,

    #[msg("Market cannot be cancelled in its current state.")]
    MarketNotCancellable,

    #[msg("Lock time must be in the future.")]
    InvalidLockTime,

    #[msg("Market is not locked.")]
    MarketNotLocked,

    #[msg("TxLINE fixture does not match the market fixture.")]
    FixtureMismatch,

    #[msg("Stat key does not match the market predicate.")]
    StatKeyMismatch,

    #[msg("Arithmetic overflow occurred.")]
    ArithmeticOverflow,

    #[msg("Market is not in a settleable state (must be Open or Locked).")]
    MarketNotSettleable,

    #[msg("Market outcome is already recorded.")]
    MarketAlreadySettled,

    #[msg("Invalid stat key — not a known TxLINE soccer stat key.")]
    InvalidStatKey,

    #[msg("BinaryOp is required when stat_b_key is present.")]
    MissingBinaryOp,

    #[msg("BinaryOp must not be set when stat_b_key is absent.")]
    UnexpectedBinaryOp,
}
