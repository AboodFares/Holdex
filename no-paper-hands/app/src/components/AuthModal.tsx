import { useState } from "react";
import { useWallet } from "@solana/wallet-adapter-react";
import { supabase } from "../lib/supabase";
import { signInWithWallet } from "../lib/walletAuth";

interface Props { onClose: () => void; }

type Mode = "signin" | "signup";
type Tab  = "email" | "wallet";

export function AuthModal({ onClose }: Props) {
  const { publicKey, signMessage, connect, connecting, connected } = useWallet();

  const [tab,      setTab]      = useState<Tab>("email");
  const [mode,     setMode]     = useState<Mode>("signin");
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [loading,  setLoading]  = useState(false);
  const [error,    setError]    = useState<string | null>(null);
  const [success,  setSuccess]  = useState<string | null>(null);

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setLoading(true);
    try {
      if (mode === "signin") {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onClose();
      } else {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        setSuccess("Check your email to confirm your account.");
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Something went wrong");
    } finally { setLoading(false); }
  }

  async function handleWallet() {
    setError(null); setLoading(true);
    try {
      if (!connected) {
        await connect();
        // Wait up to 5s for the wallet to populate publicKey after connecting
        await new Promise<void>((resolve, reject) => {
          if (publicKey) { resolve(); return; }
          const deadline = Date.now() + 5000;
          const iv = setInterval(() => {
            if (publicKey) { clearInterval(iv); resolve(); }
            else if (Date.now() > deadline) { clearInterval(iv); reject(new Error("Wallet did not connect in time")); }
          }, 100);
        });
      }
      if (!publicKey || !signMessage) throw new Error("Wallet not connected");
      const { error } = await signInWithWallet(publicKey, signMessage);
      if (error) throw new Error(error);
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Wallet sign-in failed");
    } finally { setLoading(false); }
  }

  return (
    <div className="modal-backdrop" onClick={onClose}>
      <div className="modal-box" onClick={(e) => e.stopPropagation()}>

        <div className="modal-header">
          <span className="modal-title">{mode === "signin" ? "Sign In" : "Create Account"}</span>
          <button className="modal-close" onClick={onClose}>✕</button>
        </div>

        {/* Tab switcher */}
        <div className="modal-tabs">
          <button className={`modal-tab ${tab === "email" ? "active" : ""}`} onClick={() => setTab("email")}>
            Email
          </button>
          <button className={`modal-tab ${tab === "wallet" ? "active" : ""}`} onClick={() => setTab("wallet")}>
            Wallet
          </button>
        </div>

        {error   && <div className="modal-error">{error}</div>}
        {success && <div className="modal-success">{success}</div>}

        {tab === "email" ? (
          <form className="modal-form" onSubmit={handleEmail}>
            <input
              className="modal-input" type="email" placeholder="Email address"
              value={email} onChange={(e) => setEmail(e.target.value)} required
            />
            <input
              className="modal-input" type="password" placeholder="Password"
              value={password} onChange={(e) => setPassword(e.target.value)} required
            />
            <button className="modal-btn-primary" type="submit" disabled={loading}>
              {loading ? "Loading…" : mode === "signin" ? "Sign In" : "Create Account"}
            </button>
            <p className="modal-switch">
              {mode === "signin" ? "Don't have an account? " : "Already have an account? "}
              <button type="button" onClick={() => { setMode(mode === "signin" ? "signup" : "signin"); setError(null); }}>
                {mode === "signin" ? "Sign Up" : "Sign In"}
              </button>
            </p>
          </form>
        ) : (
          <div className="modal-wallet">
            <div className="modal-wallet-icon">◆</div>
            <p className="modal-wallet-desc">
              Connect your Phantom wallet and sign a message to authenticate. No transaction required.
            </p>
            <button className="modal-btn-primary" onClick={handleWallet} disabled={loading || connecting}>
              {connecting ? "Connecting…" : loading ? "Signing…" : "Sign In with Phantom"}
            </button>
          </div>
        )}

      </div>
    </div>
  );
}
