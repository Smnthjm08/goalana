use crate::{error::GoalanaError, state::Position};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct ClosePosition<'info> {
    #[account(
        mut,
        seeds = [b"position", position.market.as_ref(), user.key().as_ref()],
        bump = position.bump,
        constraint = position.user == user.key() @ GoalanaError::InvalidPosition,
        constraint = position.claimed @ GoalanaError::PositionNotClaimed,
        close = user,
    )]
    pub position: Account<'info, Position>,

    #[account(mut)]
    pub user: Signer<'info>,
}

/// Reclaims a `Position` account's rent once its stake has been claimed
/// (winnings or refund) — once `claimed`, the account holds nothing but
/// otherwise-unrecoverable rent. `close = user` does the actual work:
/// Anchor zeroes the account, marks it closed, and transfers its lamports
/// to `user`. Permissionless in the same sense as `claim_*` — only the
/// position's own user can ever benefit, so no house authority is involved.
pub fn handle_close_position(_ctx: Context<ClosePosition>) -> Result<()> {
    Ok(())
}
