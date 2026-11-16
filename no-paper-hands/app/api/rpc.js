// Vercel serverless function: proxies Solana JSON-RPC to Helius.
// Keeps the Helius API key server-side (HELIUS_KEY env var) so it is
// never shipped in the client bundle.
export default async function handler(req, res) {
  if (req.method !== "POST") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const key = process.env.HELIUS_KEY;
  if (!key) {
    res.status(500).json({ error: "HELIUS_KEY not configured" });
    return;
  }

  try {
    const upstream = await fetch(
      `https://mainnet.helius-rpc.com/?api-key=${key}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: typeof req.body === "string" ? req.body : JSON.stringify(req.body),
      }
    );

    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Content-Type", "application/json");
    res.send(text);
  } catch (e) {
    res.status(502).json({ error: "RPC proxy failed", detail: String(e) });
  }
}
