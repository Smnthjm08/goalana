use anchor_lang::prelude::*;

#[error_code]
pub enum GoalanaError {
    #[msg("Predicate seed does not match the provided predicate.")]
    PredicateSeedMismatch,

    #[msg("Market is not open.")]
    MarketNotOpen,

    #[msg("Market is not settled.")]
    MarketNotSettled,

    #[msg("Market is not a public orderbook.")]
    NotPublicOrderbook,

    #[msg("Unauthorized caller.")]
    Unauthorized,
}
