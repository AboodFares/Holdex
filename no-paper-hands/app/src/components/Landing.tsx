import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Hls from "hls.js";
import { AuthModal } from "./AuthModal";
import { useAuth } from "../context/AuthContext";

const HLS_SRC = "https://stream.mux.com/4IMYGcL01xjs7ek5ANO17JC4VQVUTsojZlnw4fXzwSxc.m3u8";

const FAQS = [
  {
    q: "Can I unlock early if I change my mind?",
    a: "No — and that's the point. The smart contract has no admin key, no back door, and no override. Once you lock, only the condition you set (date or price) can release your tokens.",
  },
  {
    q: "Who holds my tokens while they're locked?",
    a: "Nobody. Your tokens sit in a program-derived vault on Solana. We have zero custody — no private keys, no multisig, no ability to touch your funds.",
  },
  {
    q: "What happens when my lock condition is met?",
    a: "The app detects it automatically. A withdraw button becomes active and you claim your tokens in one tap — no waiting, no approval needed.",
  },
  {
    q: "Which tokens are supported?",
    a: "Any SPL or Token-2022 token on Solana mainnet. Memecoins, governance tokens, LP tokens — if it's in your wallet, you can lock it.",
  },
  {
    q: "Can I set a price target AND a date at the same time?",
    a: "Yes. Pick 'either condition' mode and your tokens unlock whichever comes first — great if you want a safety net on time but also want to catch a price pump.",
  },
  {
    q: "Is there a fee?",
    a: "No protocol fee. You only pay the standard Solana transaction fee (a fraction of a cent) when locking or withdrawing.",
  },
];

function VideoBackground() {
  const ref = useRef<HTMLVideoElement>(null);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (Hls.isSupported()) {
      const hls = new Hls();
      hls.loadSource(HLS_SRC);
      hls.attachMedia(video);
      return () => hls.destroy();
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      video.src = HLS_SRC;
    }
  }, []);
  return <video ref={ref} className="land-video-bg" autoPlay muted loop playsInline />;
}

function FaqItem({ q, a, index }: { q: string; a: string; index: number }) {
  const [open, setOpen] = useState(false);
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`faq-item ${open ? "open" : ""} ${inView ? "in-view" : ""}`}
      style={{ transitionDelay: `${index * 80}ms` }}
      onClick={() => setOpen(!open)}
    >
      <div className="faq-q">
        <span>{q}</span>
        <span className="faq-arrow">{open ? "−" : "+"}</span>
      </div>
      {open && <p className="faq-a">{a}</p>}
    </div>
  );
}

function FeatureCard({ icon, title, description, items, delay, highlight }: {
  icon: React.ReactNode;
  title: string;
  description: string;
  items: string[];
  delay: number;
  highlight?: boolean;
}) {
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold: 0.15 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div
      ref={ref}
      className={`land-feature-card ${highlight ? "land-feature-card-highlight" : ""} ${inView ? "in-view" : ""}`}
      style={{ transitionDelay: `${delay}ms` }}
    >
      <div className="land-feature-icon">{icon}</div>
      <h3>{title}</h3>
      <p>{description}</p>
      <ul className="land-feature-list">
        {items.map((item, i) => <li key={i}>{item}</li>)}
      </ul>
    </div>
  );
}

const SCREENS = [
  {
    src: "/screenshot-home.png",
    title: "Your portfolio",
    desc: "Every token. Live prices. All locked value in one view.",
  },
  {
    src: "/screenshot-lock.png",
    title: "Lock in seconds",
    desc: "Pick a token, set a target, confirm. Done.",
  },
  {
    src: "/screenshot-activity.png",
    title: "Track every move",
    desc: "Sends, receives, locks — grouped by day.",
  },
];

function ScreenCol({ src, title, desc, delay }: { src: string; title: string; desc: string; delay: number }) {
  const [inView, setInView] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) { setInView(true); obs.disconnect(); } },
      { threshold: 0.1 }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);

  return (
    <div ref={ref} className={`land-screen-col ${inView ? "in-view" : ""}`} style={{ transitionDelay: `${delay}ms` }}>
      <div className="land-screen-img-wrap">
        <img src={src} alt={title} />
      </div>
      <div className="land-screen-info">
        <div className="land-screen-title">{title}</div>
        <div className="land-screen-desc">{desc}</div>
      </div>
    </div>
  );
}

function HoldexLogo({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
      <defs>
        <linearGradient id="holdex-grad" x1="0" y1="0" x2="24" y2="24" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="#9945FF"/>
          <stop offset="100%" stopColor="#14F195"/>
        </linearGradient>
      </defs>
      <path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"
        stroke="url(#holdex-grad)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
      <path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"
        stroke="url(#holdex-grad)" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round"/>
    </svg>
  );
}

