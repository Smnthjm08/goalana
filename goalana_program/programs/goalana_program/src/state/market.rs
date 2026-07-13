use anchor_lang::prelude::*;

#[derive(
    AnchorSerialize,
    AnchorDeserialize,
    Clone,
    Copy,
    PartialEq,
    Eq,
)]
pub enum MarketStatus {
    Open,
    Locked,
    Settled,
    Cancelled,
}


#[derive(
    AnchorSerialize,
    AnchorDeserialize,
    Clone,
    Copy,
    PartialEq,
    Eq,
)]
pub enum MarketOrigin {
    /// Official market created by the Goalana market authority.
    House,

    /// Permissionless market created by a user.
    User,
}

#[derive(
    AnchorSerialize,
    AnchorDeserialize,
    Clone,
    Copy,
    PartialEq,
    Eq,
)]
pub enum Comparison {
    GreaterThan,
    GreaterThanOrEqual,
    LessThan,
    LessThanOrEqual,
    Equal,
    NotEqual,
}

#[derive(
    AnchorSerialize,
    AnchorDeserialize,
    Clone,
    Copy,
    PartialEq,
    Eq,
)]
pub enum BinaryOp {
    Add,
    Subtract,
}



/// Generic predicate describing how this market should be settled.
///
/// The frontend builds this from the Question Builder.
///
/// Market PDA:
///
/// seeds = [
///     b"market",
///     fixture_id.to_le_bytes(),
///     sha256(borsh(predicate)),
/// ]
///
/// The SDK computes the predicate hash and the program verifies it
/// on-chain before creating the Market.
#[derive(
    AnchorSerialize,
    AnchorDeserialize,
    Clone,
    Copy,
    PartialEq,
    Eq,
)]
pub struct Predicate {
    /// Primary TxLINE stat key.
    pub stat_a_key: u32,

    /// Optional second TxLINE stat key.
    pub stat_b_key: Option<u32>,

    /// Optional arithmetic operation between stat A and stat B.
    pub op: Option<BinaryOp>,

    /// Value against which the resolved stat is compared.
    pub threshold: i32,

    /// Comparison operator.
    pub comparison: Comparison,
}

impl Predicate {
    /// Borsh serialized size:
    ///
    /// stat_a_key: u32         = 4
    /// stat_b_key: Option<u32> = 1 + 4 = 5
    /// op: Option<BinaryOp>    = 1 + 1 = 2
    /// threshold: i32          = 4
    /// comparison: enum        = 1
    ///
    /// Total                   = 16 bytes
    pub const LEN: usize = 4 + 5 + 2 + 4 + 1;

    pub fn validate(&self) -> Result<()> {
        match (self.stat_b_key, self.op) {
            (None, None) => Ok(()),
            (Some(_), Some(_)) => Ok(()),
            _ => err!(crate::error::GoalanaError::InvalidPredicateStructure),
        }
    }

    pub fn evaluate(
        &self,
        stat_a_value: i32,
        stat_b_value: Option<i32>,
    ) -> Result<bool> {
        let resolved_value = match (self.op, stat_b_value) {
            (None, None) => stat_a_value,

            (Some(BinaryOp::Add), Some(stat_b)) => {
                stat_a_value
                    .checked_add(stat_b)
                    .ok_or(crate::error::GoalanaError::ArithmeticOverflow)?
            }

            (Some(BinaryOp::Subtract), Some(stat_b)) => {
                stat_a_value
                    .checked_sub(stat_b)
                    .ok_or(crate::error::GoalanaError::ArithmeticOverflow)?
            }

            _ => {
                return err!(crate::error::GoalanaError::InvalidPredicateStructure);
            }
        };

        let outcome = match self.comparison {
            Comparison::GreaterThan => resolved_value > self.threshold,
            Comparison::GreaterThanOrEqual => resolved_value >= self.threshold,
            Comparison::LessThan => resolved_value < self.threshold,
            Comparison::LessThanOrEqual => resolved_value <= self.threshold,
            Comparison::Equal => resolved_value == self.threshold,
            Comparison::NotEqual => resolved_value != self.threshold,
        };

        Ok(outcome)
    }
}

