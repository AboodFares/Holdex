export const LOCK_TIME = 0;
export const LOCK_PRICE = 1;
export const LOCK_EITHER = 2;

export type LockType = typeof LOCK_TIME | typeof LOCK_PRICE | typeof LOCK_EITHER;

export interface TokenInfo {
  mint: string;
  symbol: string;
  name: string;
  logo: string;
  decimals: number;
  rawBalance: bigint;
  uiBalance: number;
  priceUsd: number;
  valueUsd: number;
  priceChange24h: number;
  tokenProgram: "spl" | "token2022";
}

export interface LockEntry {
  lockIndex: bigint;
  mint: string;
  vault: string;
  amount: bigint;
  unlockTime: number;       // unix seconds, 0 = no time lock
  targetPriceUsdE6: bigint; // USD * 1e6, 0 = no price lock
  lockType: LockType;
}
