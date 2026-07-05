use anchor_lang::prelude::*;

impl Market {
    pub const LEN: usize = 8 + // discriminator
        32 + // creator
        8 + // fixture_id
        1 + // predicate
        1 + // status
        32 + // vault
        8 + // total_for
        8 + // total_against
        4 + // open_intents
        8 + // matched_amount
        2 + // outcome: Option<bool>
        9 + // settled_at: Option<i64>
        1; // bump
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum MarketStatus {
    Open,
    Locked,
    Settled,
    Closed,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum TraderPredicate {
    HomeWin,
    Draw,
    AwayWin,

    Over25Goals,

    BothTeamsScore,
}

impl TraderPredicate {
    /// Stable byte used for PDA seeds.
    pub fn seed(&self) -> [u8; 1] {
        match self {
            TraderPredicate::HomeWin => [0],
            TraderPredicate::Draw => [1],
            TraderPredicate::AwayWin => [2],
            TraderPredicate::Over25Goals => [3],
            TraderPredicate::BothTeamsScore => [4],
        }
    }
}

/// Represents one prediction market for one fixture.
///
/// Example:
/// Fixture: Brazil vs Japan
/// Predicate: HomeWin
#[account]
pub struct Market {
    /// Account that created the market.
    pub creator: Pubkey,

    /// TxLINE fixture id.
    pub fixture_id: i64,

    /// Prediction represented by this market.
    pub predicate: TraderPredicate,

    /// Current market lifecycle.
    pub status: MarketStatus,

    /// Escrow vault PDA.
    pub vault: Pubkey,

    /// Total liquidity on FOR side.
    pub total_for: u64,

    /// Total liquidity on AGAINST side.
    pub total_against: u64,

    /// Number of open intents.
    pub open_intents: u32,

    /// Total matched liquidity.
    pub matched_amount: u64,

    /// Settlement outcome.
    pub outcome: Option<bool>,

    /// Settlement timestamp.
    pub settled_at: Option<i64>,

    /// PDA bump.
    pub bump: u8,
}
