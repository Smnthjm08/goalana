use anchor_lang::prelude::*;
use crate::{
    state::{Market, MarketStatus},
    txline_cpi::{
        self, BinaryExpression, Comparison, ProofNode, ScoresBatchSummary, StatTerm,
        TraderPredicate,
    },
    error::GoalanaError,
};

#[derive(Accounts)]
pub struct SettleMarket<'info> {
    #[account(
        mut,
        seeds = [b"market", market.fixture_id.to_le_bytes().as_ref(), market.predicate_hash.as_ref()],
        bump = market.bump,
        // Locked-only settlement. If market is still Open but past locks_at,
        // the backend should call lock_market first. See handler for time-based fallback.
        constraint = (
            market.status == MarketStatus::Locked
            || (market.status == MarketStatus::Open)
        ) @ GoalanaError::MarketNotSettleable,
        constraint = market.outcome.is_none() @ GoalanaError::MarketAlreadySettled,
    )]
    pub market: Account<'info, Market>,

    /// CHECK: Address constrained to the official TxOracle program ID.
    #[account(address = txline_cpi::id())]
    pub txoracle_program: UncheckedAccount<'info>,

    /// CHECK: Validated by TxOracle's own Anchor account constraints during CPI.
    /// TxOracle's validate_stat constrains this to the expected Merkle roots PDA.
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

    // Enforce time-based settlement gate.
    // If status is Open, only allow if we are past locks_at (betting has closed).
    // If status is Locked, always allow (lock_market was explicitly called).
    let now = Clock::get()?.unix_timestamp;
    require!(
        market.status == MarketStatus::Locked
            || (market.status == MarketStatus::Open && now >= market.locks_at),
        GoalanaError::MarketNotSettleable
    );
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

    // Authenticate the exact StatTerms used below.
    txline_cpi::validate_stat(
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

    // 4. Get authenticated stat value(s)
    let stat_a_value = stat_a.stat_to_prove.value;
    let stat_b_value = stat_b.map(|sb| sb.stat_to_prove.value);

    // 5. market.predicate.evaluate(...)
    let outcome = market.predicate.evaluate(stat_a_value, stat_b_value)?;

    // 6. Market -> Settled
    market.outcome = Some(outcome);
    market.status = MarketStatus::Settled;
    market.settled_at = Some(Clock::get()?.unix_timestamp);

    Ok(())
}
