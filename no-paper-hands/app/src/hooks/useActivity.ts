import { useEffect, useState, useCallback } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { heliusTxUrl } from "../lib/rpc";

const DEXSCREENER_URL = "https://api.dexscreener.com/tokens/v1/solana";
const LOCK_PROGRAM_ID = "ErTKtbuVhqLH8fp4Kp38ek8cRBJvN79eDk4E6Qc3QtZw";
const WSOL_MINT       = "So11111111111111111111111111111111111111112";

export type ActivityItem = {
  signature: string;
  timestamp: number;
  type: "sent" | "received" | "locked" | "unlocked";
  symbol: string;
  amount: number;
  logo: string;
  counterparty: string;
};

type HeliusTx = {
  signature: string;
  timestamp: number;
  type: string;
  tokenTransfers?: { fromUserAccount: string; toUserAccount: string; tokenAmount: number; mint: string }[];
  nativeTransfers?: { fromUserAccount: string; toUserAccount: string; amount: number }[];
  instructions?: { programId: string }[];
};

async function getMeta(mints: string[]): Promise<Record<string, { symbol: string; logo: string }>> {
  const out: Record<string, { symbol: string; logo: string; _liq: number }> = {};
  out[WSOL_MINT] = {
    symbol: "SOL",
    logo: "https://raw.githubusercontent.com/solana-labs/token-list/main/assets/mainnet/So11111111111111111111111111111111111111112/logo.png",
    _liq: 1e12,
  };
  const toFetch = mints.filter(m => m !== WSOL_MINT);
  if (!toFetch.length) return out;
  try {
    for (let i = 0; i < toFetch.length; i += 30) {
      const slice = toFetch.slice(i, i + 30).join(",");
      const pairs = await fetch(`${DEXSCREENER_URL}/${slice}`).then(r => r.json());
      for (const p of pairs ?? []) {
        const addr = p.baseToken?.address;
        if (!addr) continue;
        const liq = p.liquidity?.usd ?? 0;
        if (!out[addr] || liq > out[addr]._liq) {
          out[addr] = { symbol: p.baseToken.symbol, logo: p.info?.imageUrl ?? "", _liq: liq };
        }
      }
    }
  } catch { /* silent */ }
  return out;
}

function short(addr: string) {
  return addr ? addr.slice(0, 4) + "…" + addr.slice(-4) : "";
}

export function useActivity() {
  const { publicKey } = useWallet();
  const [items,   setItems]   = useState<ActivityItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [error,   setError]   = useState<string | null>(null);

  const refresh = useCallback(async () => {
    if (!publicKey) { setItems([]); return; }
    setLoading(true);
    setError(null);
    const wallet = publicKey.toBase58();
    try {
      const res = await fetch(heliusTxUrl(wallet, 50));
      if (!res.ok) throw new Error(`Activity fetch failed: ${res.status}`);
      const txs: HeliusTx[] = await res.json();
      if (!Array.isArray(txs)) { setItems([]); return; }

      // Collect mints for metadata lookup
      const mints = new Set<string>([WSOL_MINT]);
      for (const tx of txs)
        for (const t of tx.tokenTransfers ?? []) mints.add(t.mint);

      const meta = await getMeta([...mints]);
      const result: ActivityItem[] = [];

      for (const tx of txs) {
        const isLockTx = tx.instructions?.some(i => i.programId === LOCK_PROGRAM_ID) ?? false;
        let hasTokenActivity = false;

        // ── Token transfers ──
        for (const t of tx.tokenTransfers ?? []) {
          if (!t.tokenAmount) continue;
          const isTo   = t.toUserAccount   === wallet;
          const isFrom = t.fromUserAccount === wallet;
          if (!isTo && !isFrom) continue;

          let type: ActivityItem["type"];
          if (isFrom && isLockTx) type = "locked";
          else if (isTo && isLockTx) type = "unlocked";
          else type = isTo ? "received" : "sent";

          const m = meta[t.mint];
          result.push({
            signature:   tx.signature,
            timestamp:   tx.timestamp,
            type,
            symbol:      m?.symbol ?? short(t.mint),
            amount:      t.tokenAmount,
            logo:        m?.logo ?? "",
            counterparty: isTo ? short(t.fromUserAccount) : short(t.toUserAccount),
          });
          hasTokenActivity = true;
        }

        // ── Native SOL transfers (only if no token activity) ──
        if (!hasTokenActivity) {
          let net = 0;
          let cp  = "";
          for (const n of tx.nativeTransfers ?? []) {
            if (n.fromUserAccount === wallet) { net -= n.amount; cp = short(n.toUserAccount); }
            else if (n.toUserAccount === wallet) { net += n.amount; cp = short(n.fromUserAccount); }
          }
          const lamports = Math.abs(net);
          if (lamports >= 1000) {
            result.push({
              signature:   tx.signature,
              timestamp:   tx.timestamp,
              type:        net > 0 ? "received" : "sent",
              symbol:      "SOL",
              amount:      lamports / 1e9,
              logo:        meta[WSOL_MINT].logo,
              counterparty: cp,
            });
          }
        }
      }

      setItems(result);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, [publicKey]);

  useEffect(() => { refresh(); }, [refresh]);

  return { items, loading, error, refresh };
}
