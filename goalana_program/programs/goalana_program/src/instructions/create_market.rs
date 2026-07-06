use crate::{Market, MarketStatus, MarketType, Predicate, Vault};
use anchor_lang::prelude::*;

#[derive(Accounts)]
#[instruction(
    fixture_id: i64,
    market_type: MarketType,
    predicate: Predicate,
    predicate_seed: [u8; 8],
)]
pub struct CreateMarket<'info> {
    #[account(
        init,
        payer = creator,
        space = Market::LEN,
        seeds = [
            b"market",
            fixture_id.to_le_bytes().as_ref(),
            predicate_seed.as_ref(),
        ],
        bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
        init,
        payer = creator,
        space = Vault::LEN,
        seeds = [
            b"vault",
            market.key().as_ref(),
        ],
        bump,
    )]
    pub vault: Account<'info, Vault>,

    #[account(mut)]
    pub creator: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handle_create_market(
    ctx: Context<CreateMarket>,
    fixture_id: i64,
    market_type: MarketType,
    predicate: Predicate,
    _predicate_seed: [u8; 8],
) -> Result<()> {
    let market = &mut ctx.accounts.market;

    let vault = &mut ctx.accounts.vault;

    market.creator = ctx.accounts.creator.key();

    market.fixture_id = fixture_id;

    market.market_type = market_type;

    market.predicate = predicate;

    market.created_at = Clock::get()?.unix_timestamp;

    market.status = MarketStatus::Open;

    market.outcome = None;

    market.settled_at = None;

    market.total_for = 0;

    market.total_against = 0;

    market.matched_amount = 0;

    market.vault = vault.key();

    market.bump = ctx.bumps.market;

    vault.market = market.key();

    vault.creator = ctx.accounts.creator.key();

    vault.bump = ctx.bumps.vault;

    Ok(())
}
