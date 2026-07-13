use crate::error::GoalanaError;
use crate::{Market, MarketStatus, ProtocolConfig};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct CancelMarket<'info> {
    #[account(
        mut,
        constraint = (
            market.status == MarketStatus::Open
            || market.status == MarketStatus::Locked
        ) @ GoalanaError::MarketNotCancellable,
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

pub fn handle_cancel_market(ctx: Context<CancelMarket>) -> Result<()> {
    let market = &mut ctx.accounts.market;

    market.status = MarketStatus::Cancelled;
    market.cancelled_at = Some(Clock::get()?.unix_timestamp);

    Ok(())
}
