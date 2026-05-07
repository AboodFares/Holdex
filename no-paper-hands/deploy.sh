#!/usr/bin/env bash
set -e

export PATH="$HOME/.local/share/solana/install/active_release/bin:$HOME/.cargo/bin:$HOME/.avm/bin:$HOME/.local/bin:$PATH"

echo "==> Building program..."
cargo build-sbf --manifest-path programs/no-paper-hands/Cargo.toml

echo "==> Checking balance..."
solana balance --url devnet

echo "==> Deploying to devnet..."
solana program deploy \
  target/deploy/no_paper_hands.so \
  --url devnet \
  --keypair target/deploy/no_paper_hands-keypair.json

echo "==> Done! Program ID: $(solana-keygen pubkey target/deploy/no_paper_hands-keypair.json)"
