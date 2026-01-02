import { Button } from "@/components/ui/button";
import { ArrowDown, Settings, ChevronDown, Search, Menu } from "lucide-react";
import { useState } from "react";
import { useAccount, useDisconnect } from "wagmi";
import { useConnectModal } from "@rainbow-me/rainbowkit";

const TOKENS = [
  { symbol: "ETH", name: "Ethereum", icon: "⟠", color: "#627EEA" },
  { symbol: "USDC", name: "USD Coin", icon: "◉", color: "#2775CA" },
  { symbol: "USDT", name: "Tether", icon: "₮", color: "#26A17B" },
  { symbol: "DAI", name: "Dai", icon: "◈", color: "#F5AC37" },
  { symbol: "WBTC", name: "Wrapped BTC", icon: "₿", color: "#F7931A" },
];

export default function Home() {
  const [activeTab, setActiveTab] = useState("Swap");
  const [sellAmount, setSellAmount] = useState("");
  const [buyAmount, setBuyAmount] = useState("");
  const [sellToken, setSellToken] = useState(TOKENS[0]);
  const [buyToken, setBuyToken] = useState<typeof TOKENS[0] | null>(null);
  const [showSellTokens, setShowSellTokens] = useState(false);
  const [showBuyTokens, setShowBuyTokens] = useState(false);

  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { disconnect } = useDisconnect();

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
      <div className="fixed top-0 left-0 right-0 z-50 bg-[#FEF4F4] border-b border-border/50">
        <div className="text-center py-2 px-4 text-sm text-muted-foreground">
          UK disclaimer: This web application is provided as a tool for users to interact with the Uniswap Protocol on their own initiative, with no endorsement or recommendation of cryptocurrency trading ...
          <button className="text-primary ml-2 font-medium" data-testid="link-read-more">Read more</button>
        </div>
      </div>

      <header className="fixed top-10 left-0 right-0 z-40 bg-background border-b border-border/30">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between h-16 gap-4">
            <div className="flex items-center gap-2 sm:gap-6">
              <div className="flex items-center gap-2">
                <svg width="28" height="28" viewBox="0 0 48 48" fill="none" data-testid="icon-logo">
                  <path d="M24 4C12.954 4 4 12.954 4 24s8.954 20 20 20 20-8.954 20-20S35.046 4 24 4z" fill="#FC72FF"/>
                  <path d="M32 20c0-4.418-3.582-8-8-8s-8 3.582-8 8c0 2.761 1.4 5.2 3.528 6.637L16 36h16l-3.528-9.363C30.6 25.2 32 22.761 32 20z" fill="white"/>
                </svg>
                <span className="text-xl font-semibold text-foreground hidden sm:block" data-testid="text-logo">Uniswap</span>
              </div>
              
              <button className="p-2 hover:bg-muted rounded-lg sm:hidden" data-testid="button-menu">
                <Menu className="w-5 h-5" />
              </button>

              <nav className="hidden sm:flex items-center gap-1">
                {["Trade", "Explore", "Pool", "Portfolio"].map((item) => (
                  <button
                    key={item}
                    className={`px-4 py-2 text-sm font-medium rounded-full transition-colors ${
                      item === "Trade" 
                        ? "text-foreground" 
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                    data-testid={`nav-${item.toLowerCase()}`}
                  >
                    {item}
                  </button>
                ))}
              </nav>
            </div>

            <div className="flex-1 max-w-md hidden md:block">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                <input
                  type="text"
                  placeholder="Search tokens and pools"
                  className="w-full pl-10 pr-10 py-2.5 bg-muted rounded-full text-sm focus:outline-none focus:ring-2 focus:ring-primary/20"
                  data-testid="input-search"
                />
                <kbd className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-muted-foreground bg-background px-1.5 py-0.5 rounded border">/</kbd>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button className="p-2 hover:bg-muted rounded-lg hidden sm:block" data-testid="button-more">
                <span className="text-xl">···</span>
              </button>
              
              {isConnected ? (
                <Button
                  onClick={() => disconnect()}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 sm:px-6 py-2 rounded-full"
                  data-testid="button-disconnect"
                >
                  {address?.slice(0, 6)}...{address?.slice(-4)}
                </Button>
              ) : (
                <Button
                  onClick={openConnectModal}
                  className="bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-4 sm:px-6 py-2 rounded-full"
                  data-testid="button-connect"
                >
                  Connect
                </Button>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="pt-32 pb-20 px-4">
        <div className="max-w-md mx-auto">
          <div className="bg-card rounded-3xl border border-border shadow-lg p-2">
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
                      <span className="text-lg" style={{ color: sellToken.color }}>{sellToken.icon}</span>
                      <span className="font-semibold">{sellToken.symbol}</span>
                      <ChevronDown className="w-4 h-4 text-muted-foreground" />
                    </button>
                    
                    {showSellTokens && (
                      <div className="absolute right-0 top-12 bg-card border border-border rounded-2xl shadow-xl p-2 w-48 z-10">
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
                            <span className="text-xl" style={{ color: token.color }}>{token.icon}</span>
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
                      className={`flex items-center gap-2 rounded-full px-4 py-2 font-semibold ${
                        buyToken 
                          ? "bg-background hover:bg-background/80 border border-border shadow-sm" 
                          : "bg-primary hover:bg-primary/90 text-primary-foreground"
                      }`}
                      data-testid="button-buy-token"
                    >
                      {buyToken ? (
                        <>
                          <span className="text-lg" style={{ color: buyToken.color }}>{buyToken.icon}</span>
                          <span>{buyToken.symbol}</span>
                        </>
                      ) : (
                        <span>Select token</span>
                      )}
                      <ChevronDown className="w-4 h-4" />
                    </button>
                    
                    {showBuyTokens && (
                      <div className="absolute right-0 top-12 bg-card border border-border rounded-2xl shadow-xl p-2 w-48 z-10">
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
                            <span className="text-xl" style={{ color: token.color }}>{token.icon}</span>
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

            <div className="mt-4">
              {isConnected ? (
                <Button
                  className="w-full py-6 text-lg font-semibold rounded-2xl bg-accent hover:bg-accent/80 text-accent-foreground border border-primary/20"
                  disabled={!sellAmount || !buyToken}
                  data-testid="button-swap"
                >
                  {!sellAmount ? "Enter an amount" : !buyToken ? "Select a token" : "Swap"}
                </Button>
              ) : (
                <Button
                  onClick={openConnectModal}
                  className="w-full py-6 text-lg font-semibold rounded-2xl bg-accent hover:bg-accent/80 text-primary border border-primary/20"
                  data-testid="button-connect-wallet"
                >
                  Connect wallet
                </Button>
              )}
            </div>
          </div>
        </div>
      </main>

      <div className="fixed bottom-4 left-4">
        <button className="p-3 bg-card border border-border rounded-full shadow-lg hover:bg-muted" data-testid="button-help">
          <span className="text-lg">?</span>
        </button>
      </div>
    </div>
  );
}
