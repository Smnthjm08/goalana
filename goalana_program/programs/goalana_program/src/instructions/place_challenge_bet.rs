// place_challenge_bet.rs
//
// The enforced entry path for challenge pools. Identical escrow mechanics to
// `place_bet`, with two additional in-consensus checks against the companion
// ChallengePool account:
//
//   1. the stake is fixed — every entrant contributes exactly `fixed_stake`
//      lamports (the amount is taken from the pool, not the caller), and
//   2. each side is capped at `fixed_stake * slots_per_side` total.
//
// A bet that would violate either rule reverts — the same "the wrong thing
// physically cannot move the money" property the settlement path relies on.
use crate::{
    error::GoalanaError,
    state::{BetSide, ChallengePool, Market, MarketStatus, Position, Vault},
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct PlaceChallengeBet<'info> {
    #[account(
        mut,
        seeds = [b"market", market.fixture_id.to_le_bytes().as_ref(), market.predicate_hash.as_ref()],
        bump = market.bump,
        constraint = market.status == MarketStatus::Open @ GoalanaError::MarketNotOpen,
    )]
    pub market: Account<'info, Market>,

    #[account(
        seeds = [b"challenge", market.key().as_ref()],
        bump = challenge_pool.bump,
        has_one = market @ GoalanaError::InvalidChallengePool,
    )]
    pub challenge_pool: Account<'info, ChallengePool>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + Vault::LEN,
        seeds = [b"vault", market.key().as_ref()],
        bump,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        init_if_needed,
        payer = user,
        space = 8 + Position::LEN,
        seeds = [b"position", market.key().as_ref(), user.key().as_ref()],
        bump,
    )]
    pub position: Account<'info, Position>,

    #[account(mut)]
    pub user: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handle_place_challenge_bet(ctx: Context<PlaceChallengeBet>, side: BetSide) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let position = &mut ctx.accounts.position;
    let vault = &mut ctx.accounts.vault;
    let pool = &ctx.accounts.challenge_pool;

    let now_ts_secs = Clock::get()?.unix_timestamp;
    require!(now_ts_secs < market.locks_at, GoalanaError::BettingLocked);

    // The stake is defined by the pool, not the caller — this is what makes the
    // pool a genuine fixed-stake pool rather than a UI convention.
    let amount = pool.fixed_stake;
    require!(amount > 0, GoalanaError::InvalidBetAmount);

    // Enforce the per-side entrant cap.
    let max_per_side = pool.max_per_side()?;
    let side_total_after = match side {
        BetSide::Yes => market.total_yes,
        BetSide::No => market.total_no,
    }
    .checked_add(amount)
    .ok_or(GoalanaError::ArithmeticOverflow)?;
    require!(
        side_total_after <= max_per_side,
        GoalanaError::ChallengePoolSideFull
    );

    // Store canonical PDA bumps.
    vault.bump = ctx.bumps.vault;

    // Initialize Position metadata if newly created.
    if position.market == Pubkey::default() {
        position.market = market.key();
        position.user = ctx.accounts.user.key();
        position.yes_amount = 0;
        position.no_amount = 0;
        position.claimed = false;
    }

    position.bump = ctx.bumps.position;

    // Transfer SOL from user to program-owned vault account.
    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.key(),
        anchor_lang::system_program::Transfer {
            from: ctx.accounts.user.to_account_info(),
            to: vault.to_account_info(),
        },
    );
    anchor_lang::system_program::transfer(cpi_ctx, amount)?;

    // Update pool amounts.
    match side {
        BetSide::Yes => {
            position.yes_amount = position
                .yes_amount
                .checked_add(amount)
                .ok_or(GoalanaError::ArithmeticOverflow)?;
            market.total_yes = market
                .total_yes
                .checked_add(amount)
                .ok_or(GoalanaError::ArithmeticOverflow)?;
        }
        BetSide::No => {
            position.no_amount = position
                .no_amount
                .checked_add(amount)
                .ok_or(GoalanaError::ArithmeticOverflow)?;
            market.total_no = market
                .total_no
                .checked_add(amount)
                .ok_or(GoalanaError::ArithmeticOverflow)?;
        }
    }

    Ok(())
}
