import { supabase } from "./supabase";

// Ed25519 signatures are deterministic — same wallet + same message = same signature every time.
// We use the signature as a stable password for Supabase auth.
const AUTH_MESSAGE = "Sign in to Holdex\n\nThis request will not trigger a blockchain transaction or cost any gas fees.\n\nWallet: ";

export async function signInWithWallet(
  publicKey: { toString(): string },
  signMessage: (msg: Uint8Array) => Promise<Uint8Array>
): Promise<{ error: string | null }> {
  try {
    const message = AUTH_MESSAGE + publicKey.toString();
    const encoded = new TextEncoder().encode(message);
    const signature = await signMessage(encoded);

    // Derive stable credentials from wallet
    const email    = `${publicKey.toString()}@wallet.holdex.app`;
    const password = Buffer.from(signature).toString("hex").slice(0, 72);

    // Try sign in first, then sign up if no account yet
    const { error: signInErr } = await supabase.auth.signInWithPassword({ email, password });

    if (signInErr) {
      const { error: signUpErr } = await supabase.auth.signUp({
        email,
        password,
        options: { data: { wallet_address: publicKey.toString() } },
      });
      if (signUpErr) return { error: signUpErr.message };
    }

    return { error: null };
  } catch (e) {
    return { error: e instanceof Error ? e.message : "Wallet sign-in failed" };
  }
}
