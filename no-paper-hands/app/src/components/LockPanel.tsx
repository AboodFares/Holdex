import { useState, useEffect } from "react";
import type { TokenInfo, LockType } from "../types";
import { LOCK_TIME, LOCK_PRICE, LOCK_EITHER } from "../types";

type Props = {
  token: TokenInfo | null;
  nextLockIndex: bigint;
  loading: boolean;
  onLock: (params: {
    token: TokenInfo;
    rawAmount: bigint;
    unlockTime: number;
    targetPriceUsdE6: bigint;
    lockType: LockType;
    lockIndex: bigint;
  }) => Promise<void>;
};

function localNow() {
  const d = new Date(Date.now() + 86_400_000);
  return d.toISOString().slice(0, 16);
}

function fmtPrice(p: number) {
  if (p === 0) return "—";
  if (p < 0.00001) return "$" + p.toExponential(2);
  if (p < 0.01) return "$" + p.toFixed(6);
  if (p < 1) return "$" + p.toFixed(4);
  return "$" + p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function LockPanel({ token, nextLockIndex, loading, onLock }: Props) {
  const [amount, setAmount] = useState("");
  const [lockType, setLockType] = useState<LockType>(LOCK_TIME);
  const [unlockDatetime, setUnlockDatetime] = useState(localNow());
  const [targetPrice, setTargetPrice] = useState("");

  useEffect(() => { setAmount(""); }, [token]);

  const needsTime = lockType === LOCK_TIME || lockType === LOCK_EITHER;
  const needsPrice = lockType === LOCK_PRICE || lockType === LOCK_EITHER;

  const uiAmount = parseFloat(amount) || 0;
  const priceTarget = parseFloat(targetPrice) || 0;
  const usdValue = token ? uiAmount * token.priceUsd : 0;

  const canSubmit =
    token &&
    uiAmount > 0 &&
    uiAmount <= token.uiBalance &&
    (!needsTime || unlockDatetime) &&
    (!needsPrice || priceTarget > 0);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !canSubmit) return;
    const rawAmount = BigInt(Math.floor(uiAmount * 10 ** token.decimals));
    let unlockTime = 0;
    if (needsTime && unlockDatetime) {
      unlockTime = Math.floor(new Date(unlockDatetime).getTime() / 1000);
    }
    const targetPriceUsdE6 = needsPrice ? BigInt(Math.round(priceTarget * 1_000_000)) : 0n;
    await onLock({ token, rawAmount, unlockTime, targetPriceUsdE6, lockType, lockIndex: nextLockIndex });
    setAmount("");
    setTargetPrice("");
    setUnlockDatetime(localNow());
  };

  return (
    <form className="lp-form" onSubmit={handleSubmit}>

      {/* ── Selected token ── */}
      <div className="lp-field">
        <div className="lp-label">Selected Token</div>
        {token ? (
          <div className="lp-token-display">
            {token.logo
              ? <img className="lp-token-logo" src={token.logo} alt={token.symbol} />
              : <div className="lp-token-logo-ph">{token.symbol.slice(0, 2)}</div>
            }
            <div className="lp-token-info">
              <span className="lp-token-sym">{token.symbol}</span>
              <span className="lp-token-bal">
                Balance: {token.uiBalance.toLocaleString("en-US", { maximumFractionDigits: 6 })} · {fmtPrice(token.priceUsd)}
              </span>
            </div>
          </div>
        ) : (
          <div className="lp-token-display lp-token-empty">
            ← Select a token from the list
          </div>
        )}
      </div>

      {/* ── Amount ── */}
      <div className="lp-field">
        <div className="lp-label">Amount</div>
        <div className="lp-input-wrap">
          <input
            className="lp-input"
            type="number"
            placeholder="0.00"
            min="0"
            step="any"
            value={amount}
            onChange={e => setAmount(e.target.value)}
          />
          <button type="button" className="lp-max" onClick={() => token && setAmount(token.uiBalance.toString())}>
            MAX
          </button>
        </div>
        {uiAmount > 0 && token && (
          <span className="lp-hint">
            ≈ ${usdValue.toFixed(usdValue < 1 ? 4 : 2)} USD
            {uiAmount > token.uiBalance && " · ⚠️ exceeds balance"}
          </span>
        )}
      </div>

      {/* ── Lock condition ── */}
      <div className="lp-field">
        <div className="lp-label">Lock Condition</div>
        <div className="lp-seg">
          <button type="button" className={`lp-seg-btn ${lockType === LOCK_TIME ? "active" : ""}`} onClick={() => setLockType(LOCK_TIME)}>Time</button>
          <button type="button" className={`lp-seg-btn ${lockType === LOCK_PRICE ? "active" : ""}`} onClick={() => setLockType(LOCK_PRICE)}>Price</button>
          <button type="button" className={`lp-seg-btn ${lockType === LOCK_EITHER ? "active" : ""}`} onClick={() => setLockType(LOCK_EITHER)}>Either</button>
        </div>
        <span className="lp-hint">
          {lockType === LOCK_TIME && "Unlock when the date & time arrives"}
          {lockType === LOCK_PRICE && "Unlock when token reaches your price target"}
          {lockType === LOCK_EITHER && "Unlock when either condition is met first"}
        </span>
      </div>

      {/* ── Time condition ── */}
      {needsTime && (
        <div className="lp-field">
          <div className="lp-label">Unlock Date & Time</div>
          <input
            className="lp-input"
            type="datetime-local"
            value={unlockDatetime}
            min={localNow()}
            onChange={e => setUnlockDatetime(e.target.value)}
            required={needsTime}
          />
        </div>
      )}

      {/* ── Price condition ── */}
      {needsPrice && (
        <div className="lp-field">
          <div className="lp-label">Target Price (USD)</div>
          {token && (
            <div className="lp-price-current">
              <span>Current price</span>
              <span>{fmtPrice(token.priceUsd)}</span>
            </div>
          )}
          <div className="lp-input-wrap">
            <input
              className="lp-input"
              type="number"
              placeholder={token ? (token.priceUsd * 2).toFixed(token.priceUsd < 0.001 ? 6 : 4) : "0.00"}
              min="0"
              step="any"
              value={targetPrice}
              onChange={e => setTargetPrice(e.target.value)}
              required={needsPrice}
            />
            <span className="lp-suffix">USD</span>
          </div>
          {priceTarget > 0 && token && token.priceUsd > 0 && (
            <span className="lp-hint">
              {priceTarget > token.priceUsd
                ? `+${(((priceTarget / token.priceUsd) - 1) * 100).toFixed(1)}% above current`
                : `${(((priceTarget / token.priceUsd) - 1) * 100).toFixed(1)}% below current`}
            </span>
          )}
        </div>
      )}

      <button className="lp-submit" type="submit" disabled={!canSubmit || loading}>
        {loading ? "Confirming…" : "Lock Tokens"}
      </button>
    </form>
  );
}
