export const IDL = {
  address: "ErTKtbuVhqLH8fp4Kp38ek8cRBJvN79eDk4E6Qc3QtZw",
  metadata: { name: "no_paper_hands", version: "0.1.0", spec: "0.1.0" },
  instructions: [
    {
      name: "lock_tokens",
      discriminator: [136, 11, 32, 232, 161, 117, 54, 211],
      accounts: [
        { name: "owner", writable: true, signer: true },
        { name: "mint" },
        { name: "lock", writable: true, pda: { seeds: [{ kind: "const", value: [108,111,99,107] }, { kind: "account", path: "owner" }, { kind: "arg", path: "lock_index" }] } },
        { name: "vault", writable: true, pda: { seeds: [{ kind: "const", value: [118,97,117,108,116] }, { kind: "account", path: "owner" }, { kind: "arg", path: "lock_index" }] } },
        { name: "owner_token_account", writable: true },
        { name: "token_program", address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
        { name: "system_program", address: "11111111111111111111111111111111" },
        { name: "rent", address: "SysvarRent111111111111111111111111111111111" },
      ],
      args: [
        { name: "lock_index", type: "u64" },
        { name: "amount", type: "u64" },
        { name: "unlock_time", type: "i64" },
        { name: "target_price_usd_e6", type: "u64" },
        { name: "lock_type", type: "u8" },
      ],
    },
    {
      name: "unlock_tokens",
      discriminator: [233, 35, 95, 159, 37, 185, 47, 88],
      accounts: [
        { name: "owner", writable: true, signer: true },
        { name: "lock", writable: true, pda: { seeds: [{ kind: "const", value: [108,111,99,107] }, { kind: "account", path: "owner" }, { kind: "arg", path: "lock_index" }] } },
        { name: "vault", writable: true, pda: { seeds: [{ kind: "const", value: [118,97,117,108,116] }, { kind: "account", path: "owner" }, { kind: "arg", path: "lock_index" }] } },
        { name: "owner_token_account", writable: true },
        { name: "token_program", address: "TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA" },
        { name: "system_program", address: "11111111111111111111111111111111" },
      ],
      args: [{ name: "lock_index", type: "u64" }],
    },
  ],
  accounts: [{ name: "LockAccount", discriminator: [223, 64, 71, 124, 255, 86, 118, 192] }],
  errors: [
    { code: 6000, name: "ZeroAmount", msg: "Amount must be greater than zero" },
    { code: 6001, name: "UnlockTimeInPast", msg: "Unlock time must be in the future" },
    { code: 6002, name: "StillLocked", msg: "Tokens are still locked" },
    { code: 6003, name: "NoCondition", msg: "Must set at least one unlock condition" },
  ],
  types: [
    {
      name: "LockAccount",
      type: {
        kind: "struct",
        fields: [
          { name: "owner", type: "pubkey" },
          { name: "mint", type: "pubkey" },
          { name: "vault", type: "pubkey" },
          { name: "amount", type: "u64" },
          { name: "unlock_time", type: "i64" },
          { name: "target_price_usd_e6", type: "u64" },
          { name: "lock_type", type: "u8" },
          { name: "lock_index", type: "u64" },
          { name: "bump", type: "u8" },
          { name: "vault_bump", type: "u8" },
        ],
      },
    },
  ],
} as const;
