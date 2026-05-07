import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");
  const heliusKey = env.VITE_HELIUS_KEY;

  return {
    plugins: [
      react(),
      nodePolyfills({
        include: ["buffer", "stream", "crypto"],
        globals: { Buffer: true, process: true },
      }),
    ],
    server: {
      proxy: {
        "/rpc": {
          target: `https://mainnet.helius-rpc.com/?api-key=${heliusKey}`,
          changeOrigin: true,
          rewrite: (path) => path.replace(/^\/rpc/, ""),
        },
      },
    },
  };
});
