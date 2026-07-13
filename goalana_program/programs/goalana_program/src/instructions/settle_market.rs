// settle_market.rs

use crate::{
    error::GoalanaError,
    state::{Market, MarketStatus},
    txline_cpi::{
        self, BinaryExpression, Comparison, ProofNode, ScoresBatchSummary, StatTerm,
        TraderPredicate,
    },
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct SettleMarket<'info> {
    #[account(
        mut,
        seeds = [b"market", market.fixture_id.to_le_bytes().as_ref(), market.predicate_hash.as_ref()],
        bump = market.bump,
        // Settleable if market is Open or Locked, and has not yet been settled.
        constraint = (
            market.status == MarketStatus::Locked
            || market.status == MarketStatus::Open
        ) @ GoalanaError::MarketNotSettleable,
        constraint = market.outcome.is_none() @ GoalanaError::MarketAlreadySettled,
    )]
    pub market: Account<'info, Market>,

    /// CHECK: Address constrained to the official TxOracle program ID.
    #[account(address = txline_cpi::id())]
    pub txoracle_program: UncheckedAccount<'info>,

    /// CHECK: Verified in handler to match the derived daily scores roots PDA.
    #[account(owner = txline_cpi::ID)]
    pub daily_scores_merkle_roots: UncheckedAccount<'info>,
}

pub fn handle_settle_market(
    ctx: Context<SettleMarket>,
    ts: i64,
    fixture_summary: ScoresBatchSummary,
    fixture_proof: Vec<ProofNode>,
    main_tree_proof: Vec<ProofNode>,
    stat_a: StatTerm,
    stat_b: Option<StatTerm>,
) -> Result<()> {
    let market = &mut ctx.accounts.market;

    // Derive and verify the canonical daily scores roots PDA
    let epoch_day = ts
        .checked_div(86_400_000)
        .and_then(|day| u16::try_from(day).ok())
        .ok_or_else(|| error!(GoalanaError::InvalidOracleTimestamp))?;

    let epoch_day_bytes = epoch_day.to_le_bytes();

    let (expected_pda, _bump) =
        Pubkey::find_program_address(&[b"daily_scores_roots", &epoch_day_bytes], &txline_cpi::ID);
    require_keys_eq!(
        ctx.accounts.daily_scores_merkle_roots.key(),
        expected_pda,
        GoalanaError::InvalidOraclePda
    );

    // Enforce the earliest configured settlement time.
    // This prevents settlement before the expected settlement window.
    // The supplied stat values are authenticated separately by the TxOracle CPI.
    let now = Clock::get()?.unix_timestamp;
    require!(now >= market.settle_after, GoalanaError::SettlementTooEarly);
    require!(
        fixture_summary.fixture_id == market.fixture_id,
        GoalanaError::FixtureMismatch
    );

    // Bind stat A.
    require!(
        stat_a.stat_to_prove.key == market.predicate.stat_a_key,
        GoalanaError::StatKeyMismatch
    );

    // Bind stat B.
    match (&stat_b, market.predicate.stat_b_key) {
        (Some(sb), Some(expected_key)) => {
            require!(
                sb.stat_to_prove.key == expected_key,
                GoalanaError::StatKeyMismatch
            );
        }
        (None, None) => {}
        _ => return err!(GoalanaError::InvalidPredicateStructure),
    }

    // Build EXACT TxOracle predicate.
    // No approximation here.
    let oracle_predicate = TraderPredicate {
        threshold: market.predicate.threshold as i32,
        comparison: match market.predicate.comparison {
            crate::state::Comparison::GreaterThan => Comparison::GreaterThan,
            crate::state::Comparison::LessThan => Comparison::LessThan,
            crate::state::Comparison::EqualTo => Comparison::EqualTo,
        },
    };

    let oracle_op = match market.predicate.op {
        Some(crate::state::BinaryOp::Add) => Some(BinaryExpression::Add),
        Some(crate::state::BinaryOp::Subtract) => Some(BinaryExpression::Subtract),
        None => None,
    };

    // Authenticate the exact StatTerms and evaluate the predicate on-chain via TxOracle CPI.
    let outcome = txline_cpi::validate_stat(
        ctx.accounts.txoracle_program.to_account_info(),
        ctx.accounts.daily_scores_merkle_roots.to_account_info(),
        ts,
        fixture_summary,
        fixture_proof,
        main_tree_proof,
        oracle_predicate,
        stat_a.clone(),
        stat_b.clone(),
        oracle_op,
    )?;

    // 6. Market -> Settled
    market.outcome = Some(outcome);
    market.status = MarketStatus::Settled;
    market.settled_at = Some(now);

    Ok(())
}
