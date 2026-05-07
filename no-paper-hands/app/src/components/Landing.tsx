import { useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import Hls from "hls.js";

const HLS_SRC = "https://stream.mux.com/4IMYGcL01xjs7ek5ANO17JC4VQVUTsojZlnw4fXzwSxc.m3u8";

function VideoBackground() {
  const ref = useRef<HTMLVideoElement>(null);

  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    if (Hls.isSupported()) {
      const hls = new Hls({ autoStartLoad: true });
      hls.loadSource(HLS_SRC);
      hls.attachMedia(video);
      return () => hls.destroy();
    } else if (video.canPlayType("application/vnd.apple.mpegurl")) {
      // Safari — native HLS
      video.src = HLS_SRC;
    }
  }, []);

  return (
    <video
      ref={ref}
      className="land-video-bg"
      autoPlay
      muted
      loop
      playsInline
    />
  );
}

export function Landing() {
  const navigate = useNavigate();

  return (
    <div className="land-root">

      {/* ── Nav ── */}
      <nav className="land-nav">
        <div className="land-logo">
          <span className="land-logo-icon">◆</span>
          <span className="land-logo-text">Holdex</span>
        </div>

        <div className="land-nav-pill">
          <a href="#how">How it works</a>
          <a href="#features">Features</a>
          <a href="#faq">FAQ</a>
          <button className="land-nav-cta" onClick={() => navigate("/app")}>
            Launch App ↗
          </button>
        </div>

        <div style={{ width: 120 }} />
      </nav>

      {/* ── Hero ── */}
      <section className="land-hero">

        {/* Full-screen video background */}
        <VideoBackground />

        {/* Dark overlay so text stays readable */}
        <div className="land-video-overlay" />

        {/* Badge + headline */}
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

          <div className="land-cta-row">
            <span className="land-cta-label">Launch the app</span>
            <button className="land-cta-circle" onClick={() => navigate("/app")}>↗</button>
          </div>
        </div>
      </section>


    </div>
  );
}
