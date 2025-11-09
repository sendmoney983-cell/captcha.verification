import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { X, Search } from "lucide-react";
import { useConnect } from 'wagmi';

interface WalletModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function WalletModal({ open, onOpenChange }: WalletModalProps) {
  const { connectors, connect } = useConnect();

  const walletList = [
    { 
      name: "WalletConnect", 
      badge: "QR CODE",
      connector: connectors.find(c => c.id === 'walletConnect'),
      icon: "https://cdn.jsdelivr.net/gh/WalletConnect/walletconnect-assets@master/Icon/Blue%20(Default)/Icon.svg"
    },
    { 
      name: "Trust Wallet", 
      badge: "INSTALLED",
      icon: "https://trustwallet.com/assets/images/media/assets/TWT.png"
    },
    { 
      name: "OKX Wallet", 
      badge: "INSTALLED",
      icon: "https://static.okx.com/cdn/assets/imgs/247/58E63FEA47A2B7D7.png"
    },
    { 
      name: "MetaMask",
      connector: connectors.find(c => c.id === 'metaMask' || c.name.toLowerCase().includes('metamask')),
      icon: "https://upload.wikimedia.org/wikipedia/commons/3/36/MetaMask_Fox.svg"
    },
    { 
      name: "1inch Wallet",
      icon: "https://1inch.io/img/1inch_logo.svg"
    },
    { 
      name: "Binance Wallet",
      icon: "https://bin.bnbstatic.com/static/images/common/favicon.ico"
    },
  ];

  const handleConnect = (connector: any) => {
    if (connector) {
      connect({ connector });
      onOpenChange(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[500px] p-0 gap-0 bg-white">
        <DialogHeader className="p-6 pb-4 border-b">
          <div className="flex items-center justify-between">
            <DialogTitle className="text-2xl font-medium text-gray-900">Connect Wallet</DialogTitle>
            <Button
              variant="ghost"
              size="icon"
              onClick={() => onOpenChange(false)}
              className="h-8 w-8 p-0 hover:bg-gray-100"
            >
              <X className="h-5 w-5 text-gray-500" />
            </Button>
          </div>
        </DialogHeader>

        <div className="p-6 space-y-2">
          {walletList.map((wallet, index) => (
            <button
              key={index}
              onClick={() => wallet.connector && handleConnect(wallet.connector)}
              disabled={!wallet.connector}
              className="w-full flex items-center justify-between p-4 rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-blue-500 to-blue-600 rounded-xl flex items-center justify-center">
                  {wallet.icon ? (
                    <img src={wallet.icon} alt={wallet.name} className="w-6 h-6" />
                  ) : (
                    <div className="w-6 h-6 bg-white/20 rounded" />
                  )}
                </div>
                <span className="text-base font-medium text-gray-900">{wallet.name}</span>
              </div>
              <div className="flex items-center gap-2">
                {wallet.badge && (
                  <span className="text-xs font-medium text-emerald-600 px-2 py-1 rounded-md">
                    {wallet.badge}
                  </span>
                )}
                <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
                </svg>
              </div>
            </button>
          ))}
        </div>

        <div className="p-6 pt-0">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-5 w-5 text-gray-400" />
            <Input
              placeholder="Search Wallet"
              className="pl-12 bg-gray-50 border-0 h-14 text-base rounded-xl"
              readOnly
            />
            <span className="absolute right-4 top-1/2 -translate-y-1/2 text-sm text-gray-400">490+</span>
            <svg className="absolute right-12 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </div>
        </div>

        <div className="px-6 pb-4 flex items-center justify-center gap-2 text-xs text-gray-400">
          <span>UX by</span>
          <div className="flex items-center gap-1">
            <div className="w-4 h-4 bg-gray-200 rounded-sm" />
            <span>/</span>
            <span className="font-medium">reown</span>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
