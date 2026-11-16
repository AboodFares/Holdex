// Central config for the same-origin RPC/Helius proxy endpoints.
//
// Web app: PROXY_BASE is empty, so requests go same-origin (/rpc, /api/...)
//   - dev:  handled by the Vite dev proxy (vite.config.ts)
//   - prod: handled by the Vercel functions in /api
// Extension: the popup runs at chrome-extension://… with no server, so the
//   extension build sets VITE_PROXY_BASE to the deployed site URL.
const PROXY_BASE =
  (import.meta.env.VITE_PROXY_BASE as string | undefined) ||
  (typeof window !== "undefined" ? window.location.origin : "");

export const RPC_URL = `${PROXY_BASE}/rpc`;

export const heliusTxUrl = (wallet: string, limit = 50) =>
  `${PROXY_BASE}/api/helius-tx?wallet=${wallet}&limit=${limit}`;
