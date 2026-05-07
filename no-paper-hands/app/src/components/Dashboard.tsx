import { useState, useEffect, useCallback, useMemo } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { useTokens } from "../hooks/useTokens";
import { useProgram } from "../hooks/useProgram";
import { PortfolioHero } from "./PortfolioHero";
import { TokenList } from "./TokenList";
import { LockPanel } from "./LockPanel";
import { LocksTable } from "./LocksTable";
import type { TokenInfo, LockEntry, LockType } from "../types";

export function Dashboard() {
  const { publicKey, connected } = useWallet();
  const { tokens, loading: tokensLoading, error: tokensError, refresh: refreshTokens } = useTokens();
  const { fetchLocks, lockTokens, unlockTokens } = useProgram();

  const [locks, setLocks] = useState<LockEntry[]>([]);
  const [selectedToken, setSelectedToken] = useState<TokenInfo | null>(null);
  const [txLoading, setTxLoading] = useState(false);
  const [toasts, setToasts] = useState<Array<{ id: number; type: "ok" | "err"; text: string }>>([]);

  const toast = (type: "ok" | "err", text: string) => {
    const id = Date.now();
    setToasts((t) => [...t, { id, type, text }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 6000);
  };

  const refreshLocks = useCallback(async () => {
    if (!publicKey) return;
    try {
      setLocks(await fetchLocks(publicKey));
    } catch { /* no locks */ }
  }, [publicKey, fetchLocks]);

  useEffect(() => { refreshLocks(); }, [refreshLocks]);

  const tokenMap = useMemo(
    () => Object.fromEntries(tokens.map((t) => [t.mint, t])),
    [tokens]
  );

  // Live prices from tokens hook (refreshes ~every render cycle with useTokens)
  const currentPrices = useMemo(
    () => Object.fromEntries(tokens.map((t) => [t.mint, t.priceUsd])),
    [tokens]
  );

  const nextLockIndex = useMemo(
    () => locks.length > 0 ? BigInt(Math.max(...locks.map((l) => Number(l.lockIndex)))) + 1n : 0n,
    [locks]
  );

  const handleLock = async (params: {
    token: TokenInfo;
    rawAmount: bigint;
    unlockTime: number;
    targetPriceUsdE6: bigint;
    lockType: LockType;
    lockIndex: bigint;
  }) => {
    setTxLoading(true);
    try {
      const sig = await lockTokens({
        mint: params.token.mint,
        rawAmount: params.rawAmount,
        unlockTime: params.unlockTime,
        targetPriceUsdE6: params.targetPriceUsdE6,
        lockType: params.lockType,
        lockIndex: params.lockIndex,
      });
      toast("ok", `Locked! Tx: ${String(sig).slice(0, 24)}…`);
      await Promise.all([refreshLocks(), refreshTokens()]);
    } catch (e: unknown) {
      toast("err", e instanceof Error ? e.message : String(e));
    } finally {
      setTxLoading(false);
    }
  };

  const handleUnlock = async (lock: LockEntry) => {
    setTxLoading(true);
    try {
      const sig = await unlockTokens(lock);
      toast("ok", `Withdrawn! Tx: ${String(sig).slice(0, 24)}…`);
      setLocks((prev) => prev.filter((l) => l.lockIndex !== lock.lockIndex));
      await refreshTokens();
    } catch (e: unknown) {
      toast("err", e instanceof Error ? e.message : String(e));
    } finally {
      setTxLoading(false);
    }
  };

  return (
    <div className="page">
      {/* Header */}
      <header className="header">
        <div className="header-inner">
          <div className="logo">
            <span className="logo-gem">💎</span>
            <span className="logo-text">Holdex</span>
            <span className="logo-tag">Beta</span>
          </div>
          <div className="header-right">
            <span className="net-badge">● Mainnet</span>
            <WalletMultiButton />
          </div>
        </div>
      </header>

      <main className="main">
        {!connected ? (
          /* ── Hero ── */
          <div className="hero">
            <h1 className="hero-title">Diamond hands,<br />enforced on-chain.</h1>
            <p className="hero-sub">
              Lock any SPL token until a specific date, time, or price target.
              Your future self will thank you.
            </p>
            <div className="hero-features">
              <span className="hero-pill">⏱ Time Locks</span>
              <span className="hero-pill">📈 Price Targets</span>
              <span className="hero-pill">⚡ Either Condition</span>
              <span className="hero-pill">🔐 On-chain Custody</span>
            </div>
            <WalletMultiButton />
          </div>
        ) : (
          <>
            {/* Portfolio summary */}
            <PortfolioHero tokens={tokens} locks={locks} tokenMap={tokenMap} />

            {/* Toasts */}
            {toasts.length > 0 && (
              <div className="toast-wrap" style={{ marginBottom: 20 }}>
                {toasts.map((t) => (
                  <div key={t.id} className={`toast ${t.type}`}>
                    <span>{t.type === "ok" ? "✅" : "❌"}</span>
                    <span>{t.text}</span>
                  </div>
                ))}
              </div>
            )}

            {/* Main grid: token list + lock form */}
            <div className="grid-2">
              <TokenList
                tokens={tokens}
                loading={tokensLoading}
                error={tokensError}
                onRetry={refreshTokens}
                selectedMint={selectedToken?.mint ?? null}
                onSelect={setSelectedToken}
              />
              <LockPanel
                token={selectedToken}
                nextLockIndex={nextLockIndex}
                loading={txLoading}
                onLock={handleLock}
              />
            </div>

            {/* Locks table */}
            <LocksTable
              locks={locks}
              tokenMap={tokenMap}
              currentPrices={currentPrices}
              onUnlock={handleUnlock}
              loading={txLoading}
            />
          </>
        )}
      </main>
    </div>
  );
}
