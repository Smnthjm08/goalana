use anchor_lang::prelude::*;

#[account]
pub struct Vault {
    /// PDA bump.
    pub bump: u8,
}

impl Vault {
    pub const LEN: usize = 1; // bump: u8
}
