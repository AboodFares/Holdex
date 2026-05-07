import { useMemo } from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import {
  ConnectionProvider,
  WalletProvider,
} from "@solana/wallet-adapter-react";
import { WalletModalProvider } from "@solana/wallet-adapter-react-ui";
import { PhantomWalletAdapter } from "@solana/wallet-adapter-phantom";
import "@solana/wallet-adapter-react-ui/styles.css";
import { Dashboard } from "./components/Dashboard";
import { Landing } from "./components/Landing";

const RPC = import.meta.env.DEV
  ? `${window.location.origin}/rpc`
  : `https://mainnet.helius-rpc.com/?api-key=${import.meta.env.VITE_HELIUS_KEY}`;

export default function App() {
  const wallets = useMemo(() => [new PhantomWalletAdapter()], []);

  return (
    <BrowserRouter>
      <ConnectionProvider endpoint={RPC}>
        <WalletProvider wallets={wallets} autoConnect>
          <WalletModalProvider>
            <Routes>
              <Route path="/" element={<Landing />} />
              <Route path="/app" element={<Dashboard />} />
            </Routes>
          </WalletModalProvider>
        </WalletProvider>
      </ConnectionProvider>
    </BrowserRouter>
  );
}
