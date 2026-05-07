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
  // Returns "YYYY-MM-DDTHH:MM" for tomorrow at this time
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

  // Reset amount when token changes
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

  const handleMax = () => {
    if (token) setAmount(token.uiBalance.toString());
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !canSubmit) return;

    const rawAmount = BigInt(Math.floor(uiAmount * 10 ** token.decimals));

    let unlockTime = 0;
    if (needsTime && unlockDatetime) {
      unlockTime = Math.floor(new Date(unlockDatetime).getTime() / 1000);
    }

    const targetPriceUsdE6 = needsPrice
      ? BigInt(Math.round(priceTarget * 1_000_000))
      : 0n;

    await onLock({
      token,
      rawAmount,
      unlockTime,
      targetPriceUsdE6,
      lockType,
      lockIndex: nextLockIndex,
    });

    setAmount("");
    setTargetPrice("");
    setUnlockDatetime(localNow());
  };

  return (
    <div className="card">
      <div className="card-header">
        <span className="card-title">🔒 Lock Tokens</span>
      </div>

      <form className="lock-form" onSubmit={handleSubmit}>
        {/* Token display */}
        <div className="field">
          <div className="label">Selected Token</div>
          {token ? (
            <div className="selected-token-display">
              {token.logo ? (
                <img className="logo" src={token.logo} alt={token.symbol} />
              ) : (
                <div className="logo-placeholder">{token.symbol.slice(0, 2)}</div>
              )}
              <div className="info">
                <div className="sym">{token.symbol}</div>
                <div className="bal">Balance: {token.uiBalance.toLocaleString("en-US", { maximumFractionDigits: 6 })} · {fmtPrice(token.priceUsd)}</div>
              </div>
            </div>
          ) : (
            <div className="selected-token-display">
              <span className="no-token">← Select a token from the list</span>
            </div>
          )}
        </div>

        {/* Amount */}
        <div className="field">
          <div className="label">Amount</div>
          <div className="input-wrap">
            <input
              className="input"
              type="number"
              placeholder="0.00"
              min="0"
              step="any"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              style={{ paddingRight: 52 }}
            />
            <button type="button" className="input-max" onClick={handleMax}>MAX</button>
          </div>
          {uiAmount > 0 && token && (
            <span className="hint">
              ≈ ${usdValue.toFixed(usdValue < 1 ? 4 : 2)} USD
              {uiAmount > token.uiBalance && " · ⚠️ exceeds balance"}
            </span>
          )}
        </div>

        {/* Lock type */}
        <div className="field">
          <div className="label">Lock Condition</div>
          <div className="seg">
            <button type="button" className={`seg-btn ${lockType === LOCK_TIME ? "active" : ""}`} onClick={() => setLockType(LOCK_TIME)}>⏱ Time</button>
            <button type="button" className={`seg-btn ${lockType === LOCK_PRICE ? "active" : ""}`} onClick={() => setLockType(LOCK_PRICE)}>📈 Price</button>
            <button type="button" className={`seg-btn ${lockType === LOCK_EITHER ? "active" : ""}`} onClick={() => setLockType(LOCK_EITHER)}>⚡ Either</button>
          </div>
          <span className="hint">
            {lockType === LOCK_TIME && "Unlock when the date & time arrives (on-chain enforced)"}
            {lockType === LOCK_PRICE && "Unlock when token reaches your price target"}
            {lockType === LOCK_EITHER && "Unlock when EITHER condition is met first"}
          </span>
        </div>

        {/* Time condition */}
        {needsTime && (
          <div className="field">
            <div className="label">Unlock Date & Time</div>
            <input
              className="input"
              type="datetime-local"
              value={unlockDatetime}
              min={localNow()}
              onChange={(e) => setUnlockDatetime(e.target.value)}
              required={needsTime}
            />
          </div>
        )}

        {/* Price condition */}
        {needsPrice && (
          <div className="field">
            <div className="label">Target Price (USD)</div>
            {token && (
              <div className="price-display" style={{ marginBottom: 6 }}>
                <span className="cur-label">Current price</span>
                <span className="cur-val">{fmtPrice(token.priceUsd)}</span>
              </div>
            )}
            <div className="input-wrap">
              <input
                className="input"
                type="number"
                placeholder={token ? (token.priceUsd * 2).toFixed(token.priceUsd < 0.001 ? 6 : 4) : "0.00"}
                min="0"
                step="any"
                value={targetPrice}
                onChange={(e) => setTargetPrice(e.target.value)}
                style={{ paddingRight: 44 }}
                required={needsPrice}
              />
              <span className="input-suffix">USD</span>
            </div>
            {priceTarget > 0 && token && token.priceUsd > 0 && (
              <span className="hint">
                {priceTarget > token.priceUsd
                  ? `+${(((priceTarget / token.priceUsd) - 1) * 100).toFixed(1)}% above current`
                  : `${(((priceTarget / token.priceUsd) - 1) * 100).toFixed(1)}% below current`}
              </span>
            )}
            <span className="hint" style={{ marginTop: 2 }}>
              ⚠ Price condition verified client-side. Time lock is enforced on-chain.
            </span>
          </div>
        )}

        <button
          className="btn-primary"
          type="submit"
          disabled={!canSubmit || loading}
        >
          {loading ? "Confirming…" : "🔒 Lock Tokens"}
        </button>
      </form>
    </div>
  );
}
