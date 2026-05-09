import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import Hls from "hls.js";
import { AuthModal } from "./AuthModal";
import { useAuth } from "../context/AuthContext";

const HLS_SRC = "https://stream.mux.com/4IMYGcL01xjs7ek5ANO17JC4VQVUTsojZlnw4fXzwSxc.m3u8";

const FAQS = [
  {
    q: "Is this non-custodial?",
    a: "Yes. Your tokens are held in a PDA vault controlled entirely by the on-chain program. We have zero admin keys or override capability.",
  },
  {
    q: "What tokens can I lock?",
    a: "Any SPL token or Token-2022 token on Solana mainnet — memecoins, governance tokens, LP positions, anything.",
  },
  {
    q: "What happens when the lock expires?",
    a: "You can withdraw your tokens directly from the extension. The smart contract enforces the condition — no one can release them before then, not even us.",
  },
  {
    q: "Can I set both a time and a price target?",
    a: "Yes. You can lock until a specific date, until a price target is hit, or unlock when either condition is met first.",
  },
  {
    q: "Do I need an account?",
    a: "No account is required to use the extension. Signing in lets you track your locks across devices.",
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

const SCREENS = [
  {
    src: "/screenshot-home.png",
    title: "Your portfolio at a glance",
    desc: "See every token, its live USD value, and how much you've locked — all in one screen.",
  },
  {
    src: "/screenshot-lock.png",
    title: "Lock in seconds",
    desc: "Pick a token, set a date or price target, and confirm with one tap. No forms, no friction.",
  },
  {
    src: "/screenshot-activity.png",
    title: "Track every move",
    desc: "A full timeline of sends, receives, locks and unlocks grouped by day — just like a real wallet.",
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

export function Landing() {
  const navigate   = useNavigate();
  const { user, signOut } = useAuth();
  const [showAuth, setShowAuth] = useState(false);

  return (
    <div className="land-root">

      {/* ── Nav ── */}
      <nav className="land-nav">
        <div className="land-logo">
          <span className="land-logo-icon">◆</span>
          <span className="land-logo-text">Holdex</span>
        </div>

        <div className="land-nav-pill">
          <a href="#features">Features</a>
          <a href="#faq">FAQ</a>
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
            Commit your Solana tokens on-chain until a date or price target.
            No early exits. No paper hands. Your future self will thank you.
          </p>
          <div className="land-hero-btns">
            <button className="land-btn-download land-btn-soon" disabled>
              ↓ Chrome Extension — Coming Soon
            </button>
            <button className="land-cta-circle" onClick={() => navigate("/app")}>↗</button>
          </div>
        </div>
      </section>

      {/* ── Feature cards ── */}
      <section id="features" className="land-features">
        <div className="land-section-label">WHAT WE DO</div>
        <h2 className="land-section-title">Lock tokens. Build discipline.</h2>

        <div className="land-feature-cards">
          <div className="land-feature-card">
            <div className="land-feature-icon">⏱</div>
            <h3>Time Locks</h3>
            <p>
              Set an exact date and time for your tokens to unlock. Perfect for vesting schedules,
              long-term holds, or removing the temptation to sell early.
            </p>
            <ul className="land-feature-list">
              <li>Pick any future date & time</li>
              <li>On-chain enforcement — no override possible</li>
              <li>Multiple locks per token</li>
            </ul>
          </div>

          <div className="land-feature-card land-feature-card-highlight">
            <div className="land-feature-icon">📈</div>
            <h3>Price Targets</h3>
            <p>
              Lock until your token hits a specific USD price. Stop yourself from selling at
              the bottom and let the market come to you.
            </p>
            <ul className="land-feature-list">
              <li>Set any USD price target</li>
              <li>Unlock when market price is reached</li>
              <li>Or combine with a time lock (either condition)</li>
            </ul>
          </div>
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
        <div className="land-section-label">FAQ</div>
        <h2 className="land-section-title">Common questions</h2>
        <div className="land-faq-list">
          {FAQS.map((f, i) => <FaqItem key={i} index={i} q={f.q} a={f.a} />)}
        </div>
      </section>

      {/* ── Footer ── */}
      <footer className="land-footer">
        <span className="land-logo-icon">◆</span>
        <span>Holdex · Diamond hands, enforced on-chain.</span>
        <a href="https://github.com/AboodFares/Holdex" target="_blank" rel="noreferrer">GitHub</a>
      </footer>

      {showAuth && <AuthModal onClose={() => setShowAuth(false)} />}
    </div>
  );
}
