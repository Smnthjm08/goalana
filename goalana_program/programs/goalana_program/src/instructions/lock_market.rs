use crate::error::GoalanaError;
use crate::{Market, MarketStatus, ProtocolConfig};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct LockMarket<'info> {
    #[account(
        mut,
        constraint = market.status == MarketStatus::Open
            @ GoalanaError::MarketNotOpen,
    )]
    pub market: Account<'info, Market>,

    #[account(
        seeds = [b"config"],
        bump = config.bump,
    )]
    pub config: Account<'info, ProtocolConfig>,

    #[account(
        address = config.market_authority
            @ GoalanaError::UnauthorizedMarketAuthority,
    )]
    pub authority: Signer<'info>,
}

pub fn handle_lock_market(ctx: Context<LockMarket>) -> Result<()> {
    let market = &mut ctx.accounts.market;

    market.status = MarketStatus::Locked;
    market.locked_at = Some(Clock::get()?.unix_timestamp);

    Ok(())
}
