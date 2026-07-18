// challenge_pool.rs
use crate::error::GoalanaError;
use anchor_lang::prelude::*;

/// On-chain, immutable terms for a user-proposed fixed-stake N-vs-N
/// "challenge pool" (final-features.md #1).
///
/// A ChallengePool is a companion account to a normal Market: the Market holds
/// the settlement predicate + pari-mutuel escrow exactly as any other market,
/// while this account commits the pool's *economic* terms — the fixed per-entry
/// stake and the per-side entrant cap — into consensus so they are publicly
/// verifiable on Explorer and enforced on-chain by `place_challenge_bet`.
///
/// It is deliberately additive: it does not change the Market layout, and the
/// generic `place_bet`/`settle_market`/`claim_*` instructions are untouched.
///
/// PDA:
///
/// seeds = [
///     b"challenge",
///     market.key(),
/// ]
#[account]
pub struct ChallengePool {
    /// The Market whose bets this pool constrains.
    pub market: Pubkey,

    /// Wallet that proposed the pool. Informational provenance only — it is NOT
    /// an authority and grants no privileges (the house signs creation).
    pub proposed_by: Pubkey,

    /// Every entrant must stake exactly this many lamports on either side.
    pub fixed_stake: u64,

    /// Maximum entrants per side. The total stake allowed on a single side is
    /// `fixed_stake * slots_per_side`.
    pub slots_per_side: u16,

    /// PDA bump.
    pub bump: u8,
}

impl ChallengePool {
    pub const LEN: usize = 8 + // Anchor discriminator
        32 + // market: Pubkey
        32 + // proposed_by: Pubkey
        8 +  // fixed_stake: u64
        2 +  // slots_per_side: u16
        1; // bump: u8

    /// Maximum total lamports allowed on a single side of the pool.
    pub fn max_per_side(&self) -> Result<u64> {
        self.fixed_stake
            .checked_mul(self.slots_per_side as u64)
            .ok_or(error!(GoalanaError::ArithmeticOverflow))
    }
}
