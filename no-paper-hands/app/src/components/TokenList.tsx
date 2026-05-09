import { useState } from "react";
import type { TokenInfo } from "../types";

type Props = {
  tokens: TokenInfo[];
  loading: boolean;
  error: string | null;
  onRetry: () => void;
  selectedMint: string | null;
  onSelect: (t: TokenInfo) => void;
};

function fmtPrice(p: number) {
  if (p === 0) return "—";
  if (p < 0.00001) return "$" + p.toExponential(2);
  if (p < 0.01) return "$" + p.toFixed(6);
  if (p < 1) return "$" + p.toFixed(4);
  return "$" + p.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function fmtBalance(n: number, sym: string) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M " + sym;
  if (n >= 1_000) return (n / 1_000).toFixed(2) + "K " + sym;
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 }) + " " + sym;
}

function fmtUsd(n: number) {
  if (n === 0) return "$0.00";
  if (n < 0.01) return "<$0.01";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

function shortMint(mint: string) {
  return mint.slice(0, 4) + "…" + mint.slice(-4);
}

export function TokenList({ tokens, loading, error, onRetry, selectedMint, onSelect }: Props) {
  const [copied, setCopied] = useState<string | null>(null);
  const copyTimer = { current: 0 };

  function copyMint(e: React.MouseEvent, mint: string) {
    e.stopPropagation();
    navigator.clipboard.writeText(mint).then(() => {
      clearTimeout(copyTimer.current);
      setCopied(mint);
      copyTimer.current = window.setTimeout(() => setCopied(null), 1500);
    });
  }

  return (
    <div className="card" style={{ minHeight: 300 }}>
      <div className="card-header">
        <span className="card-title">Your Tokens</span>
        <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
          <span style={{ fontSize: 12, color: "var(--text3)" }}>Click a token to lock it</span>
          <button className="refresh-btn" onClick={onRetry} title="Refresh" disabled={loading}>↻</button>
        </div>
      </div>
      <div className="card-body">
        {loading ? (
          <div className="loading-row"><div className="spinner" /></div>
        ) : error ? (
          <div className="empty-state">
            <div className="icon">⚠️</div>
            <p style={{ color: "var(--red)", marginBottom: 12, fontSize: 13 }}>{error}</p>
            <button className="btn-ghost" onClick={onRetry}>Retry</button>
          </div>
        ) : tokens.length === 0 ? (
          <div className="empty-state">
            <div className="icon">🪙</div>
            <p>No tokens found in this wallet.</p>
          </div>
        ) : (
          tokens.map((t) => (
            <div
              key={t.mint}
              className={`token-row ${selectedMint === t.mint ? "selected" : ""}`}
              onClick={() => onSelect(t)}
            >
              {t.logo ? (
                <img className="token-logo" src={t.logo} alt={t.symbol}
                  onError={(e) => {
                    const el = e.target as HTMLImageElement;
                    el.style.display = "none";
                    const ph = el.nextElementSibling as HTMLElement | null;
                    if (ph) ph.style.display = "flex";
                  }}
                />
              ) : null}
              <div
                className="token-logo-placeholder"
                style={{ display: t.logo ? "none" : "flex" }}
              >
                {t.symbol.slice(0, 2)}
              </div>

              <div className="token-name-col">
                <div className="token-symbol">{t.symbol}</div>
                <div style={{ display: "flex", alignItems: "center", gap: 4 }}>
                  <span className="token-name">{t.name}</span>
                  <button
                    title={copied === t.mint ? "Copied!" : "Copy contract address"}
                    onClick={(e) => copyMint(e, t.mint)}
                    style={{
                      background: "none", border: "none", cursor: "pointer",
                      padding: "0 2px", color: copied === t.mint ? "var(--green)" : "var(--text3)",
                      fontSize: 11, display: "flex", alignItems: "center", gap: 3,
                    }}
                  >
                    {copied === t.mint ? "✓" : shortMint(t.mint)}
                    <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                    </svg>
                  </button>
                </div>
              </div>

              <div>
                <div className="token-price">{fmtPrice(t.priceUsd)}</div>
                <div className="token-price-sub">per token</div>
              </div>

              <div className="token-balance">
                <div className="token-balance-usd">{fmtUsd(t.valueUsd)}</div>
                <div className="token-balance-amount">{fmtBalance(t.uiBalance, t.symbol)}</div>
              </div>

              <button
                className="lock-btn-small"
                onClick={(e) => { e.stopPropagation(); onSelect(t); }}
              >
                🔒 Lock
              </button>
            </div>
          ))
        )}
      </div>
    </div>
  );
}
