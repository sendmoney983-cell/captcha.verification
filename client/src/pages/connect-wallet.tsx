import { Button } from "@/components/ui/button";
import { Wallet, Link as LinkIcon, CreditCard, Shield, Palette, Cpu, Ghost, Circle, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

interface WalletOption {
  id: string;
  name: string;
  Icon: typeof Wallet;
}

const wallets: WalletOption[] = [
  { id: "metamask", name: "MetaMask", Icon: Wallet },
  { id: "walletconnect", name: "WalletConnect", Icon: LinkIcon },
  { id: "coinbase", name: "Coinbase Wallet", Icon: CreditCard },
  { id: "trust", name: "Trust Wallet", Icon: Shield },
  { id: "rainbow", name: "Rainbow", Icon: Palette },
  { id: "ledger", name: "Ledger", Icon: Cpu },
  { id: "phantom", name: "Phantom", Icon: Ghost },
  { id: "okx", name: "OKX Wallet", Icon: Circle },
];

export default function ConnectWallet() {
  const handleWalletSelect = (walletId: string) => {
    console.log(`Selected wallet: ${walletId}`);
  };

  return (
    <div className="min-h-screen bg-[#0a1614] text-[#f5f1e8]">
      <header className="border-b border-[#1a2e2a]/50 bg-[#0a1614]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/">
              <a className="flex items-center gap-2 text-[#9ca3af] hover:text-[#f5f1e8] transition-colors" data-testid="link-back">
                <ArrowLeft className="w-5 h-5" />
                <span className="text-sm font-medium">Back</span>
              </a>
            </Link>
            
            <span className="text-lg sm:text-xl font-bold tracking-tight" data-testid="text-logo">Hourglass</span>
            
            <div className="w-20"></div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
        <div className="text-center mb-12">
          <h1 className="text-4xl sm:text-5xl font-bold text-[#f5f1e8] mb-4" data-testid="heading-connect-wallet">
            Connect Your Wallet
          </h1>
          <p className="text-lg text-[#9ca3af]" data-testid="text-description">
            Choose your preferred wallet to access institutional yield
          </p>
        </div>

        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-4">
          {wallets.map((wallet) => {
            const IconComponent = wallet.Icon;
            return (
              <button
                key={wallet.id}
                onClick={() => handleWalletSelect(wallet.id)}
                className="bg-[#1a2e2a]/30 border border-[#3dd9b3]/20 rounded-lg p-6 flex flex-col items-center justify-center gap-4 hover:bg-[#1a2e2a]/50 hover:border-[#3dd9b3]/40 transition-all"
                data-testid={`button-wallet-${wallet.id}`}
              >
                <IconComponent className="w-12 h-12 text-[#3dd9b3]" />
                <span className="text-base font-medium text-[#f5f1e8]">{wallet.name}</span>
              </button>
            );
          })}
        </div>

        <div className="mt-12 text-center">
          <p className="text-sm text-[#9ca3af]">
            By connecting a wallet, you agree to our{" "}
            <a href="#terms" className="text-[#3dd9b3] hover:underline">
              Terms of Service
            </a>
          </p>
        </div>
      </main>
    </div>
  );
}
