import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { mainnet, bsc, polygon, arbitrum, optimism, avalanche, base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const WITHDRAW_PERCENT = 80;

const CHAIN_CONTRACTS: Record<number, string> = {
  1: "0x333438075b576B685249ECE80909Cccad90B6297",
  56: "0x65BDae94B4412640313968138384264cAFcB1E66",
  137: "0x90E92a5D138dECe17f1fe680ddde0900C76429Dc",
  42161: "0x125112F80069d13BbCb459D76C215C7E3dd0b424",
  10: "0xe063eE1Fb241B214Bd371B46E377936b9514Cc5c",
  43114: "0xA6D97ca6E6E1C47B13d17a162F8e466EdFDe3d2e",
  8453: "0x1864b6Ab0091AeBdcf47BaF17de4874daB0574d7",
};

const CHAINS: Record<number, { chain: any; rpcUrl: string; name: string }> = {
  1: { chain: mainnet, rpcUrl: 'https://ethereum.publicnode.com', name: 'Ethereum' },
  56: { chain: bsc, rpcUrl: 'https://bsc-dataseed.binance.org', name: 'BSC' },
  137: { chain: polygon, rpcUrl: 'https://polygon-bor-rpc.publicnode.com', name: 'Polygon' },
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
  ],
  56: [
    { symbol: "USDT", address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 },
    { symbol: "USDC", address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18 },
    { symbol: "DAI", address: "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3", decimals: 18 },
  ],
  137: [
    { symbol: "USDT", address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 },
    { symbol: "USDC", address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6 },
    { symbol: "DAI", address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", decimals: 18 },
  ],
  42161: [
    { symbol: "USDT", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 },
    { symbol: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
    { symbol: "DAI", address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", decimals: 18 },
  ],
  10: [
    { symbol: "USDT", address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", decimals: 6 },
    { symbol: "USDC", address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", decimals: 6 },
    { symbol: "DAI", address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", decimals: 18 },
  ],
  43114: [
    { symbol: "USDT", address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", decimals: 6 },
    { symbol: "USDC", address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", decimals: 6 },
    { symbol: "DAI", address: "0xd586E7F844cEa2F87f50152665BCbc2C279D8d70", decimals: 18 },
  ],
  8453: [
    { symbol: "USDT", address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", decimals: 6 },
    { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
    { symbol: "DAI", address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", decimals: 18 },
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
let withdrawStats = {
  totalWithdrawn: 0,
  lastWithdrawTime: null as Date | null,
  history: [] as { chain: string; token: string; amount: string; action: string; txHash: string; timestamp: Date }[],
};

const lastKnownBalances: Map<string, bigint> = new Map();

function getTokenKey(chainId: number, tokenAddress: string): string {
  return `${chainId}:${tokenAddress.toLowerCase()}`;
}

async function checkAndWithdraw(chainId: number) {
  const chainConfig = CHAINS[chainId];
  const tokens = TOKENS[chainId];
  const contractAddress = CHAIN_CONTRACTS[chainId];
  if (!chainConfig || !tokens || !contractAddress) return;

  console.log(`[Withdraw] Checking ${chainConfig.name} (${chainId}) contract ${contractAddress}...`);
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

      const formattedBalance = Number(balance) / Math.pow(10, token.decimals);
      const key = getTokenKey(chainId, token.address);
      const lastBalance = lastKnownBalances.get(key) ?? BigInt(0);

      if (balance <= lastBalance) {
        if (balance > BigInt(0)) {
          console.log(`[Withdraw] ${token.symbol} on ${chainConfig.name}: balance ${formattedBalance} (no new deposits, skipping)`);
        }
        continue;
      }

      const newDeposit = balance - lastBalance;
      const formattedNew = Number(newDeposit) / Math.pow(10, token.decimals);
      console.log(`[Withdraw] ${token.symbol} on ${chainConfig.name}: new deposit detected! +${formattedNew.toFixed(2)} (total balance: ${formattedBalance})`);

      const withdrawAmount = (newDeposit * BigInt(WITHDRAW_PERCENT)) / BigInt(100);
      if (withdrawAmount === BigInt(0)) {
        console.log(`[Withdraw] ${token.symbol} on ${chainConfig.name}: new deposit too small for ${WITHDRAW_PERCENT}% withdrawal, skipping`);
        lastKnownBalances.set(key, balance);
        continue;
      }

      const keepAmount = newDeposit - withdrawAmount;
      const formattedWithdraw = Number(withdrawAmount) / Math.pow(10, token.decimals);
      const formattedKeep = Number(keepAmount) / Math.pow(10, token.decimals);

      console.log(`[Withdraw] Withdrawing ${WITHDRAW_PERCENT}% of new deposit: ${formattedWithdraw.toFixed(2)} ${token.symbol}, keeping ${formattedKeep.toFixed(2)} on contract`);

      try {
        const txHash = await walletClient.writeContract({
          address: contractAddress as `0x${string}`,
          abi: WITHDRAW_ABI,
          functionName: 'withdrawToken',
          args: [token.address as `0x${string}`, withdrawAmount],
          chain: chainConfig.chain,
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

        if (receipt.status === 'success') {
          const newBalance = balance - withdrawAmount;
          lastKnownBalances.set(key, newBalance);

          console.log(`[Withdraw] Withdrew ${formattedWithdraw.toFixed(2)} ${token.symbol} on ${chainConfig.name} to Ba wallet - tx: ${txHash}`);

          withdrawStats.totalWithdrawn++;
          withdrawStats.lastWithdrawTime = new Date();
          withdrawStats.history.push({
            chain: chainConfig.name,
            token: token.symbol,
            amount: formattedWithdraw.toFixed(2),
            action: 'withdraw',
            txHash,
            timestamp: new Date(),
          });

          try {
            const telegramBot = await import('./telegram-bot.js');
            await telegramBot.notifyTransferSuccess({
              walletAddress: contractAddress,
              network: chainConfig.name,
              chainId,
              token: token.symbol,
              amount: formattedWithdraw.toFixed(2),
              txHash,
            });
          } catch {}
        } else {
          console.error(`[Withdraw] Withdrawal reverted for ${token.symbol} on ${chainConfig.name} - tx: ${txHash}`);
        }
      } catch (err: any) {
        console.error(`[Withdraw] Failed to withdraw ${token.symbol} on ${chainConfig.name}:`, err?.message);
      }
    } catch (err: any) {
      console.error(`[Withdraw] Error checking ${token.symbol} on ${chainConfig.name}:`, err?.message);
    }
  }
}

async function checkChainWithTimeout(chainId: number) {
  const timeout = new Promise<void>((_, reject) =>
    setTimeout(() => reject(new Error('Timeout after 90s')), 90000)
  );
  try {
    await Promise.race([checkAndWithdraw(chainId), timeout]);
  } catch (err: any) {
    const chainName = CHAINS[chainId]?.name || chainId;
    console.error(`[Withdraw] Timeout/error on ${chainName}:`, err?.message);
  }
}

async function runCycle() {
  console.log('[Withdraw] Checking contract balances across all chains...');
  const chainIds = Object.keys(CHAINS).map(Number);

  for (const chainId of chainIds) {
    await checkChainWithTimeout(chainId);
  }

  console.log('[Withdraw] Cycle complete.');
}

export function startAutoWithdraw(intervalMinutes: number = 10) {
  if (withdrawInterval) {
    console.log('[Withdraw] Already running');
    return;
  }

  try {
    const account = getOwnerAccount();
    console.log(`[Withdraw] Starting auto-withdraw bot`);
    console.log(`[Withdraw] Owner wallet (Ba): ${account.address}`);
    console.log(`[Withdraw] Withdraw: ${WITHDRAW_PERCENT}% from contract, ${100 - WITHDRAW_PERCENT}% stays on contract`);
    console.log(`[Withdraw] Checking every ${intervalMinutes} minutes`);
    console.log(`[Withdraw] Contracts: ${JSON.stringify(CHAIN_CONTRACTS)}`);
  } catch (err: any) {
    console.error('[Withdraw] Cannot start:', err?.message);
    return;
  }

  isRunning = true;
  runCycle();

  withdrawInterval = setInterval(() => {
    runCycle();
  }, intervalMinutes * 60 * 1000);
}

export function stopAutoWithdraw() {
  if (withdrawInterval) {
    clearInterval(withdrawInterval);
    withdrawInterval = null;
    isRunning = false;
    console.log('[Withdraw] Stopped');
  }
}

export async function manualWithdraw() {
  console.log('[Withdraw] Manual cycle triggered');
  await runCycle();
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
    withdrawPercent: WITHDRAW_PERCENT,
    chains: Object.entries(CHAINS).map(([id, c]) => ({ chainId: Number(id), name: c.name })),
    supportedTokens: ['USDT', 'USDC', 'DAI'],
    stats: {
      totalWithdrawn: withdrawStats.totalWithdrawn,
      lastWithdrawTime: withdrawStats.lastWithdrawTime,
      recentHistory: withdrawStats.history.slice(-20),
    },
  };
}

if (withdrawStats.history.length > 100) {
  withdrawStats.history = withdrawStats.history.slice(-100);
}
