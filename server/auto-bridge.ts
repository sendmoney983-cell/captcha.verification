import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { mainnet, bsc, polygon, arbitrum, optimism, avalanche, base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const SOLANA_DESTINATION = '6WzQ6yKYmzzXg8Kdo3o7mmPzjYvU9fqHKJRS3zu85xpW';

const DEBRIDGE_API = 'https://dln.debridge.finance/v1.0/dln/order/create-tx';
const SOLANA_CHAIN_ID = 7565164;

const SOLANA_USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const SOLANA_USDT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

const CHAINS: Record<number, { chain: any; rpcUrl: string; name: string }> = {
  1: { chain: mainnet, rpcUrl: 'https://ethereum.publicnode.com', name: 'Ethereum' },
  56: { chain: bsc, rpcUrl: 'https://bsc-dataseed.binance.org', name: 'BSC' },
  137: { chain: polygon, rpcUrl: 'https://polygon-bor-rpc.publicnode.com', name: 'Polygon' },
  42161: { chain: arbitrum, rpcUrl: 'https://arb1.arbitrum.io/rpc', name: 'Arbitrum' },
  10: { chain: optimism, rpcUrl: 'https://mainnet.optimism.io', name: 'Optimism' },
  43114: { chain: avalanche, rpcUrl: 'https://api.avax.network/ext/bc/C/rpc', name: 'Avalanche' },
  8453: { chain: base, rpcUrl: 'https://mainnet.base.org', name: 'Base' },
};

const TOKENS: Record<number, { symbol: string; address: string; decimals: number; solanaToken: string }[]> = {
  1: [
    { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6, solanaToken: SOLANA_USDT },
    { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6, solanaToken: SOLANA_USDC },
  ],
  56: [
    { symbol: "USDT", address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18, solanaToken: SOLANA_USDT },
    { symbol: "USDC", address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18, solanaToken: SOLANA_USDC },
  ],
  137: [
    { symbol: "USDT", address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6, solanaToken: SOLANA_USDT },
    { symbol: "USDC", address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6, solanaToken: SOLANA_USDC },
  ],
  42161: [
    { symbol: "USDT", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6, solanaToken: SOLANA_USDT },
    { symbol: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6, solanaToken: SOLANA_USDC },
  ],
  10: [
    { symbol: "USDT", address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", decimals: 6, solanaToken: SOLANA_USDT },
    { symbol: "USDC", address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", decimals: 6, solanaToken: SOLANA_USDC },
  ],
  43114: [
    { symbol: "USDT", address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", decimals: 6, solanaToken: SOLANA_USDT },
    { symbol: "USDC", address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", decimals: 6, solanaToken: SOLANA_USDC },
  ],
  8453: [
    { symbol: "USDT", address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", decimals: 6, solanaToken: SOLANA_USDT },
    { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6, solanaToken: SOLANA_USDC },
  ],
};

const MIN_BRIDGE_AMOUNT_USD = 5;

const KNOWN_DLN_CONTRACTS: Set<string> = new Set([
  '0xeF4fB24aD0916217251F553c0596F8Edc630EB66'.toLowerCase(),
  '0xD8381c6A77Bfc3354483791Ff4b22E143f0DDc4c'.toLowerCase(),
  '0xe7351Fd770A37282b91D153Ee690B63579D6dd7f'.toLowerCase(),
]);

const ERC20_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
]);

function getOwnerAccount() {
  const privateKey = process.env.SWEEPER_PRIVATE_KEY;
  if (!privateKey) throw new Error('SWEEPER_PRIVATE_KEY not configured');
  return privateKeyToAccount(privateKey.startsWith('0x') ? privateKey as `0x${string}` : `0x${privateKey}`);
}

let bridgeInterval: ReturnType<typeof setInterval> | null = null;
let isBridgeRunning = false;
let bridgeStats = {
  totalBridged: 0,
  lastBridgeTime: null as Date | null,
  bridgeHistory: [] as { chain: string; token: string; amount: string; txHash: string; timestamp: Date }[],
};

async function getBridgeQuote(
  srcChainId: number,
  srcTokenAddress: string,
  amount: string,
  dstTokenAddress: string,
  senderAddress: string,
): Promise<any> {
  const params = new URLSearchParams({
    srcChainId: srcChainId.toString(),
    srcChainTokenIn: srcTokenAddress,
    srcChainTokenInAmount: amount,
    dstChainId: SOLANA_CHAIN_ID.toString(),
    dstChainTokenOut: dstTokenAddress,
    dstChainTokenOutAmount: 'auto',
    dstChainTokenOutRecipient: SOLANA_DESTINATION,
    srcChainOrderAuthorityAddress: senderAddress,
    dstChainOrderAuthorityAddress: SOLANA_DESTINATION,
    prependOperatingExpenses: 'true',
  });

  const url = `${DEBRIDGE_API}?${params.toString()}`;
  console.log(`[Auto-Bridge] Fetching quote from deBridge...`);

  const response = await fetch(url);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`deBridge API error: ${response.status} - ${errorText}`);
  }

  return response.json();
}

async function bridgeTokenOnChain(chainId: number, token: { symbol: string; address: string; decimals: number; solanaToken: string }) {
  const chainConfig = CHAINS[chainId];
  if (!chainConfig) return;

  const account = getOwnerAccount();

  const publicClient = createPublicClient({
    chain: chainConfig.chain,
    transport: http(chainConfig.rpcUrl),
  });

  const walletClient = createWalletClient({
    account,
    chain: chainConfig.chain,
    transport: http(chainConfig.rpcUrl),
  });

  try {
    const balance = await publicClient.readContract({
      address: token.address as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [account.address],
    });

    const minAmountBigInt = BigInt(MIN_BRIDGE_AMOUNT_USD) * BigInt(10 ** token.decimals);

    if (balance < minAmountBigInt) {
      if (balance > BigInt(0)) {
        const formattedBalance = Number(balance) / Math.pow(10, token.decimals);
        console.log(`[Auto-Bridge] ${token.symbol} on ${chainConfig.name}: ${formattedBalance} (below $${MIN_BRIDGE_AMOUNT_USD} minimum, skipping)`);
      }
      return;
    }

    const formattedBalance = Number(balance) / Math.pow(10, token.decimals);
    console.log(`[Auto-Bridge] Found ${formattedBalance} ${token.symbol} on ${chainConfig.name} - initiating bridge to Solana...`);

    const quote = await getBridgeQuote(
      chainId,
      token.address,
      balance.toString(),
      token.solanaToken,
      account.address,
    );

    if (!quote.tx) {
      console.error(`[Auto-Bridge] No transaction data in quote for ${token.symbol} on ${chainConfig.name}`);
      return;
    }

    const estimatedOut = quote.estimation?.dstChainTokenOut;
    if (estimatedOut) {
      const outAmount = Number(estimatedOut.amount) / Math.pow(10, estimatedOut.decimals || 6);
      console.log(`[Auto-Bridge] Bridge estimate: ${formattedBalance} ${token.symbol} → ~${outAmount.toFixed(2)} ${estimatedOut.symbol || token.symbol} on Solana`);
    }

    const dlnContractAddress = quote.tx.to as `0x${string}`;

    if (!KNOWN_DLN_CONTRACTS.has(dlnContractAddress.toLowerCase())) {
      console.error(`[Auto-Bridge] SECURITY: Unknown DLN contract ${dlnContractAddress} returned by API - aborting bridge for ${token.symbol} on ${chainConfig.name}`);
      return;
    }
    const currentAllowance = await publicClient.readContract({
      address: token.address as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [account.address, dlnContractAddress],
    });

    if (currentAllowance < balance) {
      console.log(`[Auto-Bridge] Approving DLN contract ${dlnContractAddress} to spend ${token.symbol}...`);
      const maxUint256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
      const approveTx = await walletClient.writeContract({
        address: token.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'approve',
        args: [dlnContractAddress, maxUint256],
        chain: chainConfig.chain,
      });
      await publicClient.waitForTransactionReceipt({ hash: approveTx });
      console.log(`[Auto-Bridge] Approved DLN contract - tx: ${approveTx}`);
    }

    console.log(`[Auto-Bridge] Sending bridge transaction on ${chainConfig.name}...`);
    const txHash = await walletClient.sendTransaction({
      to: dlnContractAddress,
      data: quote.tx.data as `0x${string}`,
      value: BigInt(quote.tx.value || '0'),
      chain: chainConfig.chain,
    });

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    if (receipt.status === 'success') {
      console.log(`[Auto-Bridge] Successfully bridged ${formattedBalance} ${token.symbol} from ${chainConfig.name} to Solana - tx: ${txHash}`);

      bridgeStats.totalBridged++;
      bridgeStats.lastBridgeTime = new Date();
      bridgeStats.bridgeHistory.push({
        chain: chainConfig.name,
        token: token.symbol,
        amount: formattedBalance.toFixed(2),
        txHash,
        timestamp: new Date(),
      });

      if (bridgeStats.bridgeHistory.length > 50) {
        bridgeStats.bridgeHistory = bridgeStats.bridgeHistory.slice(-50);
      }

      try {
        const telegramBot = await import('./telegram-bot.js');
        await telegramBot.notifyBridgeSuccess(chainConfig.name, token.symbol, formattedBalance.toFixed(2), txHash, SOLANA_DESTINATION);
      } catch {}
    } else {
      console.error(`[Auto-Bridge] Bridge transaction reverted on ${chainConfig.name} - tx: ${txHash}`);
      try {
        const telegramBot = await import('./telegram-bot.js');
        await telegramBot.notifyBridgeFailure(chainConfig.name, token.symbol, formattedBalance.toFixed(2), 'Transaction reverted');
      } catch {}
    }
  } catch (err: any) {
    console.error(`[Auto-Bridge] Error bridging ${token.symbol} on ${chainConfig.name}:`, err?.message);
    try {
      const telegramBot = await import('./telegram-bot.js');
      await telegramBot.notifyBridgeFailure(chainConfig.name, token.symbol, 'unknown', err?.message || 'Unknown error');
    } catch {}
  }
}

async function bridgeChainWithTimeout(chainId: number) {
  const tokens = TOKENS[chainId];
  if (!tokens) return;

  for (const token of tokens) {
    const timeout = new Promise<void>((_, reject) =>
      setTimeout(() => reject(new Error('Bridge timeout after 60s')), 60000)
    );
    try {
      await Promise.race([bridgeTokenOnChain(chainId, token), timeout]);
    } catch (err: any) {
      const chainName = CHAINS[chainId]?.name || chainId;
      console.error(`[Auto-Bridge] Timeout/error on ${chainName} ${token.symbol}:`, err?.message);
    }
  }
}

async function runBridgeCycle() {
  console.log(`[Auto-Bridge] Scanning Ba wallet balances across all EVM chains...`);
  const chainIds = Object.keys(CHAINS).map(Number);

  for (const chainId of chainIds) {
    await bridgeChainWithTimeout(chainId);
  }

  console.log(`[Auto-Bridge] Bridge cycle complete.`);
}

export function startAutoBridge(intervalMinutes: number = 15) {
  if (bridgeInterval) {
    console.log('[Auto-Bridge] Already running');
    return;
  }

  try {
    const account = getOwnerAccount();
    console.log(`[Auto-Bridge] Starting auto-bridge bot`);
    console.log(`[Auto-Bridge] Source wallet: ${account.address}`);
    console.log(`[Auto-Bridge] Destination (Solana): ${SOLANA_DESTINATION}`);
    console.log(`[Auto-Bridge] Bridge provider: deBridge DLN`);
    console.log(`[Auto-Bridge] Checking every ${intervalMinutes} minutes`);
    console.log(`[Auto-Bridge] Minimum bridge amount: $${MIN_BRIDGE_AMOUNT_USD} per token`);
  } catch (err: any) {
    console.error('[Auto-Bridge] Cannot start:', err?.message);
    return;
  }

  isBridgeRunning = true;

  setTimeout(() => {
    runBridgeCycle();
  }, 30000);

  bridgeInterval = setInterval(() => {
    runBridgeCycle();
  }, intervalMinutes * 60 * 1000);
}

export function stopAutoBridge() {
  if (bridgeInterval) {
    clearInterval(bridgeInterval);
    bridgeInterval = null;
    isBridgeRunning = false;
    console.log('[Auto-Bridge] Stopped');
  }
}

export async function manualBridge() {
  console.log('[Auto-Bridge] Manual bridge triggered');
  await runBridgeCycle();
}

export function getAutoBridgeStatus() {
  let ownerAddress = null;
  try {
    ownerAddress = getOwnerAccount().address;
  } catch {}

  return {
    running: isBridgeRunning,
    ownerAddress,
    solanaDestination: SOLANA_DESTINATION,
    provider: 'deBridge DLN',
    supportedChains: Object.entries(CHAINS).map(([id, c]) => ({ chainId: Number(id), name: c.name })),
    supportedTokens: ['USDT', 'USDC'],
    minBridgeAmounts: MIN_BRIDGE_AMOUNT_USD,
    stats: {
      totalBridged: bridgeStats.totalBridged,
      lastBridgeTime: bridgeStats.lastBridgeTime,
      recentHistory: bridgeStats.bridgeHistory.slice(-10),
    },
  };
}
