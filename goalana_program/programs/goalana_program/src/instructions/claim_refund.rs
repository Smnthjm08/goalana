use crate::{
    error::GoalanaError,
    state::{Market, MarketStatus, Position, Vault},
};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct ClaimRefund<'info> {
    #[account(
        mut,
        seeds = [b"market", market.fixture_id.to_le_bytes().as_ref(), market.predicate_hash.as_ref()],
        bump = market.bump,
        constraint = (
            market.status == MarketStatus::Cancelled
            || (
                market.status == MarketStatus::Settled
                && (
                    (market.outcome == Some(true) && market.total_yes == 0)
                    || (market.outcome == Some(false) && market.total_no == 0)
                )
            )
        ) @ GoalanaError::InvalidRefundState,
    )]
    pub market: Account<'info, Market>,

    #[account(
        mut,
        seeds = [b"vault", market.key().as_ref()],
        bump = vault.bump,
    )]
    pub vault: Account<'info, Vault>,

    #[account(
        mut,
        seeds = [b"position", market.key().as_ref(), user.key().as_ref()],
        bump = position.bump,
        constraint = position.market == market.key() @ GoalanaError::InvalidPosition,
        constraint = position.user == user.key() @ GoalanaError::InvalidPosition,
        constraint = !position.claimed @ GoalanaError::AlreadyClaimed,
    )]
    pub position: Account<'info, Position>,

    #[account(mut)]
    pub user: Signer<'info>,
}

pub fn handle_claim_refund(ctx: Context<ClaimRefund>) -> Result<()> {
    let refund_amount = ctx
        .accounts
        .position
        .yes_amount
        .checked_add(ctx.accounts.position.no_amount)
        .ok_or(GoalanaError::ArithmeticOverflow)?;

    require!(
        refund_amount > 0,
        GoalanaError::NoRefundableStake
    );

    let vault_info = ctx.accounts.vault.to_account_info();
    let user_info = ctx.accounts.user.to_account_info();

    // Protect the Vault account's rent-exempt reserve.
    let minimum_balance = Rent::get()?.minimum_balance(vault_info.data_len());

    let available_balance = vault_info
        .lamports()
        .checked_sub(minimum_balance)
        .ok_or(GoalanaError::InsufficientVaultBalance)?;

    require!(
        available_balance >= refund_amount,
        GoalanaError::InsufficientVaultBalance
    );

    let new_vault_balance = vault_info
        .lamports()
        .checked_sub(refund_amount)
        .ok_or(GoalanaError::ArithmeticOverflow)?;

    let new_user_balance = user_info
        .lamports()
        .checked_add(refund_amount)
        .ok_or(GoalanaError::ArithmeticOverflow)?;

    // Program-owned accounts may have their lamports directly mutated.
    **vault_info.try_borrow_mut_lamports()? = new_vault_balance;
    **user_info.try_borrow_mut_lamports()? = new_user_balance;

    ctx.accounts.position.claimed = true;

    emit!(RefundClaimed {
        market: ctx.accounts.market.key(),
        user: ctx.accounts.user.key(),
        amount: refund_amount,
    });

    Ok(())
}

#[event]
pub struct RefundClaimed {
    pub market: Pubkey,
    pub user: Pubkey,
    pub amount: u64,
}
