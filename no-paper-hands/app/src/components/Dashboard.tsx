import { useState, useEffect, useCallback, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useTokens } from "../hooks/useTokens";
import { useProgram } from "../hooks/useProgram";
import { TokenList } from "./TokenList";
import { LockPanel } from "./LockPanel";
import { LocksTable } from "./LocksTable";
import type { TokenInfo, LockEntry, LockType } from "../types";

type Tab = "assets" | "lock" | "history";

function shortKey(pk: string) {
  return pk.slice(0, 4) + "…" + pk.slice(-4);
}

function fmtUsd(n: number) {
  if (n === 0) return "$0.00";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}

export function Dashboard() {
  const { publicKey, connected } = useWallet();
  const { tokens, loading: tokensLoading, error: tokensError, refresh: refreshTokens } = useTokens();
  const { fetchLocks, lockTokens, unlockTokens } = useProgram();

  const [locks, setLocks] = useState<LockEntry[]>([]);
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null);
  const [txLoading, setTxLoading] = useState(false);
  const [tab, setTab] = useState<Tab>("assets");
  const [toasts, setToasts] = useState<Array<{ id: number; type: "ok" | "err"; text: string }>>([]);

  const toast = (type: "ok" | "err", text: string) => {
    const id = Date.now();
    setToasts((t) => [...t, { id, type, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 5000);
  };

  const refreshLocks = useCallback(async () => {
    if (!publicKey) return;
    try { setLocks(await fetchLocks(publicKey)); } catch { /* no locks */ }
  }, [publicKey, fetchLocks]);

  useEffect(() => { refreshLocks(); }, [refreshLocks]);

  const tokenMap = useMemo(() => Object.fromEntries(tokens.map((t) => [t.mint, t])), [tokens]);
  const currentPrices = useMemo(() => Object.fromEntries(tokens.map((t) => [t.mint, t.priceUsd])), [tokens]);
  const nextLockIndex = useMemo(
    () => locks.length > 0 ? BigInt(Math.max(...locks.map((l) => Number(l.lockIndex)))) + 1n : 0n,
    [locks]
  );

  const totalValue   = tokens.reduce((s, t) => s + t.valueUsd, 0);
  const lockedValue  = locks.reduce((s, l) => {
    const t = tokenMap[l.mint];
    const p = currentPrices[l.mint] ?? 0;
    if (!t) return s;
    return s + (Number(l.amount) / 10 ** t.decimals) * p;
  }, 0);
  const availValue = totalValue - lockedValue;

  const handleLock = async (params: {
    token: TokenInfo; rawAmount: bigint; unlockTime: number;
    targetPriceUsdE6: bigint; lockType: LockType; lockIndex: bigint;
  }) => {
    setTxLoading(true);
    try {
      const sig = await lockTokens({ ...params, mint: params.token.mint });
      toast("ok", `Locked! ${String(sig).slice(0, 20)}…`);
      await Promise.all([refreshLocks(), refreshTokens()]);
      setTab("history");
    } catch (e: unknown) {
      toast("err", e instanceof Error ? e.message : String(e));
    } finally { setTxLoading(false); }
  };

  const handleUnlock = async (lock: LockEntry) => {
    setTxLoading(true);
    try {
      const sig = await unlockTokens(lock);
      toast("ok", `Withdrawn! ${String(sig).slice(0, 20)}…`);
      setLocks((prev) => prev.filter((l) => l.lockIndex !== lock.lockIndex));
      await refreshTokens();
    } catch (e: unknown) {
      toast("err", e instanceof Error ? e.message : String(e));
    } finally { setTxLoading(false); }
  };

  const handleSelectToken = (t: TokenInfo) => {
    setSelectedToken(t);
    setTab("lock");
  };

  return (
    <div className="ext-shell">
      <div className="ext-popup">

        {/* ── Top bar ── */}
        <div className="ext-topbar">
          <div className="ext-logo">
            <span className="ext-logo-icon">◆</span>
            <span className="ext-logo-text">Holdex</span>
          </div>
          <div className="ext-topbar-right">
            {connected && publicKey && (
              <span className="ext-addr">{shortKey(publicKey.toBase58())}</span>
            )}
            <span className="ext-net">● Mainnet</span>
          </div>
        </div>

        {!connected ? (

          /* ── Connect screen ── */
          <div className="ext-connect">
            <div className="ext-connect-icon">◆</div>
            <h2 className="ext-connect-title">Welcome to Holdex</h2>
            <p className="ext-connect-sub">
              Lock any Solana token until a date or price target. Diamond hands, on-chain.
            </p>
            <WalletMultiButton />
          </div>

        ) : (
          <>
            {/* ── Portfolio balance ── */}
            <div className="ext-balance">
              <div className="ext-balance-label">Portfolio Value</div>
              <div className="ext-balance-total">{fmtUsd(totalValue)}</div>
              <div className="ext-balance-stats">
                <div className="ext-stat">
                  <span className="ext-stat-label">Locked</span>
                  <span className="ext-stat-val purple">{fmtUsd(lockedValue)}</span>
                </div>
                <div className="ext-stat-divider" />
                <div className="ext-stat">
                  <span className="ext-stat-label">Available</span>
                  <span className="ext-stat-val green">{fmtUsd(availValue)}</span>
                </div>
                <div className="ext-stat-divider" />
                <div className="ext-stat">
                  <span className="ext-stat-label">Locks</span>
                  <span className="ext-stat-val">{locks.length}</span>
                </div>
              </div>
            </div>

            {/* ── Toasts ── */}
            {toasts.length > 0 && (
              <div className="ext-toasts">
                {toasts.map((t) => (
                  <div key={t.id} className={`ext-toast ${t.type}`}>
                    {t.type === "ok" ? "✓" : "✕"} {t.text}
                  </div>
                ))}
              </div>
            )}

            {/* ── Tab content ── */}
            <div className="ext-content">
              {tab === "assets" && (
                <TokenList
                  tokens={tokens}
                  loading={tokensLoading}
                  error={tokensError}
                  onRetry={refreshTokens}
                  selectedMint={selectedToken?.mint ?? null}
                  onSelect={handleSelectToken}
                />
              )}
              {tab === "lock" && (
                <LockPanel
                  token={selectedToken}
                  nextLockIndex={nextLockIndex}
                  loading={txLoading}
                  onLock={handleLock}
                />
              )}
              {tab === "history" && (
                <LocksTable
                  locks={locks}
                  tokenMap={tokenMap}
                  currentPrices={currentPrices}
                  onUnlock={handleUnlock}
                  loading={txLoading}
                />
              )}
            </div>

            {/* ── Bottom nav ── */}
            <nav className="ext-nav">
              <button className={`ext-nav-btn ${tab === "assets" ? "active" : ""}`} onClick={() => setTab("assets")}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/>
                </svg>
                <span>Assets</span>
              </button>
              <button className={`ext-nav-btn ${tab === "lock" ? "active" : ""}`} onClick={() => setTab("lock")}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
                <span>Lock</span>
              </button>
              <button className={`ext-nav-btn ${tab === "history" ? "active" : ""}`} onClick={() => setTab("history")}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8">
                  <path d="M3 3h18M3 9h18M3 15h18M3 21h18"/>
                </svg>
                <span>History</span>
              </button>
            </nav>
          </>
        )}
      </div>
    </div>
  );
}
