import { useEffect, useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { Connection } from "@solana/web3.js";
import { TOKEN_PROGRAM_ID, TOKEN_2022_PROGRAM_ID } from "@solana/spl-token";
import type { TokenInfo } from "../types";

const RPC_ENDPOINT = import.meta.env.DEV
  ? `${window.location.origin}/rpc`
  : "https://mainnet.helius-rpc.com/?api-key=${import.meta.env.VITE_HELIUS_KEY}";

const DEXSCREENER_URL = "https://api.dexscreener.com/tokens/v1/solana";
const WSOL_MINT       = "So11111111111111111111111111111111111111112";

type DexPair = {
  baseToken: { address: string; name: string; symbol: string };
  priceUsd?: string;
  liquidity?: { usd?: number };
  info?: { imageUrl?: string };
};

type DexData = { price: number; name: string; symbol: string; image: string };

// DexScreener allows up to 30 addresses per call
async function getDexData(mints: string[]): Promise<Record<string, DexData>> {
  if (!mints.length) return {};
  const out: Record<string, DexData & { _liq: number }> = {};
  try {
    for (let i = 0; i < mints.length; i += 30) {
      const slice = mints.slice(i, i + 30).join(",");
      const pairs: DexPair[] = await fetch(`${DEXSCREENER_URL}/${slice}`).then((r) => r.json());
      for (const p of pairs ?? []) {
        const addr = p.baseToken?.address;
        if (!addr) continue;
        const price = parseFloat(p.priceUsd ?? "0") || 0;
        const liq   = p.liquidity?.usd ?? 0;
        // keep the highest-liquidity pair per token for best price
        if (!out[addr] || liq > out[addr]._liq) {
          out[addr] = {
            price,
            name:   p.baseToken.name,
            symbol: p.baseToken.symbol,
            image:  p.info?.imageUrl ?? "",
            _liq:   liq,
          };
        }
      }
    }
  } catch { /* silent */ }
  return out;
}

const conn = new Connection(RPC_ENDPOINT, "confirmed");

export function useTokens() {
  const { publicKey } = useWallet();
  const [tokens,  setTokens]  = useState<TokenInfo[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!publicKey) { setTokens([]); setError(null); return; }
    setLoading(true);
    setError(null);

    try {
      // 1. Native SOL balance
      const lamports = await conn.getBalance(publicKey);
      const solBal   = lamports / 1e9;

      // 2. SPL token accounts
      let splRaw: { mint: string; decimals: number; rawBalance: bigint; uiBalance: number }[] = [];
      try {
        const [res, res2022] = await Promise.all([
          conn.getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_PROGRAM_ID }),
          conn.getParsedTokenAccountsByOwner(publicKey, { programId: TOKEN_2022_PROGRAM_ID }),
        ]);
        splRaw = [...res.value, ...res2022.value]
          .map((a) => {
            const i = a.account.data.parsed.info;
            return {
              mint:       i.mint                        as string,
              decimals:   i.tokenAmount.decimals         as number,
              rawBalance: BigInt(i.tokenAmount.amount    as string),
              uiBalance:  (i.tokenAmount.uiAmount ?? 0) as number,
            };
          })
          .filter((t) => t.uiBalance > 0);
      } catch (e) {
        console.warn("[useTokens] SPL fetch failed:", e);
      }

      // 3. Fetch prices + metadata from DexScreener
      const allMints = [WSOL_MINT, ...splRaw.map((t) => t.mint)];
      const dex = await getDexData(allMints);

      const solDex   = dex[WSOL_MINT];
      const solPrice = solDex?.price ?? 0;
      const result: TokenInfo[] = [];

      if (solBal > 0) {
        result.push({
          mint:       WSOL_MINT,
          symbol:     "SOL",
          name:       "Solana",
          logo:       solDex?.image ?? "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
          decimals:   9,
          rawBalance: BigInt(lamports),
          uiBalance:  solBal,
          priceUsd:   solPrice,
          valueUsd:   solBal * solPrice,
        });
      }

      for (const t of splRaw) {
        const d = dex[t.mint];
        const p = d?.price ?? 0;
        result.push({
          mint:       t.mint,
          symbol:     d?.symbol  ?? t.mint.slice(0, 5) + "…",
          name:       d?.name    ?? "Unknown Token",
          logo:       d?.image   ?? "",
          decimals:   t.decimals,
          rawBalance: t.rawBalance,
          uiBalance:  t.uiBalance,
          priceUsd:   p,
          valueUsd:   t.uiBalance * p,
        });
      }

      const filtered = result.filter((t) => t.mint === WSOL_MINT || t.valueUsd >= 0.1);

      filtered.sort((a, b) => {
        if (a.mint === WSOL_MINT) return -1;
        if (b.mint === WSOL_MINT) return 1;
        return b.valueUsd - a.valueUsd;
      });

      setTokens(filtered);
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e);
      console.error("[useTokens]", msg);
      setError(msg);
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => { refresh(); }, [refresh]);

  return { tokens, loading, error, refresh };
}
