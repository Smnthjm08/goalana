// create_challenge_market.rs
//
// Creates a normal Market PLUS a companion ChallengePool account that commits
// the fixed-stake / per-side-cap terms of a user-proposed "challenge pool"
// into consensus. Mirrors `create_market` exactly for the Market itself (same
// PDA, same predicate-hash verification, same time gates, same House authority
// gate) and additionally initialises the ChallengePool.
//
// Additive by design: does not alter the Market layout or any existing
// instruction. Settlement and claims run through the same shared
// `settle_market` / `claim_*` paths as any other market.
use crate::error::GoalanaError;
use crate::{ChallengePool, Market, MarketOrigin, MarketStatus, Predicate, ProtocolConfig};
use anchor_lang::prelude::*;
use solana_sha256_hasher::hash;

fn compute_predicate_hash(predicate: &Predicate) -> Result<[u8; 32]> {
    let mut serialized = Vec::with_capacity(Predicate::LEN);
    predicate.serialize(&mut serialized)?;

    Ok(hash(&serialized).to_bytes())
}

#[derive(Accounts)]
#[instruction(
    fixture_id: i64,
    predicate: Predicate,
    predicate_hash: [u8; 32],
    locks_at: i64,
    settle_after: i64,
)]
pub struct CreateChallengeMarket<'info> {
    #[account(
        init,
        payer = creator,
        space = Market::LEN,
        seeds = [
            b"market",
            fixture_id.to_le_bytes().as_ref(),
            predicate_hash.as_ref(),
        ],
        bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
        init,
        payer = creator,
        space = ChallengePool::LEN,
        seeds = [b"challenge", market.key().as_ref()],
        bump,
    )]
    pub challenge_pool: Account<'info, ChallengePool>,

    /// Global Goalana protocol configuration.
    #[account(
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Account<'info, ProtocolConfig>,

    #[account(
        mut,
        address = config.market_authority
            @ GoalanaError::UnauthorizedMarketAuthority,
    )]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

#[allow(clippy::too_many_arguments)]
pub fn handle_create_challenge_market(
    ctx: Context<CreateChallengeMarket>,
    fixture_id: i64,
    predicate: Predicate,
    predicate_hash: [u8; 32],
    locks_at: i64,
    settle_after: i64,
    fixed_stake: u64,
    slots_per_side: u16,
    proposed_by: Pubkey,
) -> Result<()> {
    predicate.validate()?;

    let computed_hash = compute_predicate_hash(&predicate)?;

    require!(
        computed_hash == predicate_hash,
        GoalanaError::InvalidPredicateHash
    );

    let now = Clock::get()?.unix_timestamp;

    require!(locks_at > now, GoalanaError::InvalidLockTime);

    require!(settle_after > locks_at, GoalanaError::InvalidSettlementTime);

    // Challenge-specific terms.
    require!(fixed_stake > 0, GoalanaError::InvalidChallengeConfig);
    require!(slots_per_side > 0, GoalanaError::InvalidChallengeConfig);
    // Guard the max-per-side multiplication can never overflow later.
    fixed_stake
        .checked_mul(slots_per_side as u64)
        .ok_or(GoalanaError::ArithmeticOverflow)?;

    let market = &mut ctx.accounts.market;

    market.created_by = ctx.accounts.creator.key();
    market.origin = MarketOrigin::House;
    market.fixture_id = fixture_id;
    market.predicate_hash = predicate_hash;
    market.predicate = predicate;
    market.status = MarketStatus::Open;
    market.outcome = None;
    market.created_at = now;
    market.locks_at = locks_at;
    market.settle_after = settle_after;
    market.locked_at = None;
    market.settled_at = None;
    market.cancelled_at = None;
    market.total_yes = 0;
    market.total_no = 0;
    market.bump = ctx.bumps.market;

    let pool = &mut ctx.accounts.challenge_pool;
    pool.market = market.key();
    pool.proposed_by = proposed_by;
    pool.fixed_stake = fixed_stake;
    pool.slots_per_side = slots_per_side;
    pool.bump = ctx.bumps.challenge_pool;

    Ok(())
}
