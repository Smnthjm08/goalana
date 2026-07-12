use crate::error::GoalanaError;
use crate::{
    Market,
    MarketOrigin,
    MarketStatus,
    Predicate,
    ProtocolConfig,
};
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
)]
pub struct CreateMarket<'info> {
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

pub fn handle_create_market(
    ctx: Context<CreateMarket>,
    fixture_id: i64,
    predicate: Predicate,
    predicate_hash: [u8; 32],
) -> Result<()> {
    predicate.validate()?;

    let computed_hash = compute_predicate_hash(&predicate)?;

    require!(
        computed_hash == predicate_hash,
        GoalanaError::InvalidPredicateHash
    );

    let market = &mut ctx.accounts.market;

    market.created_by = ctx.accounts.creator.key();

    market.origin = MarketOrigin::House;

    market.fixture_id = fixture_id;

    market.predicate_hash = predicate_hash;

    market.predicate = predicate;

    market.status = MarketStatus::Open;

    market.outcome = None;

    market.created_at = Clock::get()?.unix_timestamp;

    market.locked_at = None;

    market.settled_at = None;

    market.cancelled_at = None;

    market.bump = ctx.bumps.market;

    Ok(())
}