use anchor_lang::prelude::*;

declare_id!("6pW64gN1s2uqjHkn1unFeEjAwJkPGHoppGvS715wyP2J");

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub struct ScoresBatchSummary {
    pub fixture_id: i64,
    pub update_stats: ScoresUpdateStats,
    pub events_sub_tree_root: [u8; 32],
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub struct ScoresUpdateStats {
    pub update_count: i32,
    pub min_timestamp: i64,
    pub max_timestamp: i64,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub struct ProofNode {
    pub hash: [u8; 32],
    pub is_right_sibling: bool,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub struct TraderPredicate {
    pub threshold: i32,
    pub comparison: Comparison,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub enum Comparison {
    GreaterThan,
    LessThan,
    EqualTo,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub struct StatTerm {
    pub stat_to_prove: ScoreStat,
    pub event_stat_root: [u8; 32],
    pub stat_proof: Vec<ProofNode>,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub struct ScoreStat {
    pub key: u32,
    pub value: i32,
    pub period: i32,
}

#[derive(AnchorSerialize, AnchorDeserialize, Clone, Debug, PartialEq)]
pub enum BinaryExpression {
    Add,
    Subtract,
}

#[program]
pub mod txoracle_mock {
    use super::*;

    #[allow(unused_variables)]
    pub fn validate_stat(
        ctx: Context<ValidateStat>,
        ts: i64,
        fixture_summary: ScoresBatchSummary,
        fixture_proof: Vec<ProofNode>,
        main_tree_proof: Vec<ProofNode>,
        predicate: TraderPredicate,
        stat_a: StatTerm,
        stat_b: Option<StatTerm>,
        op: Option<BinaryExpression>,
    ) -> Result<()> {
        // Mock outcome logic:
        // Returns true (1) if threshold >= 100, false (0) otherwise.
        let outcome = if predicate.threshold >= 100 { 1u8 } else { 0u8 };
        anchor_lang::solana_program::program::set_return_data(&[outcome]);
        Ok(())
    }

    #[allow(unused_variables)]
    pub fn insert_scores_root(
        ctx: Context<InsertScoresRoot>,
        epoch_day: u16,
        hour_of_day: u8,
        minute_of_hour: u8,
        root: [u8; 32],
    ) -> Result<()> {
        Ok(())
    }
}

#[derive(Accounts)]
pub struct ValidateStat<'info> {
    /// CHECK: read-only daily scores merkle roots
    pub daily_scores_merkle_roots: UncheckedAccount<'info>,
}

#[derive(Accounts)]
#[instruction(epoch_day: u16)]
pub struct InsertScoresRoot<'info> {
    #[account(mut)]
    pub authority: Signer<'info>,

    #[account(
        init,
        payer = authority,
        space = 8 + 1024,
        seeds = [b"daily_scores_roots", epoch_day.to_le_bytes().as_ref()],
        bump
    )]
    /// CHECK: the daily scores roots PDA
    pub daily_scores_roots: UncheckedAccount<'info>,

    pub system_program: Program<'info, System>,
}
