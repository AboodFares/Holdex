// Vercel serverless function: proxies the Helius Enhanced Transactions API.
// Usage: GET /api/helius-tx?wallet=<address>&limit=50
// Keeps the Helius API key server-side (HELIUS_KEY env var).
export default async function handler(req, res) {
  if (req.method !== "GET") {
    res.status(405).json({ error: "Method not allowed" });
    return;
  }

  const key = process.env.HELIUS_KEY;
  if (!key) {
    res.status(500).json({ error: "HELIUS_KEY not configured" });
    return;
  }

  const wallet = req.query.wallet;
  if (!wallet || !/^[1-9A-HJ-NP-Za-km-z]{32,44}$/.test(String(wallet))) {
    res.status(400).json({ error: "Invalid or missing wallet" });
    return;
  }

  const limit = Math.min(parseInt(req.query.limit, 10) || 50, 100);

  try {
    const upstream = await fetch(
      `https://api.helius.xyz/v0/addresses/${wallet}/transactions?api-key=${key}&limit=${limit}`
    );
    const text = await upstream.text();
    res.status(upstream.status);
    res.setHeader("Content-Type", "application/json");
    res.send(text);
  } catch (e) {
    res.status(502).json({ error: "Activity proxy failed", detail: String(e) });
  }
}
