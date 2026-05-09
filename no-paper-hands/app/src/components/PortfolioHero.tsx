import type { TokenInfo, LockEntry } from "../types";

type Props = {
  tokens: TokenInfo[];
  locks: LockEntry[];
  tokenMap: Record<string, TokenInfo>;
};

export function PortfolioHero({ tokens, locks, tokenMap }: Props) {
  const totalUsd = tokens.reduce((s, t) => s + t.valueUsd, 0);

  const lockedUsd = locks.reduce((s, l) => {
    const t = tokenMap[l.mint];
    if (!t) return s;
    const ui = Number(l.amount) / 10 ** t.decimals;
    const val = ui * (t.priceUsd || 0);
    return s + (isFinite(val) ? val : 0);
  }, 0);

  const fmt = (n: number) =>
    n >= 1000
      ? "$" + n.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
      : "$" + n.toFixed(n < 1 ? 4 : 2);

  return (
    <div className="portfolio-hero">
      <div className="portfolio-main">
        <div className="label">Portfolio Value</div>
        <div className="total">{fmt(totalUsd)}</div>
        <div className="sub">{tokens.length} token{tokens.length !== 1 ? "s" : ""} in wallet</div>
      </div>
      <div className="portfolio-stats">
        <div className="stat">
          <div className="label">Locked</div>
          <div className="value purple">{fmt(lockedUsd)}</div>
        </div>
        <div className="stat">
          <div className="label">Available</div>
          <div className="value green">{fmt(Math.max(0, totalUsd - lockedUsd))}</div>
        </div>
        <div className="stat">
          <div className="label">Active Locks</div>
          <div className="value">{locks.length}</div>
        </div>
      </div>
    </div>
  );
}