const SOL_MINT = "So11111111111111111111111111111111111111112";

function SolanaCard() {
  const [price, setPrice] = useState<string | null>(null);
  const [change, setChange] = useState<number | null>(null);

  useEffect(() => {
    fetch(`https://api.dexscreener.com/tokens/v1/solana/${SOL_MINT}`)
      .then(r => r.json())
      .then((pairs: Array<{ priceUsd?: string; priceChange?: { h24?: number } }>) => {
        const p = pairs?.[0];
        if (p?.priceUsd) setPrice(parseFloat(p.priceUsd).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 }));
        if (p?.priceChange?.h24 != null) setChange(p.priceChange.h24);
      })
      .catch(() => {});
  }, []);

  return (
    <div className="sol-card" tabIndex={0}>
      <svg className="sol-img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 397.7 311.7">
        <defs>
          <linearGradient id="sol-a" x1="90.9" y1="319.9" x2="296.5" y2="-6.4" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#9945ff"/><stop offset=".91" stopColor="#14f195"/>
          </linearGradient>
          <linearGradient id="sol-b" x1="90.9" y1="319.9" x2="296.5" y2="-6.4" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#9945ff"/><stop offset=".91" stopColor="#14f195"/>
          </linearGradient>
          <linearGradient id="sol-c" x1="90.9" y1="319.9" x2="296.5" y2="-6.4" gradientUnits="userSpaceOnUse">
            <stop offset="0" stopColor="#9945ff"/><stop offset=".91" stopColor="#14f195"/>
          </linearGradient>
        </defs>
        <path fill="url(#sol-a)" d="M64.6 237.9c2.4-2.4 5.7-3.8 9.2-3.8h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1l62.7-62.7z"/>
        <path fill="url(#sol-b)" d="M64.6 3.8C67.1 1.4 70.4 0 73.8 0h317.4c5.8 0 8.7 7 4.6 11.1l-62.7 62.7c-2.4 2.4-5.7 3.8-9.2 3.8H6.5c-5.8 0-8.7-7-4.6-11.1L64.6 3.8z"/>
        <path fill="url(#sol-c)" d="M333.1 120.1c-2.4-2.4-5.7-3.8-9.2-3.8H6.5c-5.8 0-8.7 7-4.6 11.1l62.7 62.7c2.4 2.4 5.7 3.8 9.2 3.8h317.4c5.8 0 8.7-7 4.6-11.1l-62.7-62.7z"/>
      </svg>
      <div className="sol-textBox">
        <p className="sol-head">Solana</p>
        <span className="sol-tag">Cryptocurrency</span>
        <p className="sol-price">
          <span className="sol-currency">$</span>
          {price ?? "—"}
        </p>
        {change != null && (
          <span className={`sol-change ${change >= 0 ? "pos" : "neg"}`}>
            {change >= 0 ? "▲" : "▼"} {Math.abs(change).toFixed(2)}% 24h
          </span>
        )}
      </div>
    </div>
  );
}

