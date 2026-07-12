pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("AgxqK6wRkFKyabyArNiJF8dpoJ6TNLLxPnV5rg27pRQu");

#[program]
pub mod goalana_program {
    use super::*;

    pub fn create_market(
        ctx: Context<CreateMarket>,
        fixture_id: i64,
        predicate: Predicate,
        predicate_hash: [u8; 32],
    ) -> Result<()> {
        instructions::create_market::handle_create_market(
            ctx,
            fixture_id,
            predicate,
            predicate_hash,
        )
    }

    pub fn lock_market(ctx: Context<LockMarket>) -> Result<()> {
        instructions::lock_market::handle_lock_market(ctx)
    }

    pub fn cancel_market(ctx: Context<CancelMarket>) -> Result<()> {
        instructions::cancel_market::handle_cancel_market(ctx)
    }
}

// pub fn place_bet() -> Result<()> {
//     instructions::place_bet::handle_place_bet()
// }

// pub fn settle_market() -> Result<()> {
//     instructions::settle_market::handle_settle_market()
// }

// pub fn claim_winnings() -> Result<()> {
//     instructions::claim_winnings::handle_claim_winnings()
// }

// pub fn close_bet() -> Result<()> {
//     instructions::close_bet::handle_close_bet()
// }
