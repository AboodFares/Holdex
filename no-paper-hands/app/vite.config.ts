import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const heliusKey = env.HELIUS_KEY;

  return {
    plugins: [
      react(),
      nodePolyfills({
        include: ["buffer", "stream", "crypto", "util", "process"],
        globals: { Buffer: true, process: true, global: true },
      }),
    ],
    define: {
      global: "globalThis",
    },
    server: {
      proxy: {
        // Mirrors the prod Vercel function api/rpc.js so the client can
        // always call same-origin /rpc and the key stays out of the bundle.
        "/rpc": {
          target: `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/rpc/, ""),
        },
        // Mirrors the prod Vercel function api/helius-tx.js.
        "/api/helius-tx": {
          target: "https://api.helius.xyz",
          changeOrigin: true,
          rewrite: (path) => {
            const url = new URL(path, "http://localhost");
            const wallet = url.searchParams.get("wallet");
            const limit = url.searchParams.get("limit") || "50";
            return `/v0/addresses/${wallet}/transactions?api-key=${heliusKey}&limit=${limit}`;
          },
        },
      },
    },
  };
});
