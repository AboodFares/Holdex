import { useMemo } from "react";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import "@solana/wallet-adapter-react-ui/styles.css";
import { Dashboard } from "./components/Dashboard";

// Vite proxies /rpc → api.mainnet-beta.solana.com in dev (no CORS).
// In production, swap for a private RPC URL.
const RPC = import.meta.env.DEV
  ? `${window.location.origin}/rpc`
  : "https://mainnet.helius-rpc.com/?api-key=${import.meta.env.VITE_HELIUS_KEY}";

export default function App() {
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <ConnectionProvider endpoint={RPC}>
      <WalletProvider wallets={wallets} autoConnect>
        <WalletModalProvider>
          <Dashboard />
        </WalletModalProvider>
      </WalletProvider>
    </ConnectionProvider>
  );
}
