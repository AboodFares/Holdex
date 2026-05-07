use anchor_lang::prelude::*;
use anchor_spl::token::{self, Mint, Token, TokenAccount, Transfer};

declare_id!("ErTKtbuVhqLH8fp4Kp38ek8cRBJvN79eDk4E6Qc3QtZw");

// lock_type values
pub const LOCK_TIME: u8 = 0;
pub const LOCK_PRICE: u8 = 1;
pub const LOCK_EITHER: u8 = 2;

#[program]
pub mod no_paper_hands {
    use super::*;

    pub fn lock_tokens(
        ctx: Context<LockTokens>,
        lock_index: u64,
        amount: u64,
        // unix timestamp; 0 = no time requirement
        unlock_time: i64,
        // USD price * 10^6 (e.g. $1.50 = 1_500_000); 0 = no price requirement
        target_price_usd_e6: u64,
        // 0=time, 1=price, 2=either
        lock_type: u8,
    ) -> Result<()> {
        require!(amount > 0, LockError::ZeroAmount);

        let now = Clock::get()?.unix_timestamp;
        if unlock_time > 0 {
            require!(unlock_time > now, LockError::UnlockTimeInPast);
        }
        // Must have at least one condition
        require!(
            unlock_time > 0 || target_price_usd_e6 > 0,
            LockError::NoCondition
        );

        let lock = &mut ctx.accounts.lock;
        lock.owner = ctx.accounts.owner.key();
        lock.mint = ctx.accounts.mint.key();
        lock.vault = ctx.accounts.vault.key();
        lock.amount = amount;
        lock.unlock_time = unlock_time;
        lock.target_price_usd_e6 = target_price_usd_e6;
        lock.lock_type = lock_type;
        lock.lock_index = lock_index;
        lock.bump = ctx.bumps.lock;
        lock.vault_bump = ctx.bumps.vault;

        token::transfer(
            CpiContext::new(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.owner_token_account.to_account_info(),
                    to: ctx.accounts.vault.to_account_info(),
                    authority: ctx.accounts.owner.to_account_info(),
                },
            ),
            amount,
        )?;

        Ok(())
    }

    // Called when the TIME condition is satisfied (verified on-chain).
    // Price condition is validated by the frontend before this call.
    pub fn unlock_tokens(ctx: Context<UnlockTokens>, lock_index: u64) -> Result<()> {
        let lock = &ctx.accounts.lock;
        let now = Clock::get()?.unix_timestamp;

        let time_ok = lock.unlock_time == 0 || now >= lock.unlock_time;
        // For price-only (lock_type=1): no time restriction on-chain; price is
        // enforced client-side before calling this instruction.
        let unlocked = match lock.lock_type {
            LOCK_PRICE => true,
            LOCK_EITHER => time_ok || lock.target_price_usd_e6 == 0,
            _ => time_ok, // LOCK_TIME
        };

        require!(unlocked, LockError::StillLocked);

        let amount = lock.amount;
        let owner_key = lock.owner;
        let index_bytes = lock_index.to_le_bytes();
        let bump = lock.vault_bump;

        let seeds = &[b"vault", owner_key.as_ref(), index_bytes.as_ref(), &[bump]];
        let signer_seeds = &[&seeds[..]];

        token::transfer(
            CpiContext::new_with_signer(
                ctx.accounts.token_program.to_account_info(),
                Transfer {
                    from: ctx.accounts.vault.to_account_info(),
                    to: ctx.accounts.owner_token_account.to_account_info(),
                    authority: ctx.accounts.vault.to_account_info(),
                },
                signer_seeds,
            ),
            amount,
        )?;

        Ok(())
    }
}

#[derive(Accounts)]
#[instruction(lock_index: u64)]
pub struct LockTokens<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    pub mint: Box<Account<'info, Mint>>,

    #[account(
        init,
        payer = owner,
        space = LockAccount::LEN,
        seeds = [b"lock", owner.key().as_ref(), lock_index.to_le_bytes().as_ref()],
        bump
    )]
    pub lock: Box<Account<'info, LockAccount>>,

    #[account(
        init,
        payer = owner,
        token::mint = mint,
        token::authority = vault,
        seeds = [b"vault", owner.key().as_ref(), lock_index.to_le_bytes().as_ref()],
        bump
    )]
    pub vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = mint,
        token::authority = owner,
    )]
    pub owner_token_account: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
    pub rent: Sysvar<'info, Rent>,
}

#[derive(Accounts)]
#[instruction(lock_index: u64)]
pub struct UnlockTokens<'info> {
    #[account(mut)]
    pub owner: Signer<'info>,

    #[account(
        mut,
        seeds = [b"lock", owner.key().as_ref(), lock_index.to_le_bytes().as_ref()],
        bump = lock.bump,
        has_one = owner,
        has_one = vault,
        close = owner,
    )]
    pub lock: Box<Account<'info, LockAccount>>,

    #[account(
        mut,
        seeds = [b"vault", owner.key().as_ref(), lock_index.to_le_bytes().as_ref()],
        bump = lock.vault_bump,
    )]
    pub vault: Box<Account<'info, TokenAccount>>,

    #[account(
        mut,
        token::mint = lock.mint,
        token::authority = owner,
    )]
    pub owner_token_account: Box<Account<'info, TokenAccount>>,

    pub token_program: Program<'info, Token>,
    pub system_program: Program<'info, System>,
}

#[account]
pub struct LockAccount {
    pub owner: Pubkey,        // 32
    pub mint: Pubkey,         // 32
    pub vault: Pubkey,        // 32
    pub amount: u64,          // 8
    pub unlock_time: i64,     // 8  (0 = no time lock)
    pub target_price_usd_e6: u64, // 8  (0 = no price lock)
    pub lock_type: u8,        // 1  (0=time, 1=price, 2=either)
    pub lock_index: u64,      // 8
    pub bump: u8,             // 1
    pub vault_bump: u8,       // 1
}

impl LockAccount {
    // 8 + 32 + 32 + 32 + 8 + 8 + 8 + 1 + 8 + 1 + 1 = 139
    pub const LEN: usize = 8 + 32 + 32 + 32 + 8 + 8 + 8 + 1 + 8 + 1 + 1;
}

#[error_code]
pub enum LockError {
    #[msg("Amount must be greater than zero")]
    ZeroAmount,
    #[msg("Unlock time must be in the future")]
    UnlockTimeInPast,
    #[msg("Tokens are still locked")]
    StillLocked,
    #[msg("Must set at least one unlock condition")]
    NoCondition,
}
