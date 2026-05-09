import { useWallet, useConnection } from "@solana/wallet-adapter-react";
import { PublicKey, SystemProgram, Transaction } from "@solana/web3.js";
import {
  TOKEN_PROGRAM_ID,
  TOKEN_2022_PROGRAM_ID,
  getAssociatedTokenAddress,
  createAssociatedTokenAccountInstruction,
  createTransferCheckedInstruction,
  getAccount,
} from "@solana/spl-token";
import type { TokenInfo } from "../types";

const WSOL_MINT = "So11111111111111111111111111111111111111112";

export function useSend() {
  const { connection } = useConnection();
  const wallet = useWallet();

  const sendTokens = async ({
    token,
    uiAmount,
    recipient,
  }: {
    token: TokenInfo;
    uiAmount: number;
    recipient: string;
  }): Promise<string> => {
    if (!wallet.publicKey || !wallet.sendTransaction) {
      throw new Error("Wallet not connected");
    }

    let recipientPk: PublicKey;
    try {
      recipientPk = new PublicKey(recipient.trim());
    } catch {
      throw new Error("Invalid recipient address");
    }

    const rawAmount = BigInt(Math.floor(uiAmount * 10 ** token.decimals));
    if (rawAmount <= 0n) throw new Error("Amount must be greater than zero");
    if (rawAmount > token.rawBalance) throw new Error("Insufficient balance");

    const tx = new Transaction();

    if (token.mint === WSOL_MINT) {
      tx.add(
        SystemProgram.transfer({
          fromPubkey: wallet.publicKey,
          toPubkey:   recipientPk,
          lamports:   Number(rawAmount),
        })
      );
    } else {
      const tokenProgramId = token.tokenProgram === "token2022"
        ? TOKEN_2022_PROGRAM_ID
        : TOKEN_PROGRAM_ID;
      const mintPk = new PublicKey(token.mint);

      const senderAta    = await getAssociatedTokenAddress(mintPk, wallet.publicKey, false, tokenProgramId);
      const recipientAta = await getAssociatedTokenAddress(mintPk, recipientPk,      false, tokenProgramId);

      // Create recipient's ATA if it doesn't exist
      try {
        await getAccount(connection, recipientAta, "confirmed", tokenProgramId);
      } catch {
        tx.add(
          createAssociatedTokenAccountInstruction(
            wallet.publicKey,
            recipientAta,
            recipientPk,
            mintPk,
            tokenProgramId,
          )
        );
      }

      tx.add(
        createTransferCheckedInstruction(
          senderAta,
          mintPk,
          recipientAta,
          wallet.publicKey,
          rawAmount,
          token.decimals,
          [],
          tokenProgramId,
        )
      );
    }

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
    tx.recentBlockhash = blockhash;
    tx.feePayer = wallet.publicKey;

    const sig = await wallet.sendTransaction(tx, connection);
    await connection.confirmTransaction({ signature: sig, blockhash, lastValidBlockHeight }, "confirmed");
    return sig;
  };

  return { sendTokens };
}
