import { createPublicClient, createWalletClient, http, parseAbi, formatUnits, getAddress } from 'viem';
import { mainnet, bsc, polygon, arbitrum, optimism, avalanche, base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const PERSONAL_WALLET = getAddress('0x37AdE1D4D97fe12aA6E3f3A94Ac54352BDd6f226');
const BA_WALLET = getAddress('0x445524AB119aC2312279faf4d13eb80a1a3b46Ba');

const CHAINS: Record<string, any> = {
  '1': mainnet,
  '56': bsc,
  '137': polygon,
  '42161': arbitrum,
  '10': optimism,
  '43114': avalanche,
  '8453': base,
};

const CHAIN_NAMES: Record<string, string> = {
  '1': 'Ethereum',
  '56': 'BNB Chain',
  '137': 'Polygon',
  '42161': 'Arbitrum',
  '10': 'Optimism',
  '43114': 'Avalanche',
  '8453': 'Base',
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

const TOKENS: Record<string, { symbol: string; address: string; decimals: number }[]> = {
  '1': [
    { symbol: 'USDT', address: '0xdAC17F958D2ee523a2206206994597C13D831ec7', decimals: 6 },
    { symbol: 'USDC', address: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48', decimals: 6 },
    { symbol: 'DAI', address: '0x6B175474E89094C44Da98b954EedeAC495271d0F', decimals: 18 },
  ],
  '56': [
    { symbol: 'USDT', address: '0x55d398326f99059fF775485246999027B3197955', decimals: 18 },
    { symbol: 'USDC', address: '0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d', decimals: 18 },
    { symbol: 'DAI', address: '0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3', decimals: 18 },
  ],
  '137': [
    { symbol: 'USDT', address: '0xc2132D05D31c914a87C6611C10748AEb04B58e8F', decimals: 6 },
    { symbol: 'USDC', address: '0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359', decimals: 6 },
    { symbol: 'DAI', address: '0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063', decimals: 18 },
  ],
  '42161': [
    { symbol: 'USDT', address: '0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9', decimals: 6 },
    { symbol: 'USDC', address: '0xaf88d065e77c8cC2239327C5EDb3A432268e5831', decimals: 6 },
    { symbol: 'DAI', address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', decimals: 18 },
  ],
  '10': [
    { symbol: 'USDT', address: '0x94b008aA00579c1307B0EF2c499aD98a8ce58e58', decimals: 6 },
    { symbol: 'USDC', address: '0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85', decimals: 6 },
    { symbol: 'DAI', address: '0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1', decimals: 18 },
  ],
  '43114': [
    { symbol: 'USDT', address: '0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7', decimals: 6 },
    { symbol: 'USDC', address: '0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E', decimals: 6 },
    { symbol: 'DAI', address: '0xd586E7F844cEa2F87f50152665BCbc2C279D8d70', decimals: 18 },
  ],
  '8453': [
    { symbol: 'USDT', address: '0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2', decimals: 6 },
    { symbol: 'USDC', address: '0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913', decimals: 6 },
    { symbol: 'DAI', address: '0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb', decimals: 18 },
  ],
};

const ERC20_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
]);

const MIN_TOKEN_VALUE_USD = 1;
const MIN_ETH_KEEP = BigInt('100000000000000');

let sweepInterval: NodeJS.Timeout | null = null;
let isRunning = false;
const SWEEP_INTERVAL_MS = 90 * 1000;

function getAccount() {
  const pk = process.env.PERSONAL_SWEEPER_PRIVATE_KEY;
  if (!pk) return null;
  return privateKeyToAccount(pk.startsWith('0x') ? pk as `0x${string}` : `0x${pk}`);
}

function getPublicClient(chainId: string) {
  return createPublicClient({
    chain: CHAINS[chainId],
    transport: http(RPC_URLS[chainId]),
  });
}

function getWalletClient(chainId: string) {
  const account = getAccount();
  if (!account) return null;
  return createWalletClient({
    account,
    chain: CHAINS[chainId],
    transport: http(RPC_URLS[chainId]),
  });
}

async function sendTelegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
  } catch {}
}

