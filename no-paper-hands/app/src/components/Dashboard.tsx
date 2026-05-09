import { useState, useEffect, useCallback, useMemo, Component } from "react";
import type { ReactNode } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { WalletMultiButton } from "@solana/wallet-adapter-react-ui";
import { QRCode } from "react-qr-code";
import { useTokens } from "../hooks/useTokens";
import { useProgram } from "../hooks/useProgram";
import { useSend } from "../hooks/useSend";
import { useActivity } from "../hooks/useActivity";
import type { ActivityItem } from "../hooks/useActivity";
import { LockPanel } from "./LockPanel";
import { LocksTable } from "./LocksTable";
import type { TokenInfo, LockEntry, LockType } from "../types";

type View = "main" | "lock" | "receive" | "send-select" | "send-amount" | "activity";
type MainTab = "tokens" | "locked";

function shortKey(pk: string) { return pk.slice(0, 4) + "…" + pk.slice(-4); }
function fmtUsd(n: number) {
  if (n === 0) return "$0.00";
  return "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
}
function fmtBal(n: number) {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(2) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(2) + "K";
  return n.toLocaleString("en-US", { maximumFractionDigits: 4 });
}
function fmtActivityAmount(amount: number) {
  if (!isFinite(amount) || isNaN(amount)) return "0";
  if (amount >= 1_000_000) return (amount / 1_000_000).toLocaleString("en-US", { maximumFractionDigits: 2 }) + "M";
  if (amount >= 1_000) return amount.toLocaleString("en-US", { maximumFractionDigits: 2 });
  if (amount < 0.000001) return amount.toExponential(2);
  if (amount < 0.0001) return amount.toFixed(8);
  if (amount < 0.01) return amount.toFixed(6);
  return amount.toLocaleString("en-US", { maximumFractionDigits: 5 });
}
function groupActivity(items: ActivityItem[]): { label: string; items: ActivityItem[] }[] {
  const todayMs = new Date().setHours(0, 0, 0, 0);
  const map = new Map<string, ActivityItem[]>();
  for (const item of items) {
    const d = new Date(item.timestamp * 1000);
    const dMs = new Date(d).setHours(0, 0, 0, 0);
    const diff = Math.round((todayMs - dMs) / 86_400_000);
    const label = diff === 0 ? "Today" : diff === 1 ? "Yesterday"
      : d.toLocaleDateString("en-US", { month: "long", day: "numeric", year: "numeric" });
    if (!map.has(label)) map.set(label, []);
    map.get(label)!.push(item);
  }
  return [...map.entries()].map(([label, items]) => ({ label, items }));
}

class ErrorBoundary extends Component<{ children: ReactNode }, { error: string | null }> {
  state = { error: null };
  static getDerivedStateFromError(e: Error) { return { error: e.message }; }
  render() {
    if (this.state.error) return (
      <div style={{ padding: 20, color: "#f87171", fontSize: 13, wordBreak: "break-all", background: "#111114", minHeight: "100vh" }}>
        <strong>Error:</strong> {this.state.error}
      </div>
    );
    return this.props.children;
  }
}

