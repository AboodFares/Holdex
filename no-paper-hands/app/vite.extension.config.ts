import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import { nodePolyfills } from "vite-plugin-node-polyfills";
import { resolve } from "path";
import { copyFileSync, mkdirSync } from "fs";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "");

  return {
    define: {
      // The extension popup has no server of its own, so it routes RPC/Helius
      // calls through the deployed site's proxy (key stays server-side).
      "import.meta.env.VITE_PROXY_BASE":     JSON.stringify(env.VITE_PROXY_BASE || "https://holdex-beta.vercel.app"),
      "import.meta.env.VITE_SUPABASE_URL":   JSON.stringify(env.VITE_SUPABASE_URL),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(env.VITE_SUPABASE_ANON_KEY),
    },
    plugins: [
      react(),
      nodePolyfills({ include: ["buffer", "stream", "crypto"], globals: { Buffer: true, process: true } }),
      {
        name: "copy-extension-assets",
        closeBundle() {
          // copy manifest and icons into dist-extension
          copyFileSync("manifest.json", "dist-extension/manifest.json");
          try {
            mkdirSync("dist-extension/icons", { recursive: true });
            // placeholder — replace with real icons before publishing
          } catch {}
        },
      },
    ],
    build: {
      outDir: "dist-extension",
      emptyOutDir: true,
      rollupOptions: {
        input: { popup: resolve(__dirname, "popup.html") },
        output: { entryFileNames: "[name].js", chunkFileNames: "[name].js", assetFileNames: "[name].[ext]" },
      },
    },
  };
});
