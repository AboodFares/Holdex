import { useEffect, useState } from "react";
import type { LockEntry, TokenInfo } from "../types";
import { LOCK_TIME, LOCK_PRICE, LOCK_EITHER } from "../types";

type Props = {
  locks: LockEntry[];
  tokenMap: Record<string, TokenInfo>;
  currentPrices: Record<string, number>;
  onUnlock: (lock: LockEntry) => Promise<void>;
  loading: boolean;
};

function useNow() {
  const [now, setNow] = useState(Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);
  return now;
}

function countdown(ms: number) {
  if (ms <= 0) return null;
  const s = Math.floor(ms / 1000);
  const d = Math.floor(s / 86400);
  const h = Math.floor((s % 86400) / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  if (d > 0) return `${d}d ${h}h ${m}m`;
  if (h > 0) return `${h}h ${m}m ${sec}s`;
  return `${m}m ${sec}s`;
}

function fmtDate(ts: number) {
  return new Date(ts * 1000).toLocaleString("en-US", {
    month: "short", day: "numeric", year: "numeric",
    hour: "2-digit", minute: "2-digit",
  });
}

function fmtPrice(p: number) {
  if (p === 0) return "—";
  if (p < 0.00001) return "$" + p.toExponential(2);
  if (p < 0.01) return "$" + p.toFixed(6);
  if (p < 1) return "$" + p.toFixed(4);
  return "$" + p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtAmt(amount: bigint, decimals: number, symbol: string) {
  const ui = Number(amount) / 10 ** decimals;
  if (ui >= 1_000_000) return (ui / 1_000_000).toFixed(2) + "M " + symbol;
  if (ui >= 1_000) return (ui / 1_000).toFixed(2) + "K " + symbol;
  return ui.toLocaleString("en-US", { maximumFractionDigits: 4 }) + " " + symbol;
}

function LockRow({ lock, tokenMap, currentPrices, onUnlock, loading }: {
  lock: LockEntry;
  tokenMap: Record<string, TokenInfo>;
  currentPrices: Record<string, number>;
  onUnlock: (l: LockEntry) => Promise<void>;
  loading: boolean;
}) {
  const now = useNow();
  const token = tokenMap[lock.mint];
  const curPrice = currentPrices[lock.mint] ?? token?.priceUsd ?? 0;
  const targetPriceUsd = Number(lock.targetPriceUsdE6) / 1_000_000;

  const timeOk = lock.unlockTime === 0 || now / 1000 >= lock.unlockTime;
  const priceOk = lock.targetPriceUsdE6 === 0n || curPrice >= targetPriceUsd;

  const unlocked =
    lock.lockType === LOCK_TIME ? timeOk :
    lock.lockType === LOCK_PRICE ? priceOk :
    timeOk || priceOk; // EITHER

  // Partial: one condition met but not both (only relevant for EITHER)
  const partial = lock.lockType === LOCK_EITHER && (timeOk || priceOk) && !(timeOk && priceOk);

  const symbol = token?.symbol ?? lock.mint.slice(0, 4) + "…";
  const decimals = token?.decimals ?? 9;
  const valueUsd = token ? (Number(lock.amount) / 10 ** decimals) * curPrice : 0;

  return (
    <tr>
      {/* Token */}
      <td>
        <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
          {token?.logo ? (
            <img src={token.logo} alt={symbol} style={{ width: 24, height: 24, borderRadius: "50%" }} />
          ) : (
            <div style={{ width: 24, height: 24, borderRadius: "50%", background: "var(--surface3)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 10, fontWeight: 700, color: "var(--text2)" }}>
              {symbol.slice(0, 2)}
            </div>
          )}
          <div>
            <div style={{ fontWeight: 600 }}>{symbol}</div>
            <div style={{ fontSize: 11, color: "var(--text3)" }}>{fmtPrice(curPrice)}</div>
          </div>
        </div>
      </td>

      {/* Amount */}
      <td>
        <div style={{ fontWeight: 600 }}>{fmtAmt(lock.amount, decimals, symbol)}</div>
        <div style={{ fontSize: 11, color: "var(--text3)" }}>
          {valueUsd > 0 ? "≈ $" + valueUsd.toFixed(valueUsd < 1 ? 4 : 2) : ""}
        </div>
      </td>

      {/* Type */}
      <td>
        <span className={`lock-type-badge ${lock.lockType === LOCK_TIME ? "time" : lock.lockType === LOCK_PRICE ? "price" : "either"}`}>
          {lock.lockType === LOCK_TIME && "⏱ Time"}
          {lock.lockType === LOCK_PRICE && "📈 Price"}
          {lock.lockType === LOCK_EITHER && "⚡ Either"}
        </span>
      </td>

      {/* Condition */}
      <td>
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {lock.unlockTime > 0 && (
            <div className="countdown-text">
              {timeOk
                ? <span style={{ color: "var(--green)" }}>✓ {fmtDate(lock.unlockTime)}</span>
                : `⏳ ${countdown((lock.unlockTime * 1000) - now)} · ${fmtDate(lock.unlockTime)}`
              }
            </div>
          )}
          {lock.targetPriceUsdE6 > 0n && (
            <div className="target-text" style={{ color: priceOk ? "var(--green)" : "var(--text2)" }}>
              {priceOk
                ? `✓ $${fmtPrice(targetPriceUsd).slice(1)} reached`
                : `📈 Target ${fmtPrice(targetPriceUsd)} · Now ${fmtPrice(curPrice)}`
              }
            </div>
          )}
        </div>
      </td>

      {/* Status */}
      <td>
        <span className={`status-pill ${unlocked ? "unlocked" : partial ? "partial" : "locked"}`}>
          {unlocked ? "✅ Ready" : partial ? "⚡ Partial" : "🔒 Locked"}
        </span>
      </td>

      {/* Action */}
      <td>
        <button
          className={`btn-unlock ${unlocked ? "active" : "inactive"}`}
          disabled={!unlocked || loading}
          onClick={() => onUnlock(lock)}
        >
          {unlocked ? "Withdraw" : "Locked"}
        </button>
      </td>
    </tr>
  );
}

export function LocksTable({ locks, tokenMap, currentPrices, onUnlock, loading }: Props) {
  if (locks.length === 0) {
    return <div className="ph-empty">No active locks</div>;
  }
  return (
    <div className="locks-section">
      <table>
        <thead>
          <tr>
            <th>Token</th>
            <th>Amount</th>
            <th>Type</th>
            <th>Condition</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {locks.map((lock) => (
            <LockRow
              key={lock.lockIndex.toString()}
              lock={lock}
              tokenMap={tokenMap}
              currentPrices={currentPrices}
              onUnlock={onUnlock}
              loading={loading}
            />
          ))}
        </tbody>
      </table>
    </div>
  );
}
