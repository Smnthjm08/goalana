use anchor_lang::prelude::*;

use crate::{Market, MarketStatus, TraderPredicate};

#[derive(Accounts)]
#[instruction(fixture_id: i64, predicate: TraderPredicate)]
pub struct CreateMarket<'info> {
    #[account(
    init,
    payer = owner,
    space = Market::LEN,
    seeds = [
        b"market",
        fixture_id.to_le_bytes().as_ref(),
        // TODO impl
        &predicate.seed(),
    ],
        bump,
    )]
    pub market: Account<'info, Market>,

    #[account(
    mut,
    seeds = [b"vault", market.key().as_ref()],
    bump,
    )]
    pub vault: SystemAccount<'info>,

    #[account(mut)]
    pub owner: Signer<'info>,

    pub system_program: Program<'info, System>,
}

pub fn handle_create_market(
    ctx: Context<CreateMarket>,
    fixture_id: i64,
    predicate: TraderPredicate,
) -> Result<()> {
    let market = &mut ctx.accounts.market;

    market.creator = ctx.accounts.owner.key();

    market.fixture_id = fixture_id;

    market.predicate = predicate;

    market.status = MarketStatus::Open;

    market.vault = ctx.accounts.vault.key();

    // market.vault_bump = ctx.bumps.vault;

    market.total_for = 0;

    market.total_against = 0;

    market.open_intents = 0;

    market.matched_amount = 0;

    market.outcome = None;

    market.settled_at = None;

    market.bump = ctx.bumps.market;

    Ok(())
}
