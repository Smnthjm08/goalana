use anchor_lang::{prelude::*, solana_program::instruction::Instruction, solana_program::program::invoke, AnchorSerialize};

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

pub fn validate_stat<'info>(
    txoracle_program: AccountInfo<'info>,
    daily_scores_merkle_roots: AccountInfo<'info>,
    ts: i64,
    fixture_summary: ScoresBatchSummary,
    fixture_proof: Vec<ProofNode>,
    main_tree_proof: Vec<ProofNode>,
    predicate: TraderPredicate,
    stat_a: StatTerm,
    stat_b: Option<StatTerm>,
    op: Option<BinaryExpression>,
) -> Result<()> {
    let mut data = vec![107, 197, 232, 90, 191, 136, 105, 185]; // validate_stat discriminator
    ts.serialize(&mut data)?;
    fixture_summary.serialize(&mut data)?;
    fixture_proof.serialize(&mut data)?;
    main_tree_proof.serialize(&mut data)?;
    predicate.serialize(&mut data)?;
    stat_a.serialize(&mut data)?;
    stat_b.serialize(&mut data)?;   
    op.serialize(&mut data)?;

    let accounts = vec![
        AccountMeta::new_readonly(daily_scores_merkle_roots.key(), false),
    ];

    let ix = Instruction {
        program_id: txoracle_program.key(),
        accounts,
        data,
    };

    // invoke (not invoke_signed) — no PDA signer needed for this CPI.
    // Security model: if this CPI succeeds, the Merkle proof is valid and the
    // stat values inside stat_a/stat_b are authentic TxLINE-published values
    // for this fixture. We then safely use those values in evaluate().
    // The txoracle_program account is included so the runtime can verify it
    // as an executable program account.
    invoke(
        &ix,
        &[
            daily_scores_merkle_roots,
            txoracle_program,
        ],
    )?;

    Ok(())
}