function DashboardInner() {
  const { publicKey, connected, disconnect } = useWallet();
  const { tokens, loading: tokensLoading, refresh: refreshTokens } = useTokens();
  const { fetchLocks, lockTokens, unlockTokens } = useProgram();
  const { sendTokens } = useSend();
  const { items: activityItems, loading: activityLoading, refresh: refreshActivity } = useActivity();

  const [locks, setLocks] = useState<LockEntry[]>([]);
  const [lockToken, setLockToken] = useState<TokenInfo | null>(null);
  const [txLoading, setTxLoading] = useState(false);
  const [lockError, setLockError] = useState<string | null>(null);
  const [view, setView] = useState<View>("main");
  const [mainTab, setMainTab] = useState<MainTab>("tokens");
  const [toasts, setToasts] = useState<Array<{ id: number; type: "ok" | "err"; text: string }>>([]);

  // Send flow state
  const [sendToken, setSendToken] = useState<TokenInfo | null>(null);
  const [sendSearch, setSendSearch] = useState("");
  const [sendAmount, setSendAmount] = useState("");
  const [sendAddress, setSendAddress] = useState("");
  const [lockSearch, setLockSearch] = useState("");
  const [copied, setCopied] = useState(false);
  const [showAccountMenu, setShowAccountMenu] = useState(false);

  const toast = (type: "ok" | "err", text: string) => {
    const id = Date.now();
    setToasts(t => [...t, { id, type, text }]);
    setTimeout(() => setToasts(t => t.filter(x => x.id !== id)), 4000);
  };

  const refreshLocks = useCallback(async () => {
    if (!publicKey) return;
    try { setLocks(await fetchLocks(publicKey)); } catch { }
  }, [publicKey, fetchLocks]);

  useEffect(() => { refreshLocks(); }, [refreshLocks]);

  const tokenMap = useMemo(() => Object.fromEntries(tokens.map(t => [t.mint, t])), [tokens]);
  const currentPrices = useMemo(() => Object.fromEntries(tokens.map(t => [t.mint, t.priceUsd])), [tokens]);
  const nextLockIndex = useMemo(
    () => locks.length > 0 ? BigInt(Math.max(...locks.map(l => Number(l.lockIndex)))) + 1n : 0n,
    [locks]
  );

  const totalValue = tokens.reduce((s, t) => s + t.valueUsd, 0);

  const filteredSendTokens = tokens.filter(t =>
    t.name.toLowerCase().includes(sendSearch.toLowerCase()) ||
    t.symbol.toLowerCase().includes(sendSearch.toLowerCase())
  );

  const handleLock = async (params: {
    token: TokenInfo; rawAmount: bigint; unlockTime: number;
    targetPriceUsdE6: bigint; lockType: LockType; lockIndex: bigint;
  }) => {
    setTxLoading(true);
    setLockError(null);
    try {
      const sig = await lockTokens({ ...params, mint: params.token.mint });
      toast("ok", `Locked! ${String(sig).slice(0, 20)}…`);
      await Promise.all([refreshLocks(), refreshTokens()]);
      setView("main");
      setMainTab("locked");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : String(e);
      setLockError(msg);
      toast("err", msg.length > 80 ? msg.slice(0, 80) + "…" : msg);
    } finally { setTxLoading(false); }
  };

  const handleUnlock = async (lock: LockEntry) => {
    setTxLoading(true);
    try {
      await unlockTokens(lock);
      toast("ok", "Withdrawn!");
      setLocks(prev => prev.filter(l => l.lockIndex !== lock.lockIndex));
      await refreshTokens();
    } catch (e: unknown) {
      toast("err", e instanceof Error ? e.message : String(e));
    } finally { setTxLoading(false); }
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const goBack = () => {
    setView("main");
    setSendSearch("");
    setSendAmount("");
    setSendAddress("");
    setSendToken(null);
  };

  return (
    <div className="ph-root">
      <div className="ph-popup" onClick={() => showAccountMenu && setShowAccountMenu(false)}>

        {/* ── Header (always visible) ── */}
        <div className="ph-header">
          <button
            className="ph-header-account-btn"
            onClick={e => { e.stopPropagation(); setShowAccountMenu(m => !m); }}
          >
            <div className="ph-avatar">
              {publicKey ? publicKey.toBase58().slice(0, 2).toUpperCase() : "H"}
            </div>
            <div className="ph-account">
              <span className="ph-account-name">Holdex</span>
              {publicKey && (
                <span className="ph-account-addr">
                  {shortKey(publicKey.toBase58())}
                  <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M6 9l6 6 6-6"/>
                  </svg>
                </span>
              )}
            </div>
          </button>
        </div>

        {/* ── Account menu dropdown ── */}
        {showAccountMenu && publicKey && (
          <div className="ph-account-menu">
            <div className="ph-account-menu-addr">
              {publicKey.toBase58().slice(0, 12)}…{publicKey.toBase58().slice(-8)}
            </div>
            <div className="ph-account-menu-actions">
              <button className="ph-account-menu-btn" onClick={() => {
                handleCopy(publicKey.toBase58());
                setShowAccountMenu(false);
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                </svg>
                {copied ? "Copied!" : "Copy Address"}
              </button>
              <button className="ph-account-menu-btn ph-account-menu-disconnect" onClick={() => {
                disconnect();
                setShowAccountMenu(false);
                setView("main");
                setMainTab("tokens");
              }}>
                <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>
                </svg>
                Disconnect
              </button>
            </div>
          </div>
        )}

        {/* ── Toasts (always visible) ── */}
        <div className="ph-toast-layer">
          {toasts.map(t => (
            <div key={t.id} className={`ph-toast ${t.type}`}>{t.text}</div>
          ))}
        </div>

        {/* ── Not connected ── */}
        {!connected ? (
          <div className="ph-connect">
            <div className="ph-connect-logo">◆</div>
            <h2>Welcome to Holdex</h2>
            <p>Lock your Solana tokens until a date or price target.</p>
            <WalletMultiButton />
          </div>

        /* ── Receive view ── */
        ) : view === "receive" ? (
          <>
            <div className="ph-flow-header">
              <button className="ph-flow-back" onClick={goBack}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
              </button>
              <span className="ph-flow-title">Receive Address</span>
              <div style={{ width: 32 }} />
            </div>
            <div className="ph-content">
              {publicKey ? (
                <div className="ph-receive">
                  <div className="ph-qr-wrap">
                    <QRCode
                      value={publicKey.toBase58()}
                      size={180}
                      bgColor="#ffffff"
                      fgColor="#000000"
                    />
                  </div>
                  <p className="ph-receive-label">Your Solana Address</p>
                  <div className="ph-receive-card">
                    <div className="ph-receive-addr">{publicKey.toBase58()}</div>
                    <button className="ph-receive-copy" onClick={() => handleCopy(publicKey.toBase58())}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
                      </svg>
                      {copied ? "Copied!" : "Copy"}
                    </button>
                  </div>
                  <p className="ph-receive-note">Use to receive tokens on the Solana network only.</p>
                  <button className="ph-receive-close" onClick={goBack}>Close</button>
                </div>
              ) : (
                <div className="ph-empty">Wallet not connected</div>
              )}
            </div>
          </>

        /* ── Send — token select ── */
        ) : view === "send-select" ? (
          <>
            <div className="ph-flow-header">
              <button className="ph-flow-back" onClick={goBack}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
              </button>
              <span className="ph-flow-title">Send</span>
              <div style={{ width: 32 }} />
            </div>
            <div className="ph-send-search-wrap">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#52535c" strokeWidth="2">
                <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
              </svg>
              <input
                className="ph-send-search"
                placeholder="Search..."
                value={sendSearch}
                onChange={e => setSendSearch(e.target.value)}
                autoFocus
              />
            </div>
            <div className="ph-content">
              <div className="ph-token-list">
                {filteredSendTokens.map(t => (
                  <div key={t.mint} className="ph-token-card" onClick={() => {
                    setSendToken(t);
                    setSendAmount("");
                    setView("send-amount");
                  }}>
                    <div className="ph-token-logo-wrap">
                      {t.logo
                        ? <img src={t.logo} alt={t.symbol} className="ph-token-logo" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                        : <div className="ph-token-logo-ph">{t.symbol.slice(0, 2)}</div>
                      }
                    </div>
                    <div className="ph-token-info">
                      <span className="ph-token-name">{t.name.length > 20 ? t.name.slice(0, 20) + "…" : t.name}</span>
                      <span className="ph-token-bal">{fmtBal(t.uiBalance)} {t.symbol}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="ph-flow-footer">
              <button className="ph-flow-close" onClick={goBack}>Close</button>
            </div>
          </>

        /* ── Send — amount + address ── */
        ) : view === "send-amount" ? (
          <>
            <div className="ph-flow-header">
              <button className="ph-flow-back" onClick={() => setView("send-select")}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
              </button>
              <span className="ph-flow-title">{sendToken?.symbol ?? "Send"}</span>
              <div style={{ width: 32 }} />
            </div>
            <div className="ph-content">
              <div className="ph-send-form">
                {sendToken && (
                  <div className="ph-send-token-badge">
                    {sendToken.logo
                      ? <img src={sendToken.logo} alt={sendToken.symbol} className="ph-send-token-logo" />
                      : <div className="ph-token-logo-ph" style={{ width: 36, height: 36, fontSize: 12 }}>{sendToken.symbol.slice(0, 2)}</div>
                    }
                    <div>
                      <div className="ph-send-token-name">{sendToken.name}</div>
                      <div className="ph-send-token-bal">Balance: {fmtBal(sendToken.uiBalance)} {sendToken.symbol}</div>
                    </div>
                  </div>
                )}

                <div className="lp-field">
                  <div className="lp-label">Amount</div>
                  <div className="lp-input-wrap">
                    <input
                      className="lp-input"
                      type="number"
                      placeholder="0.00"
                      min="0"
                      step="any"
                      value={sendAmount}
                      onChange={e => setSendAmount(e.target.value)}
                    />
                    <button type="button" className="lp-max" onClick={() => sendToken && setSendAmount(sendToken.uiBalance.toString())}>
                      MAX
                    </button>
                  </div>
                  {parseFloat(sendAmount) > 0 && sendToken && sendToken.priceUsd > 0 && (
                    <span className="lp-hint">≈ {fmtUsd(parseFloat(sendAmount) * sendToken.priceUsd)}</span>
                  )}
                </div>

                <div className="lp-field">
                  <div className="lp-label">Recipient Address</div>
                  <input
                    className="lp-input"
                    type="text"
                    placeholder="Solana wallet address"
                    value={sendAddress}
                    onChange={e => setSendAddress(e.target.value)}
                  />
                </div>

                <button
                  className="lp-submit"
                  disabled={!sendAmount || !sendAddress || txLoading}
                  onClick={async () => {
                    if (!sendToken || !sendAmount || !sendAddress) return;
                    const amt = parseFloat(sendAmount);
                    if (isNaN(amt) || amt <= 0) { toast("err", "Enter a valid amount"); return; }
                    setTxLoading(true);
                    try {
                      const sig = await sendTokens({ token: sendToken, uiAmount: amt, recipient: sendAddress });
                      toast("ok", `Sent! ${sig.slice(0, 16)}…`);
                      setSendAmount("");
                      setSendAddress("");
                      setSendToken(null);
                      await refreshTokens();
                      setView("main");
                    } catch (e: unknown) {
                      toast("err", e instanceof Error ? e.message : String(e));
                    } finally {
                      setTxLoading(false);
                    }
                  }}
                >
                  {txLoading ? "Sending…" : `Send ${sendToken?.symbol ?? ""}`}
                </button>
              </div>
            </div>
          </>

        /* ── Lock view ── */
        ) : view === "lock" ? (
          <>
            <div className="ph-flow-header">
              <button className="ph-flow-back" onClick={lockToken ? () => { setLockToken(null); setLockSearch(""); setLockError(null); } : goBack}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M19 12H5M12 5l-7 7 7 7"/></svg>
              </button>
              <span className="ph-flow-title">{lockToken ? `Lock ${lockToken.symbol}` : "Select Token"}</span>
              <div style={{ width: 32 }} />
            </div>

            {!lockToken ? (
              <>
                <div className="ph-send-search-wrap">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#52535c" strokeWidth="2">
                    <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
                  </svg>
                  <input
                    className="ph-send-search"
                    placeholder="Search tokens..."
                    value={lockSearch}
                    onChange={e => setLockSearch(e.target.value)}
                    autoFocus
                  />
                </div>
                <div className="ph-content">
                  <div className="ph-token-list">
                    {tokens
                      .filter(t => t.name.toLowerCase().includes(lockSearch.toLowerCase()) || t.symbol.toLowerCase().includes(lockSearch.toLowerCase()))
                      .map(t => (
                        <div key={t.mint} className="ph-token-card" onClick={() => { setLockToken(t); setLockSearch(""); setLockError(null); }}>
                          <div className="ph-token-logo-wrap">
                            {t.logo
                              ? <img src={t.logo} alt={t.symbol} className="ph-token-logo" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                              : <div className="ph-token-logo-ph">{t.symbol.slice(0, 2)}</div>
                            }
                          </div>
                          <div className="ph-token-info">
                            <span className="ph-token-name">{t.name.length > 20 ? t.name.slice(0, 20) + "…" : t.name}</span>
                            <span className="ph-token-bal">{fmtBal(t.uiBalance)} {t.symbol}</span>
                          </div>
                          <div className="ph-token-value">
                            <span className="ph-token-usd">{fmtUsd(t.valueUsd)}</span>
                          </div>
                        </div>
                      ))
                    }
                  </div>
                </div>
              </>
            ) : (
              <div className="ph-content">
                {lockError && (
                  <div style={{
                    margin: "0 0 12px", padding: "10px 14px",
                    background: "rgba(212,46,94,.12)", border: "1px solid rgba(212,46,94,.3)",
                    borderRadius: 10, fontSize: 12, color: "#f87171", lineHeight: 1.4,
                    wordBreak: "break-word",
                  }}>
                    <strong>Transaction failed:</strong> {lockError}
                  </div>
                )}
                <LockPanel
                  token={lockToken}
                  nextLockIndex={nextLockIndex}
                  loading={txLoading}
                  onLock={handleLock}
                />
              </div>
            )}
          </>

        ) : view === "activity" ? (
          <>
            <div className="ph-act-header">
              <span className="ph-act-title">Recent Activity</span>
            </div>
            <div className="ph-content">
              {activityLoading ? (
                <div className="ph-loading"><div className="spinner" /></div>
              ) : activityItems.length === 0 ? (
                <div className="ph-empty">No recent activity</div>
              ) : (
                <div className="ph-act-list">
                  {groupActivity(activityItems).map(group => (
                    <div key={group.label}>
                      <div className="ph-act-date">{group.label}</div>
                      {group.items.map((item, i) => {
                        const isPos = item.type === "received" || item.type === "unlocked";
                        const prefix = isPos ? "+" : "-";
                        return (
                          <div key={item.signature + i} className="ph-act-row">
                            <div className="ph-act-logo-wrap">
                              {item.logo
                                ? <img src={item.logo} alt={item.symbol} className="ph-act-logo" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                                : <div className="ph-act-logo-ph">{item.symbol.slice(0, 2)}</div>
                              }
                              <div className={`ph-act-arrow ${isPos ? "in" : "out"}`}>
                                {isPos ? (
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M20 12l-8 8-8-8 6 0 0-8 4 0 0 8z"/></svg>
                                ) : (
                                  <svg width="10" height="10" viewBox="0 0 24 24" fill="currentColor"><path d="M4 12l8-8 8 8-6 0 0 8-4 0 0-8z"/></svg>
                                )}
                              </div>
                            </div>
                            <div className="ph-act-info">
                              <span className="ph-act-type">
                                {item.type === "locked" ? "Locked" : item.type === "unlocked" ? "Unlocked" : item.type === "received" ? "Received" : "Sent"}
                              </span>
                              <span className="ph-act-cp">
                                {item.type === "received" || item.type === "unlocked" ? "From " : "To "}{item.counterparty}
                              </span>
                            </div>
                            <span className={`ph-act-amount ${isPos ? "pos" : ""}`}>
                              {prefix}{fmtActivityAmount(item.amount)} {item.symbol}
                            </span>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>
              )}
            </div>
            <nav className="ph-nav">
              <button className="ph-nav-btn" onClick={() => { setView("main"); setMainTab("tokens"); }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                  <polyline points="9 22 9 12 15 12 15 22"/>
                </svg>
              </button>
              <button className="ph-nav-btn" onClick={() => { setLockToken(null); setView("lock"); }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </button>
              <button className="ph-nav-btn active">
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              </button>
            </nav>
          </>

        ) : (
          <>
            {/* Balance */}
            <div className="ph-balance">
              <div className="ph-balance-total">{fmtUsd(totalValue)}</div>
              <div className="ph-balance-sub">
                <span className="ph-green">{locks.length} active lock{locks.length !== 1 ? "s" : ""}</span>
              </div>
            </div>

            {/* Action buttons — 4 columns */}
            <div className="ph-actions">
              <button className="ph-action-btn" onClick={() => { setSendSearch(""); setView("send-select"); }}>
                <div className="ph-action-icon">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#9945FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <line x1="22" y1="2" x2="11" y2="13"/>
                    <polygon points="22 2 15 22 11 13 2 9 22 2"/>
                  </svg>
                </div>
                <span>Send</span>
              </button>
              <button className="ph-action-btn" onClick={() => toast("ok", "Swap coming soon")}>
                <div className="ph-action-icon">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#9945FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <polyline points="17 1 21 5 17 9"/>
                    <path d="M3 11V9a4 4 0 0 1 4-4h14"/>
                    <polyline points="7 23 3 19 7 15"/>
                    <path d="M21 13v2a4 4 0 0 1-4 4H3"/>
                  </svg>
                </div>
                <span>Swap</span>
              </button>
              <button className="ph-action-btn" onClick={() => setView("receive")}>
                <div className="ph-action-icon">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#9945FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect width="5" height="5" x="3" y="3" rx="1"/>
                    <rect width="5" height="5" x="16" y="3" rx="1"/>
                    <rect width="5" height="5" x="3" y="16" rx="1"/>
                    <path d="M21 16h-3a2 2 0 0 0-2 2v3"/>
                    <path d="M21 21v.01"/>
                    <path d="M12 7v3a2 2 0 0 1-2 2H7"/>
                    <path d="M3 12h.01"/>
                    <path d="M12 3h.01"/>
                    <path d="M12 16v.01"/>
                    <path d="M16 12h1"/>
                    <path d="M21 12v.01"/>
                    <path d="M12 21v-1"/>
                  </svg>
                </div>
                <span>Receive</span>
              </button>
              <button className="ph-action-btn" onClick={() => { setLockToken(null); setView("lock"); }}>
                <div className="ph-action-icon">
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="#9945FF" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <rect x="3" y="11" width="18" height="11" rx="2"/>
                    <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                  </svg>
                </div>
                <span>Lock</span>
              </button>
            </div>

            {/* Tokens / Locked tabs */}
            <div className="ph-tabs-row">
              <button className={`ph-tab-btn ${mainTab === "tokens" ? "active" : ""}`} onClick={() => setMainTab("tokens")}>
                Tokens
              </button>
              <button className={`ph-tab-btn ${mainTab === "locked" ? "active" : ""}`} onClick={() => { setMainTab("locked"); refreshLocks(); }}>
                Locked
              </button>
              <button className="ph-tab-refresh" onClick={() => { refreshTokens(); refreshLocks(); }} title="Refresh">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
                  <polyline points="23 4 23 10 17 10"/>
                  <path d="M20.49 15a9 9 0 1 1-2.12-9.36L23 10"/>
                </svg>
              </button>
            </div>

            {/* Content */}
            <div className="ph-content">
              {mainTab === "tokens" && (
                tokensLoading ? (
                  <div className="ph-loading"><div className="spinner" /></div>
                ) : tokens.length === 0 ? (
                  <div className="ph-empty">No tokens found</div>
                ) : (
                  <div className="ph-token-list">
                    {tokens.map(t => (
                      <div key={t.mint} className="ph-token-card" onClick={() => { setLockToken(t); setView("lock"); }}>
                        <div className="ph-token-logo-wrap">
                          {t.logo
                            ? <img src={t.logo} alt={t.symbol} className="ph-token-logo" onError={e => { (e.target as HTMLImageElement).style.display = "none"; }} />
                            : <div className="ph-token-logo-ph">{t.symbol.slice(0, 2)}</div>
                          }
                        </div>
                        <div className="ph-token-info">
                          <span className="ph-token-name">{t.name.length > 18 ? t.name.slice(0, 18) + "…" : t.name}</span>
                          <span className="ph-token-bal">{fmtBal(t.uiBalance)} {t.symbol}</span>
                        </div>
                        <div className="ph-token-value">
                          <span className="ph-token-usd">{fmtUsd(t.valueUsd)}</span>
                          {t.priceChange24h !== 0 && isFinite(t.priceChange24h) && (() => {
                            const chg = t.valueUsd * (t.priceChange24h / 100);
                            if (!isFinite(chg) || Math.abs(chg) < 0.005) return null;
                            const pos = chg >= 0;
                            return <span className={`ph-token-change ${pos ? "pos" : "neg"}`}>{pos ? "+" : ""}{fmtUsd(Math.abs(chg))}</span>;
                          })()}
                        </div>
                      </div>
                    ))}
                  </div>
                )
              )}

              {mainTab === "locked" && (
                <LocksTable
                  locks={locks}
                  tokenMap={tokenMap}
                  currentPrices={currentPrices}
                  onUnlock={handleUnlock}
                  loading={txLoading}
                />
              )}
            </div>

            {/* Bottom nav */}
            <nav className="ph-nav">
              <button className={`ph-nav-btn ${mainTab === "tokens" ? "active" : ""}`} onClick={() => setMainTab("tokens")}>
                {mainTab === "tokens" ? (
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M10 20v-6h4v6h5v-8h3L12 3 2 12h3v8z"/>
                  </svg>
                ) : (
                  <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                    <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
                    <polyline points="9 22 9 12 15 12 15 22"/>
                  </svg>
                )}
              </button>
              <button className="ph-nav-btn" onClick={() => { setLockToken(null); setView("lock"); }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <rect x="3" y="11" width="18" height="11" rx="2"/>
                  <path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                </svg>
              </button>
              <button className="ph-nav-btn" onClick={() => { setView("activity"); refreshActivity(); }}>
                <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                  <circle cx="12" cy="12" r="10"/>
                  <polyline points="12 6 12 12 16 14"/>
                </svg>
              </button>
            </nav>
          </>
        )}
      </div>
    </div>
  );
}

export function Dashboard() {
  return <ErrorBoundary><DashboardInner /></ErrorBoundary>;
}
