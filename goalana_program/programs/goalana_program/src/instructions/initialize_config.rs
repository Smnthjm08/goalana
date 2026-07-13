use crate::{error::GoalanaError, ProtocolConfig};
use anchor_lang::prelude::*;

#[derive(Accounts)]
pub struct InitializeConfig<'info> {
    #[account(mut)]
    pub admin: Signer<'info>,

    #[account(
        init,
        payer = admin,
        space = ProtocolConfig::LEN,
        seeds = [b"config"],
        bump
    )]
    pub config: Account<'info, ProtocolConfig>,

    pub system_program: Program<'info, System>,
}

pub fn handle_initialize_config(ctx: Context<InitializeConfig>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    let admin = ctx.accounts.admin.key();

    config.authority = admin;
    config.market_authority = admin;
    config.settlement_authority = admin;
    config.bump = ctx.bumps.config;

    msg!("Config initialized by {}. New market authority: {}", admin.to_string(), admin.to_string());

    Ok(())
}
