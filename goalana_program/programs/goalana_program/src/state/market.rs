use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum MarketType {
    PublicOrderbook,
    Challenge,
    Pool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum MarketStatus {
    Open,
    Locked,
    Settled,
    Cancelled,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum Comparison {
    GreaterThan,
    GreaterThanOrEqual,
    LessThan,
    LessThanOrEqual,
    Equal,
    NotEqual,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum BinaryOp {
    Add,
    Subtract,
}

/// Generic predicate describing how this market should be settled.
///
/// The frontend builds these from the Question Builder and derives
/// the Market PDA by hashing the serialized Predicate.
///
/// PDA:
/// [b"market", fixture_id.to_le_bytes(), sha256(borsh(predicate))[0..8]]
///
/// The hash is computed in the SDK, not on-chain.
#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy)]
pub struct Predicate {
    /// Primary TxLINE stat key.
    pub stat_a_key: u32,

    /// Optional second stat key.
    pub stat_b_key: Option<u32>,

    /// Optional arithmetic operation.
    pub op: Option<BinaryOp>,

    /// Comparison threshold.
    pub threshold: i32,

    /// Comparison operator.
    pub comparison: Comparison,
}

impl Predicate {
    pub const LEN: usize = 4 + 5 + 2 + 4 + 1; // 16 bytes
}
// Market
//
// PDA:
//
// seeds = [
//     b"market",
//     fixture_id.to_le_bytes(),
//     predicate_hash,
// ]
//
// where
//
// predicate_hash = sha256(borsh(predicate))[0..8]
//
// computed in packages/sdk/pdas.ts.
//
/// Invariant:
/// Exactly one Market exists for each
/// (fixture_id, predicate) pair.

#[account]
pub struct Market {
    // Identity
    pub creator: Pubkey,

    pub fixture_id: i64, // TxLINE fixture id.

    pub market_type: MarketType,

    pub predicate: Predicate,

    pub created_at: i64,

    // Lifecycle
    pub status: MarketStatus,

    pub outcome: Option<bool>,

    pub settled_at: Option<i64>,

    // Escrow
    pub vault: Pubkey,

    // Liquidity
    pub total_for: u64,

    pub total_against: u64,

    pub matched_amount: u64,

    // PDA
    pub bump: u8,
}

impl Market {
    pub const LEN: usize = 8 +  // discriminator
        32 + // creator
        8 +  // fixture_id
        1 +  // market_type
        Predicate::LEN +
        8 +  // created_at
        1 +  // status
        2 +  // outcome
        9 +  // settled_at
        32 + // vault
        8 +  // total_for
        8 +  // total_against
        8 +  // matched_amount
        1; // bump
}

#[account]
pub struct Vault {
    pub market: Pubkey,
    pub creator: Pubkey,
    pub bump: u8,
}

impl Vault {
    pub const LEN: usize = 8 +  // discriminator
        32 + // market
        32 + // autority
        1; // bump
}
