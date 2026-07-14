pub mod constants;
pub mod error;
pub mod instructions;
pub mod state;
pub mod txline_cpi;

use anchor_lang::prelude::*;

pub use instructions::*;
pub use state::*;

declare_id!("AgxqK6wRkFKyabyArNiJF8dpoJ6TNLLxPnV5rg27pRQu");

#[program]
pub mod goalana_program {
    use super::*;

    pub fn initialize_config(ctx: Context<InitializeConfig>) -> Result<()> {
        instructions::initialize_config::handle_initialize_config(ctx)
    }

    pub fn create_market(
        ctx: Context<CreateMarket>,
        fixture_id: i64,
        predicate: Predicate,
        predicate_hash: [u8; 32],
        locks_at: i64,
        settle_after: i64,
    ) -> Result<()> {
        instructions::create_market::handle_create_market(
            ctx,
            fixture_id,
            predicate,
            predicate_hash,
            locks_at,
            settle_after,
        )
    }

    pub fn lock_market(ctx: Context<LockMarket>) -> Result<()> {
        instructions::lock_market::handle_lock_market(ctx)
    }

    pub fn cancel_market(ctx: Context<CancelMarket>) -> Result<()> {
        instructions::cancel_market::handle_cancel_market(ctx)
    }

    pub fn settle_market(
        ctx: Context<SettleMarket>,
        oracle_ts_ms: i64,
        fixture_summary: txline_cpi::ScoresBatchSummary,
        fixture_proof: Vec<txline_cpi::ProofNode>,
        main_tree_proof: Vec<txline_cpi::ProofNode>,
        stat_a: txline_cpi::StatTerm,
        stat_b: Option<txline_cpi::StatTerm>,
    ) -> Result<()> {
        instructions::settle_market::handle_settle_market(
            ctx,
            oracle_ts_ms,
            fixture_summary,
            fixture_proof,
            main_tree_proof,
            stat_a,
            stat_b,
        )
    }

    pub fn place_bet(
        ctx: Context<PlaceBet>,
        side: BetSide,
        amount: u64,
    ) -> Result<()> {
        instructions::place_bet::handle_place_bet(ctx, side, amount)
    }

    pub fn claim_winnings(ctx: Context<ClaimWinnings>) -> Result<()> {
        instructions::claim_winnings::handle_claim_winnings(ctx)
    }

    pub fn claim_refund(ctx: Context<ClaimRefund>) -> Result<()> {
        instructions::claim_refund::handle_claim_refund(ctx)
    }
}
