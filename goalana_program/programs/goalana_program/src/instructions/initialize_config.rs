// initialize_config.rs
use crate::ProtocolConfig;
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
        bump,
    )]
    pub config: Account<'info, ProtocolConfig>,

    pub system_program: Program<'info, System>,
}

pub fn handle_initialize_config(ctx: Context<InitializeConfig>) -> Result<()> {
    let config = &mut ctx.accounts.config;
    let admin = ctx.accounts.admin.key();

    config.authority = admin;
    config.market_authority = admin;

    // Reserved for trusted/admin fallback settlement.
    // Permissionless TxLINE proof-based settlement should NOT
    // require this authority to sign.
    config.settlement_authority = admin;

    config.bump = ctx.bumps.config;

    msg!(
        "Protocol config initialized. Admin: {}, Market authority: {}, Settlement authority: {}",
        config.authority,
        config.market_authority,
        config.settlement_authority,
    );

    Ok(())
}
