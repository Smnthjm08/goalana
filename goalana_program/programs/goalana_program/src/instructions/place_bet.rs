use crate::{
    error::GoalanaError,
    state::{BetSide, Market, MarketStatus, Position, Vault},
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct PlaceBet<'info> {
    #[account(
        mut,
        seeds = [b"market", market.fixture_id.to_le_bytes().as_ref(), market.predicate_hash.as_ref()],
        bump = market.bump,
        constraint = market.status == MarketStatus::Open @ GoalanaError::MarketNotOpen,
    )]
    pub market: Account<'info, Market>,

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

pub fn handle_place_bet(
    ctx: Context<PlaceBet>,
    side: BetSide,
    amount: u64,
) -> Result<()> {
    let market = &mut ctx.accounts.market;
    let position = &mut ctx.accounts.position;
    let vault = &mut ctx.accounts.vault;

    let now_ts_secs = Clock::get()?.unix_timestamp;
    require!(now_ts_secs < market.locks_at, GoalanaError::BettingLocked);
    require!(amount > 0, GoalanaError::InvalidBetAmount);

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

    // Transfer SOL from user to program-owned vault account
    let cpi_ctx = CpiContext::new(
        ctx.accounts.system_program.key(),
        anchor_lang::system_program::Transfer {
            from: ctx.accounts.user.to_account_info(),
            to: vault.to_account_info(),
        },
    );
    anchor_lang::system_program::transfer(cpi_ctx, amount)?;

    // Update pool amounts
    match side {
        BetSide::Yes => {
            position.yes_amount = position.yes_amount
                .checked_add(amount)
                .ok_or(GoalanaError::ArithmeticOverflow)?;
            market.total_yes = market.total_yes
                .checked_add(amount)
                .ok_or(GoalanaError::ArithmeticOverflow)?;
        }
        BetSide::No => {
            position.no_amount = position.no_amount
                .checked_add(amount)
                .ok_or(GoalanaError::ArithmeticOverflow)?;
            market.total_no = market.total_no
                .checked_add(amount)
                .ok_or(GoalanaError::ArithmeticOverflow)?;
        }
    }

    Ok(())
}
