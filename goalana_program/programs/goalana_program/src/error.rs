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

    #[msg("Arithmetic overflow occurred.")]
    ArithmeticOverflow,
}
