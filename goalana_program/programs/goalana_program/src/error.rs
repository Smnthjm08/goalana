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

    #[msg("Settlement time must be after the lock time.")]
    InvalidSettlementTime,

    #[msg("TxOracle returned no settlement result")]
    MissingOracleReturnData,

    #[msg("Settlement result was returned by an unexpected program")]
    InvalidOracleReturnProgram,

    #[msg("TxOracle returned malformed settlement data")]
    InvalidOracleReturnData,

    #[msg("Invalid daily Merkle roots PDA")]
    InvalidOraclePda,

    #[msg("Settlement time has not been reached.")]
    SettlementTooEarly,

    #[msg("Invalid TxOracle timestamp.")]
    InvalidOracleTimestamp,

    #[msg("Oracle snapshot predates the market settlement window.")]
    StaleOracleSnapshot,

    #[msg("Betting is locked for this market.")]
    BettingLocked,

    #[msg("Bet amount must be greater than zero.")]
    InvalidBetAmount,

    #[msg("Already claimed winnings or refund.")]
    AlreadyClaimed,

    #[msg("No winning stake on this position.")]
    NoWinningStake,

    #[msg("Division by zero occurred.")]
    DivisionByZero,

    #[msg("Refund is not allowed (market must be cancelled or settled with no winning pool).")]
    InvalidRefundState,

    #[msg("Market is not cancelled.")]
    MarketNotCancelled,

    #[msg("Position does not belong to the expected market or user.")]
    InvalidPosition,

    #[msg("Position has no refundable stake.")]
    NoRefundableStake,

    #[msg("Insufficient vault balance to fulfill payout or refund.")]
    InsufficientVaultBalance,
}
