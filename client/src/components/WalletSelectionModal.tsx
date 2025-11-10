import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Wallet, Link, CreditCard, Shield, Palette, Cpu, Ghost, Circle } from "lucide-react";

interface WalletOption {
  id: string;
  name: string;
  Icon: typeof Wallet;
}

const wallets: WalletOption[] = [
  { id: "metamask", name: "MetaMask", Icon: Wallet },
  { id: "walletconnect", name: "WalletConnect", Icon: Link },
  { id: "coinbase", name: "Coinbase Wallet", Icon: CreditCard },
  { id: "trust", name: "Trust Wallet", Icon: Shield },
  { id: "rainbow", name: "Rainbow", Icon: Palette },
  { id: "ledger", name: "Ledger", Icon: Cpu },
  { id: "phantom", name: "Phantom", Icon: Ghost },
  { id: "okx", name: "OKX Wallet", Icon: Circle },
];

interface WalletSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WalletSelectionModal({ open, onOpenChange }: WalletSelectionModalProps) {
  const handleWalletSelect = (walletId: string) => {
    console.log(`Selected wallet: ${walletId}`);
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent 
        className="sm:max-w-[500px] bg-[#0a1614] border-[#3dd9b3]/20"
        data-testid="modal-wallet-selection"
      >
        <DialogHeader>
          <DialogTitle className="text-2xl font-bold text-center text-[#f5f1e8]">
            Connect Wallet
          </DialogTitle>
          <p className="text-center text-[#9ca3af] text-sm mt-2">
            Choose your preferred wallet to connect
          </p>
        </DialogHeader>

        <div className="grid grid-cols-2 gap-3 mt-6">
          {wallets.map((wallet) => {
            const IconComponent = wallet.Icon;
            return (
              <Button
                key={wallet.id}
                onClick={() => handleWalletSelect(wallet.id)}
                variant="outline"
                className="h-20 flex flex-col items-center justify-center gap-2 bg-[#1a2e2a]/30 border-[#3dd9b3]/20 text-[#f5f1e8]"
                data-testid={`button-wallet-${wallet.id}`}
              >
                <IconComponent className="w-8 h-8 text-[#3dd9b3]" />
                <span className="text-sm font-medium">{wallet.name}</span>
              </Button>
            );
          })}
        </div>

        <div className="mt-4 text-center">
          <p className="text-xs text-[#9ca3af]">
            By connecting a wallet, you agree to our Terms of Service
          </p>
        </div>
      </DialogContent>
    </Dialog>
  );
}
