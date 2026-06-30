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

    pub fn create_market() -> Result<()>{
        crate::instructions::create_market::handle_create_market()
    }

    pub fn place_bet() -> Result<()>{
        crate::instructions::place_bet::handle_place_bet()
    }

    pub fn settle_market() -> Result<()> {
        crate::instructions::settle_market::handle_settle_market()
    }

    pub fn claim_winnings() -> Result<()> {
        crate::instructions::claim_winnings::handle_claim_winnings()
    }

    pub fn close_bet() -> Result<()> {
        crate::instructions::close_bet::handle_close_bet()
    }
}