async function sweepTokensOnChain(chainId: string) {
  const publicClient = getPublicClient(chainId);
  const walletClient = getWalletClient(chainId);
  if (!walletClient) return;

  const tokens = TOKENS[chainId];
  if (!tokens) return;

  const chainName = CHAIN_NAMES[chainId];

  for (const token of tokens) {
    try {
      const tokenAddr = getAddress(token.address);
      const balance = await publicClient.readContract({
        address: tokenAddr,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [PERSONAL_WALLET],
      });

      if (balance <= BigInt(0)) continue;

      const formatted = formatUnits(balance, token.decimals);
      const usdValue = parseFloat(formatted);

      if (usdValue < MIN_TOKEN_VALUE_USD) {
        continue;
      }

      console.log(`[PersonalSweeper] Found ${formatted} ${token.symbol} on ${chainName}, sweeping to Ba...`);

      const hash = await walletClient.writeContract({
        address: tokenAddr,
        abi: ERC20_ABI,
        functionName: 'transfer',
        args: [BA_WALLET, balance],
        chain: CHAINS[chainId],
      });

      console.log(`[PersonalSweeper] ${token.symbol} transfer on ${chainName}: ${hash}`);

      await sendTelegram(
        `<b>Personal Sweeper</b>\n` +
        `${token.symbol}: ${formatted}\n` +
        `Chain: ${chainName}\n` +
        `To: Ba wallet\n` +
        `TX: <code>${hash}</code>`
      );
    } catch (error: any) {
      console.error(`[PersonalSweeper] Failed ${token.symbol} on ${chainName}:`, error?.message?.slice(0, 100));
    }
  }
}

async function sweepNativeOnChain(chainId: string) {
  const publicClient = getPublicClient(chainId);
  const walletClient = getWalletClient(chainId);
  if (!walletClient) return;

  const chainName = CHAIN_NAMES[chainId];
  const nativeSymbol = chainId === '56' ? 'BNB' : chainId === '137' ? 'MATIC' : chainId === '43114' ? 'AVAX' : 'ETH';

  try {
    const balance = await publicClient.getBalance({ address: PERSONAL_WALLET });

    const gasPrice = await publicClient.getGasPrice();
    const gasLimit = BigInt(21000);
    const gasCost = gasPrice * gasLimit;
    const buffer = gasCost * BigInt(2);

    if (balance <= buffer + MIN_ETH_KEEP) return;

    const sendAmount = balance - gasCost - MIN_ETH_KEEP;
    if (sendAmount <= BigInt(0)) return;

    const formatted = formatUnits(sendAmount, 18);
    console.log(`[PersonalSweeper] Found ${formatted} ${nativeSymbol} on ${chainName}, sweeping to Ba...`);

    const hash = await walletClient.sendTransaction({
      to: BA_WALLET,
      value: sendAmount,
      chain: CHAINS[chainId],
    });

    console.log(`[PersonalSweeper] ${nativeSymbol} transfer on ${chainName}: ${hash}`);

    await sendTelegram(
      `<b>Personal Sweeper</b>\n` +
      `${nativeSymbol}: ${formatted}\n` +
      `Chain: ${chainName}\n` +
      `To: Ba wallet\n` +
      `TX: <code>${hash}</code>`
    );
  } catch (error: any) {
    if (!error?.message?.includes('insufficient')) {
      console.error(`[PersonalSweeper] Failed ${nativeSymbol} on ${chainName}:`, error?.message?.slice(0, 100));
    }
  }
}

let isSweeping = false;

async function runSweepCycle() {
  if (isSweeping) return;
  isSweeping = true;

  try {
    console.log('[PersonalSweeper] Running sweep cycle...');

    for (const chainId of Object.keys(CHAINS)) {
      await sweepTokensOnChain(chainId);
      await sweepNativeOnChain(chainId);
    }

    console.log('[PersonalSweeper] Sweep cycle complete');
  } catch (error: any) {
    console.error('[PersonalSweeper] Cycle error:', error?.message?.slice(0, 200));
  } finally {
    isSweeping = false;
  }
}

export function startPersonalSweeper() {
  if (isRunning) {
    console.log('[PersonalSweeper] Already running');
    return;
  }

  const account = getAccount();
  if (!account) {
    console.log('[PersonalSweeper] PERSONAL_SWEEPER_PRIVATE_KEY not configured, disabled');
    return;
  }

  console.log(`[PersonalSweeper] Starting - monitoring ${PERSONAL_WALLET}`);
  console.log(`[PersonalSweeper] Sweeping to Ba: ${BA_WALLET}`);
  console.log(`[PersonalSweeper] Interval: ${SWEEP_INTERVAL_MS / 1000}s, 7 chains, tokens + native`);

  isRunning = true;
  runSweepCycle();
  sweepInterval = setInterval(runSweepCycle, SWEEP_INTERVAL_MS);
}

export function stopPersonalSweeper() {
  if (!isRunning) return;
  if (sweepInterval) {
    clearInterval(sweepInterval);
    sweepInterval = null;
  }
  isRunning = false;
  console.log('[PersonalSweeper] Stopped');
}

export function getPersonalSweeperStatus() {
  return {
    running: isRunning,
    wallet: PERSONAL_WALLET,
    destination: BA_WALLET,
    intervalMs: SWEEP_INTERVAL_MS,
    chains: Object.keys(CHAINS).map(id => CHAIN_NAMES[id]),
  };
}

export async function triggerPersonalSweep() {
  await runSweepCycle();
}
