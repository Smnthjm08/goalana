pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;

use anchor_lang::prelude::*;

pub use constants::*;
pub use instructions::*;
pub use state::*;

declare_id!("4x5y2L5V6NfbZDLJa7KFcESb8dt8DptAcv53iKNteBgM");

#[program]
pub mod goalana_program {
    use super::*;

    pub fn create_market(
        ctx: Context<CreateMarket>,
        fixture_id: i64,
        market_type: MarketType,
        predicate: Predicate,
        _predicate_seed: [u8; 8],
    ) -> Result<()> {
        instructions::create_market::handle_create_market(
            ctx,
            fixture_id,
            market_type,
            predicate,
            _predicate_seed,
        )
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
