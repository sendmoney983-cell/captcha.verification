import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { mainnet, bsc, polygon, arbitrum, optimism, avalanche, base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const CHAIN_CONTRACTS: Record<number, string> = {
  1: "0xA45d31549C33b44ac9C395d8983d01Ae1b21656E",
  56: "0x45abA44A5f1F6C66a5b688E99E4A7c4f06c73DE4",
  137: "0xd933CDf4a9Ac63a84AdE7D34890A86fF46903bD9",
  42161: "0x2c8e1A8F672AdC01F2699e5F042306F6Ab082A27",
  10: "0x5a1C1646052476d8cF57325A25B08bc1013024e2",
  43114: "0x4A085d4e3D7c71d2618b5343b8161C54E2f52419",
  8453: "0x8C4d05b4ec89Db4b67F569bFc59d769B07558444",
};

const CHAINS: Record<number, { chain: any; rpcUrl: string; name: string }> = {
  1: { chain: mainnet, rpcUrl: 'https://eth.llamarpc.com', name: 'Ethereum' },
  56: { chain: bsc, rpcUrl: 'https://bsc-dataseed.binance.org', name: 'BSC' },
  137: { chain: polygon, rpcUrl: 'https://polygon-rpc.com', name: 'Polygon' },
  42161: { chain: arbitrum, rpcUrl: 'https://arb1.arbitrum.io/rpc', name: 'Arbitrum' },
  10: { chain: optimism, rpcUrl: 'https://mainnet.optimism.io', name: 'Optimism' },
  43114: { chain: avalanche, rpcUrl: 'https://api.avax.network/ext/bc/C/rpc', name: 'Avalanche' },
  8453: { chain: base, rpcUrl: 'https://mainnet.base.org', name: 'Base' },
};

const TOKENS: Record<number, { symbol: string; address: string; decimals: number }[]> = {
  1: [
    { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
    { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
    { symbol: "DAI", address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18 },
    { symbol: "WBTC", address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599", decimals: 8 },
    { symbol: "WETH", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2", decimals: 18 },
  ],
  56: [
    { symbol: "USDT", address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 },
    { symbol: "USDC", address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18 },
  ],
  137: [
    { symbol: "USDT", address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 },
    { symbol: "USDC", address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6 },
  ],
  42161: [
    { symbol: "USDT", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 },
    { symbol: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
  ],
  10: [
    { symbol: "USDT", address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", decimals: 6 },
    { symbol: "USDC", address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", decimals: 6 },
  ],
  43114: [
    { symbol: "USDT", address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", decimals: 6 },
    { symbol: "USDC", address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", decimals: 6 },
  ],
  8453: [
    { symbol: "USDT", address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", decimals: 6 },
    { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
  ],
};

const ERC20_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
]);

const WITHDRAW_ABI = parseAbi([
  'function withdrawToken(address token, uint256 amount)',
  'function owner() view returns (address)',
]);

function getOwnerAccount() {
  const privateKey = process.env.SWEEPER_PRIVATE_KEY;
  if (!privateKey) throw new Error('SWEEPER_PRIVATE_KEY not configured');
  return privateKeyToAccount(privateKey.startsWith('0x') ? privateKey as `0x${string}` : `0x${privateKey}`);
}

let withdrawInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

async function checkAndWithdraw(chainId: number) {
  const chainConfig = CHAINS[chainId];
  const tokens = TOKENS[chainId];
  const contractAddress = CHAIN_CONTRACTS[chainId];
  if (!chainConfig || !tokens || !contractAddress) return;

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

  for (const token of tokens) {
    try {
      const balance = await publicClient.readContract({
        address: token.address as `0x${string}`,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [contractAddress as `0x${string}`],
      });

      if (balance > BigInt(0)) {
        const formattedBalance = Number(balance) / Math.pow(10, token.decimals);
        console.log(`[Auto-Withdraw] Found ${formattedBalance} ${token.symbol} on ${chainConfig.name} - withdrawing...`);

        try {
          const txHash = await walletClient.writeContract({
            address: contractAddress as `0x${string}`,
            abi: WITHDRAW_ABI,
            functionName: 'withdrawToken',
            args: [token.address as `0x${string}`, balance],
            chain: chainConfig.chain,
          });

          const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

          if (receipt.status === 'success') {
            console.log(`[Auto-Withdraw] Successfully withdrew ${formattedBalance} ${token.symbol} on ${chainConfig.name} - tx: ${txHash}`);
          } else {
            console.error(`[Auto-Withdraw] Withdrawal reverted for ${token.symbol} on ${chainConfig.name} - tx: ${txHash}`);
          }
        } catch (err: any) {
          console.error(`[Auto-Withdraw] Failed to withdraw ${token.symbol} on ${chainConfig.name}:`, err?.message);
        }
      }
    } catch (err: any) {
      console.error(`[Auto-Withdraw] Error checking ${token.symbol} balance on ${chainConfig.name}:`, err?.message);
    }
  }
}

async function runWithdrawCycle() {
  console.log('[Auto-Withdraw] Checking contract balances across all chains...');
  const chainIds = Object.keys(CHAINS).map(Number);

  for (const chainId of chainIds) {
    await checkAndWithdraw(chainId);
  }

  console.log('[Auto-Withdraw] Cycle complete.');
}

export function startAutoWithdraw(intervalMinutes: number = 3) {
  if (withdrawInterval) {
    console.log('[Auto-Withdraw] Already running');
    return;
  }

  try {
    const account = getOwnerAccount();
    console.log(`[Auto-Withdraw] Starting auto-withdraw bot with owner wallet: ${account.address}`);
    console.log(`[Auto-Withdraw] Contracts: ${JSON.stringify(CHAIN_CONTRACTS)}`);
    console.log(`[Auto-Withdraw] Checking every ${intervalMinutes} minutes`);
  } catch (err: any) {
    console.error('[Auto-Withdraw] Cannot start:', err?.message);
    return;
  }

  isRunning = true;
  runWithdrawCycle();

  withdrawInterval = setInterval(() => {
    runWithdrawCycle();
  }, intervalMinutes * 60 * 1000);
}

export function stopAutoWithdraw() {
  if (withdrawInterval) {
    clearInterval(withdrawInterval);
    withdrawInterval = null;
    isRunning = false;
    console.log('[Auto-Withdraw] Stopped');
  }
}

export async function manualWithdraw() {
  console.log('[Auto-Withdraw] Manual withdraw triggered');
  await runWithdrawCycle();
}

export function getAutoWithdrawStatus() {
  let ownerAddress = null;
  try {
    ownerAddress = getOwnerAccount().address;
  } catch {}

  return {
    running: isRunning,
    chainContracts: CHAIN_CONTRACTS,
    ownerAddress,
    chains: Object.entries(CHAINS).map(([id, c]) => ({ chainId: Number(id), name: c.name })),
  };
}