// ============================================================
// Market
// ============================================================

/// Canonical prediction market.
///
/// Exactly one Market exists for each:
///
///     (fixture_id, predicate)
///
/// The Market is shared by all trading mechanisms:
///
///     Market
///       ├── Orderbook
///       ├── Challenge(s)
///       └── Pool
///
/// A Market may originally be created by:
///
/// - House: Goalana's configured market authority
/// - User: Any permissionless user
///
/// The origin does not affect settlement.
///
/// PDA:
///
/// seeds = [
///     b"market",
///     fixture_id.to_le_bytes(),
///     predicate_hash,
/// ]
///
/// where:
///
/// predicate_hash = sha256(borsh(predicate))
#[account]
pub struct Market {
    // ========================================================
    // Creation Metadata
    // ========================================================

    /// Wallet that originally created the canonical Market.
    ///
    /// This does NOT make the wallet the owner of the Market.
    pub created_by: Pubkey,

    /// Whether the Market was originally created by the
    /// Goalana House or by a permissionless user.
    pub origin: MarketOrigin,

    // ========================================================
    // Identity
    // ========================================================

    /// TxLINE fixture identifier.
    pub fixture_id: i64,

    /// SHA256 hash of the Borsh-serialized Predicate.
    pub predicate_hash: [u8; 32],

    /// Settlement condition for this Market.
    pub predicate: Predicate,

    // ========================================================
    // Lifecycle
    // ========================================================

    pub status: MarketStatus,

    /// Final result of the Predicate.
    ///
    /// None        -> not settled
    /// Some(true)  -> predicate resolved true
    /// Some(false) -> predicate resolved false
    pub outcome: Option<bool>,

    /// Unix timestamp when the Market was created.
    pub created_at: i64,

    /// Deterministic Unix timestamp when the Market automatically locks (e.g. event kickoff).
    pub locks_at: i64,

    /// Unix timestamp when the Market was locked manually or automatically.
    pub locked_at: Option<i64>,

    /// Unix timestamp when the Market was settled.
    pub settled_at: Option<i64>,

    /// Unix timestamp when the Market was cancelled.
    pub cancelled_at: Option<i64>,

    // ========================================================
    // PDA
    // ========================================================

    pub bump: u8,
}

impl Market {
    pub const LEN: usize =
        8 +                 // Anchor discriminator
        32 +                // created_by: Pubkey
        1 +                 // origin: MarketOrigin
        8 +                 // fixture_id: i64
        32 +                // predicate_hash: [u8; 32]
        Predicate::LEN +    // predicate: Predicate
        1 +                 // status: MarketStatus
        2 +                 // outcome: Option<bool>
        8 +                 // created_at: i64
        8 +                 // locks_at: i64
        9 +                 // locked_at: Option<i64>
        9 +                 // settled_at: Option<i64>
        9 +                 // cancelled_at: Option<i64>
        1;                  // bump: u8
}

#[account]
pub struct ProtocolConfig {
    /// Protocol administrator.
    pub authority: Pubkey,

    /// Wallet whose created Markets are classified as House markets.
    pub market_authority: Pubkey,

    /// Authority permitted to perform settlement operations
    /// until fully permissionless TxLINE verification is implemented.
    pub settlement_authority: Pubkey,

    pub bump: u8,
}

impl ProtocolConfig {
    pub const LEN: usize =
        8 +  // discriminator
        32 + // authority
        32 + // market_authority
        32 + // settlement_authority
        1;   // bump
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn predicate_validate_accepts_single_stat_predicate() {
        let predicate = Predicate {
            stat_a_key: 1,
            stat_b_key: None,
            op: None,
            threshold: 2,
            comparison: Comparison::GreaterThan,
        };

        assert!(predicate.validate().is_ok());
    }

    #[test]
    fn predicate_validate_rejects_operator_without_second_stat() {
        let predicate = Predicate {
            stat_a_key: 1,
            stat_b_key: None,
            op: Some(BinaryOp::Add),
            threshold: 2,
            comparison: Comparison::GreaterThan,
        };

        assert!(predicate.validate().is_err());
    }
}