export function Landing() {
  const navigate   = useNavigate();
  const { user, signOut } = useAuth();
  const [showAuth, setShowAuth] = useState(false);
  const [navHidden, setNavHidden] = useState(false);
  const lastScrollY = useRef(0);

  useEffect(() => {
    const onScroll = () => {
      const y = window.scrollY;
      setNavHidden(y > 80 && y > lastScrollY.current);
      lastScrollY.current = y;
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <div className="land-root">

      {/* ── Nav ── */}
      <nav className={`land-nav ${navHidden ? "land-nav-hidden" : ""}`}>
        <div className="land-logo">
          <HoldexLogo size={22} />
          <span className="land-logo-text">Holdex</span>
        </div>

        <div className="land-nav-pill">
          <button className="land-nav-link" onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}>Features</button>
          <button className="land-nav-link" onClick={() => document.getElementById("faq")?.scrollIntoView({ behavior: "smooth" })}>FAQ</button>
          <button className="land-nav-cta" onClick={() => navigate("/app")}>Launch App ↗</button>
        </div>

        <div className="land-nav-auth">
          {user ? (
            <>
              <span className="land-nav-user">{user.email?.split("@")[0]}</span>
              <button className="land-nav-signout" onClick={signOut}>Sign out</button>
            </>
          ) : (
            <>
              <button className="land-nav-signin" onClick={() => setShowAuth(true)}>Sign In</button>
              <button className="land-nav-signup" onClick={() => setShowAuth(true)}>Sign Up</button>
            </>
          )}
        </div>
      </nav>

      {/* ── Hero ── */}
      <section className="land-hero">
        <VideoBackground />
        <div className="land-video-overlay" />

        <div className="land-hero-content">
          <div className="land-badge">DIAMOND HANDS PROTOCOL · SOLANA</div>
          <h1 className="land-headline">
            Redefining the way you<br />
            <span className="land-orange">Lock</span> and{" "}
            <span className="land-orange">Hold</span> Tokens
          </h1>
          <p className="land-sub">
            Lock your Solana tokens until a date or price you believe in.
            The smart contract holds the line — so you don't have to.
          </p>
          <div className="land-hero-btns">
            <button className="land-btn-download land-btn-soon" disabled>
              ↓ Chrome Extension — Coming Soon
            </button>
            <button className="land-btn-launch" onClick={() => navigate("/app")}>
              Launch App ↗
            </button>
          </div>
        </div>
      </section>

      {/* ── Feature cards ── */}
      <section id="features" className="land-features">
        <div className="land-section-label">WHAT WE DO</div>
        <h2 className="land-section-title">Lock tokens. Build discipline.</h2>

        <div className="land-feature-cards">
          <FeatureCard
            icon={
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <circle cx="12" cy="12" r="10"/>
                <polyline points="12 6 12 12 16 14"/>
              </svg>
            }
            title="Time Locks"
            description="Set a date. Walk away. The contract holds the line so you don't have to."
            items={["Any future date & time", "Zero override — ever", "Stack multiple locks per token"]}
            delay={0}
          />
          <FeatureCard
            icon={
              <svg width="26" height="26" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
                <polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/>
                <polyline points="16 7 22 7 22 13"/>
              </svg>
            }
            title="Price Targets"
            description="Pick the number you believe in. Tokens stay locked until the market gets there."
            items={["Any USD price target", "Auto-unlocks on hit", "Combine with a time lock"]}
            delay={120}
            highlight
          />
        </div>
      </section>

      {/* ── Screenshots ── */}
      <section className="land-screens">
        <div className="land-screens-glow" />
        <div className="land-section-label">SEE IT IN ACTION</div>
        <h2 className="land-section-title">Built like a wallet. Works like a vault.</h2>
        <div className="land-screens-grid">
          {SCREENS.map((s, i) => (
            <ScreenCol key={i} src={s.src} title={s.title} desc={s.desc} delay={i * 120} />
          ))}
        </div>
      </section>

      {/* ── FAQ ── */}
      <section id="faq" className="land-faq">
        <div className="land-faq-inner">
          <div className="land-faq-left">
            <div className="land-section-label">FAQ</div>
            <div className="land-faq-list">
              {FAQS.map((f, i) => <FaqItem key={i} index={i} q={f.q} a={f.a} />)}
            </div>
          </div>
          <div className="land-faq-right">
            <SolanaCard />
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="land-footer">
        <div className="land-footer-top">
          <div className="land-footer-brand">
            <div className="land-footer-logo">
              <HoldexLogo size={20} />
              <span className="land-logo-text">Holdex</span>
            </div>
            <p className="land-footer-tagline">Diamond hands, enforced on-chain.<br />Built on Solana.</p>
          </div>

          <div className="land-footer-links">
            <div className="land-footer-col">
              <div className="land-footer-col-title">Product</div>
              <button className="land-footer-link" onClick={() => document.getElementById("features")?.scrollIntoView({ behavior: "smooth" })}>Features</button>
              <button className="land-footer-link" onClick={() => document.getElementById("faq")?.scrollIntoView({ behavior: "smooth" })}>FAQ</button>
              <button className="land-footer-link" onClick={() => navigate("/app")}>Launch App</button>
            </div>
            <div className="land-footer-col">
              <div className="land-footer-col-title">Developers</div>
              <a className="land-footer-link" href="https://github.com/AboodFares/Holdex" target="_blank" rel="noreferrer">GitHub</a>
              <a className="land-footer-link" href="https://docs.solana.com" target="_blank" rel="noreferrer">Solana Docs</a>
              <a className="land-footer-link" href="https://anchor-lang.com" target="_blank" rel="noreferrer">Anchor</a>
            </div>
            <div className="land-footer-col">
              <div className="land-footer-col-title">Community</div>
              <a className="land-footer-link" href="https://twitter.com" target="_blank" rel="noreferrer">Twitter / X</a>
              <a className="land-footer-link" href="https://discord.com" target="_blank" rel="noreferrer">Discord</a>
            </div>
          </div>
        </div>

        <div className="land-footer-bottom">
          <span>© 2026 Holdex. All rights reserved.</span>
          <div className="land-footer-legal">
            <span>Privacy Policy</span>
            <span>Terms of Service</span>
          </div>
        </div>
      </footer>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}
