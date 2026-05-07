import { useMemo } from "react";
import { Program, AnchorProvider, BN, Idl } from "@coral-xyz/anchor";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection, PublicKey, SystemProgram, SYSVAR_RENT_PUBKEY } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, getAssociatedTokenAddress } from "@solana/spl-token";
import { IDL } from "../idl";
import type { LockEntry, LockType } from "../types";

const PROGRAM_ID   = new PublicKey("ErTKtbuVhqLH8fp4Kp38ek8cRBJvN79eDk4E6Qc3QtZw");
// Program lives on devnet; we use a dedicated connection regardless of display network
const devnetConn   = new Connection("https://api.devnet.solana.com", "confirmed");

export function useProgram() {
  const wallet = useWallet();

  const program = useMemo(() => {
    if (!wallet.publicKey) return null;
    const provider = new AnchorProvider(devnetConn, wallet as never, { commitment: "confirmed" });
    return new Program(IDL as unknown as Idl, provider);
  }, [wallet]);

  const indexBytes = (lockIndex: bigint) =>
    new BN(lockIndex.toString()).toArrayLike(Buffer, "le", 8);

  const lockPDA = (owner: PublicKey, lockIndex: bigint) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("lock", "utf8"), owner.toBuffer(), indexBytes(lockIndex)],
      PROGRAM_ID
    );

  const vaultPDA = (owner: PublicKey, lockIndex: bigint) =>
    PublicKey.findProgramAddressSync(
      [Buffer.from("vault", "utf8"), owner.toBuffer(), indexBytes(lockIndex)],
      PROGRAM_ID
    );

  const lockTokens = async (params: {
    mint: string;
    rawAmount: bigint;
    unlockTime: number;        // unix seconds, 0 = no time lock
    targetPriceUsdE6: bigint;  // 0 = no price lock
    lockType: LockType;
    lockIndex: bigint;
  }) => {
    if (!program || !wallet.publicKey) throw new Error("Wallet not connected");
    const { mint, rawAmount, unlockTime, targetPriceUsdE6, lockType, lockIndex } = params;
    const mintPk = new PublicKey(mint);
    const owner = wallet.publicKey;
    const [lPDA] = lockPDA(owner, lockIndex);
    const [vPDA] = vaultPDA(owner, lockIndex);
    const ata = await getAssociatedTokenAddress(mintPk, owner);

    return (program.methods as never as {
      lockTokens: (a: BN, b: BN, c: BN, d: BN, e: number) => { accounts: (x: object) => { rpc: () => Promise<string> } };
    })
      .lockTokens(
        new BN(lockIndex.toString()),
        new BN(rawAmount.toString()),
        new BN(unlockTime),
        new BN(targetPriceUsdE6.toString()),
        lockType
      )
      .accounts({
        owner,
        mint: mintPk,
        lock: lPDA,
        vault: vPDA,
        ownerTokenAccount: ata,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
        rent: SYSVAR_RENT_PUBKEY,
      })
      .rpc();
  };

  const unlockTokens = async (lock: LockEntry) => {
    if (!program || !wallet.publicKey) throw new Error("Wallet not connected");
    const mintPk = new PublicKey(lock.mint);
    const owner = wallet.publicKey;
    const [lPDA] = lockPDA(owner, lock.lockIndex);
    const [vPDA] = vaultPDA(owner, lock.lockIndex);
    const ata = await getAssociatedTokenAddress(mintPk, owner);

    return (program.methods as never as {
      unlockTokens: (a: BN) => { accounts: (x: object) => { rpc: () => Promise<string> } };
    })
      .unlockTokens(new BN(lock.lockIndex.toString()))
      .accounts({
        owner,
        lock: lPDA,
        vault: vPDA,
        ownerTokenAccount: ata,
        tokenProgram: TOKEN_PROGRAM_ID,
        systemProgram: SystemProgram.programId,
      })
      .rpc();
  };

  const fetchLocks = async (owner: PublicKey): Promise<LockEntry[]> => {
    if (!program) return [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const accounts = await (program.account as any).lockAccount.all([
      { memcmp: { offset: 8, bytes: owner.toBase58() } },
    ]);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return accounts.map((a: any) => ({
      lockIndex: BigInt(a.account.lockIndex.toString()),
      mint: a.account.mint.toBase58(),
      vault: a.account.vault.toBase58(),
      amount: BigInt(a.account.amount.toString()),
      unlockTime: a.account.unlockTime.toNumber(),
      targetPriceUsdE6: BigInt(a.account.targetPriceUsdE6.toString()),
      lockType: a.account.lockType as LockType,
    }));
  };

  return { program, lockTokens, unlockTokens, fetchLocks };
}
