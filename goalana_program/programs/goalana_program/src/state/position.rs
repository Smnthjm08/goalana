use anchor_lang::prelude::*;

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Copy, PartialEq, Eq)]
pub enum BetSide {
    Yes,
    No,
}

#[account]
pub struct Position {
    /// The market this position belongs to.
    pub market: Pubkey,

    /// The user who owns this position.
    pub user: Pubkey,

    /// Total amount bet on YES (in lamports).
    pub yes_amount: u64,

    /// Total amount bet on NO (in lamports).
    pub no_amount: u64,

    /// Whether the user has claimed winnings or a refund for this position.
    pub claimed: bool,

    /// PDA bump.
    pub bump: u8,
}

impl Position {
    pub const LEN: usize = 32 +  // market: Pubkey
        32 +  // user: Pubkey
        8 +   // yes_amount: u64
        8 +   // no_amount: u64
        1 +   // claimed: bool
        1;    // bump: u8
}
