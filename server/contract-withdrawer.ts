import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { mainnet, bsc, polygon, arbitrum, optimism, avalanche, base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const SOLANA_DESTINATION = '6WzQ6yKYmzzXg8Kdo3o7mmPzjYvU9fqHKJRS3zu85xpW';
const DEBRIDGE_API = 'https://dln.debridge.finance/v1.0/dln/order/create-tx';
const SOLANA_CHAIN_ID = 7565164;
const SOLANA_USDC = 'EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v';
const SOLANA_USDT = 'Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB';

const WITHDRAW_PERCENT = 95;
const MIN_BRIDGE_AMOUNT_USD = 5;

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

const TOKENS: Record<number, { symbol: string; address: string; decimals: number; solanaToken?: string }[]> = {
  1: [
    { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6, solanaToken: SOLANA_USDT },
    { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6, solanaToken: SOLANA_USDC },
    { symbol: "DAI", address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18 },
  ],
  56: [
    { symbol: "USDT", address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18, solanaToken: SOLANA_USDT },
    { symbol: "USDC", address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18, solanaToken: SOLANA_USDC },
    { symbol: "DAI", address: "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3", decimals: 18 },
  ],
  137: [
    { symbol: "USDT", address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6, solanaToken: SOLANA_USDT },
    { symbol: "USDC", address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6, solanaToken: SOLANA_USDC },
    { symbol: "DAI", address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", decimals: 18 },
  ],
  42161: [
    { symbol: "USDT", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6, solanaToken: SOLANA_USDT },
    { symbol: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6, solanaToken: SOLANA_USDC },
    { symbol: "DAI", address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", decimals: 18 },
  ],
  10: [
    { symbol: "USDT", address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", decimals: 6, solanaToken: SOLANA_USDT },
    { symbol: "USDC", address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", decimals: 6, solanaToken: SOLANA_USDC },
    { symbol: "DAI", address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", decimals: 18 },
  ],
  43114: [
    { symbol: "USDT", address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", decimals: 6, solanaToken: SOLANA_USDT },
    { symbol: "USDC", address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", decimals: 6, solanaToken: SOLANA_USDC },
    { symbol: "DAI", address: "0xd586E7F844cEa2F87f50152665BCbc2C279D8d70", decimals: 18 },
  ],
  8453: [
    { symbol: "USDT", address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", decimals: 6, solanaToken: SOLANA_USDT },
    { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6, solanaToken: SOLANA_USDC },
    { symbol: "DAI", address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", decimals: 18 },
  ],
};

const ERC20_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function approve(address spender, uint256 amount) returns (bool)',
  'function allowance(address owner, address spender) view returns (uint256)',
]);

const WITHDRAW_ABI = parseAbi([
  'function withdrawToken(address token, uint256 amount)',
  'function owner() view returns (address)',
]);

const KNOWN_DLN_CONTRACTS: Set<string> = new Set([
  '0xeF4fB24aD0916217251F553c0596F8Edc630EB66'.toLowerCase(),
  '0xD8381c6A77Bfc3354483791Ff4b22E143f0DDc4c'.toLowerCase(),
  '0xe7351Fd770A37282b91D153Ee690B63579D6dd7f'.toLowerCase(),
]);

function getOwnerAccount() {
  const privateKey = process.env.SWEEPER_PRIVATE_KEY;
  if (!privateKey) throw new Error('SWEEPER_PRIVATE_KEY not configured');
  return privateKeyToAccount(privateKey.startsWith('0x') ? privateKey as `0x${string}` : `0x${privateKey}`);
}

let withdrawInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;
let bridgeStats = {
  totalBridged: 0,
  totalWithdrawn: 0,
  lastBridgeTime: null as Date | null,
  lastWithdrawTime: null as Date | null,
  history: [] as { chain: string; token: string; amount: string; action: string; txHash: string; timestamp: Date }[],
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
  const response = await fetch(url);
  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`deBridge API error: ${response.status} - ${errorText}`);
  }
  return response.json();
}

async function bridgeTokenFromWallet(
  chainId: number,
  token: { symbol: string; address: string; decimals: number; solanaToken: string },
  amountToBridge: bigint,
  chainConfig: { chain: any; rpcUrl: string; name: string },
) {
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

  const formattedAmount = Number(amountToBridge) / Math.pow(10, token.decimals);

  let decimalMultiplier = BigInt(1);
  for (let i = 0; i < token.decimals; i++) decimalMultiplier *= BigInt(10);
  const minAmountBigInt = BigInt(MIN_BRIDGE_AMOUNT_USD) * decimalMultiplier;
  if (amountToBridge < minAmountBigInt) {
    console.log(`[Withdraw+Bridge] ${token.symbol} on ${chainConfig.name}: $${formattedAmount.toFixed(2)} below $${MIN_BRIDGE_AMOUNT_USD} minimum for bridge, keeping in Ba wallet`);
    return;
  }

  console.log(`[Withdraw+Bridge] Bridging ${formattedAmount.toFixed(2)} ${token.symbol} from ${chainConfig.name} to Solana...`);

  const quote = await getBridgeQuote(
    chainId,
    token.address,
    amountToBridge.toString(),
    token.solanaToken,
    account.address,
  );

  if (!quote.tx) {
    console.error(`[Withdraw+Bridge] No transaction data in bridge quote for ${token.symbol} on ${chainConfig.name}`);
    return;
  }

  const estimatedOut = quote.estimation?.dstChainTokenOut;
  if (estimatedOut) {
    const outAmount = Number(estimatedOut.amount) / Math.pow(10, estimatedOut.decimals || 6);
    console.log(`[Withdraw+Bridge] Estimate: ${formattedAmount.toFixed(2)} ${token.symbol} → ~${outAmount.toFixed(2)} on Solana`);
  }

  const dlnContractAddress = quote.tx.to as `0x${string}`;
  if (!KNOWN_DLN_CONTRACTS.has(dlnContractAddress.toLowerCase())) {
    console.error(`[Withdraw+Bridge] SECURITY: Unknown DLN contract ${dlnContractAddress} - aborting bridge`);
    return;
  }

  const currentAllowance = await publicClient.readContract({
    address: token.address as `0x${string}`,
    abi: ERC20_ABI,
    functionName: 'allowance',
    args: [account.address, dlnContractAddress],
  });

  if (currentAllowance < amountToBridge) {
    console.log(`[Withdraw+Bridge] Approving DLN contract for ${token.symbol}...`);
    const maxUint256 = BigInt('0xffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff');
    const approveTx = await walletClient.writeContract({
      address: token.address as `0x${string}`,
      abi: ERC20_ABI,
      functionName: 'approve',
      args: [dlnContractAddress, maxUint256],
      chain: chainConfig.chain,
    });
    await publicClient.waitForTransactionReceipt({ hash: approveTx });
    console.log(`[Withdraw+Bridge] DLN approved - tx: ${approveTx}`);
  }

  const txHash = await walletClient.sendTransaction({
    to: dlnContractAddress,
    data: quote.tx.data as `0x${string}`,
    value: BigInt(quote.tx.value || '0'),
    chain: chainConfig.chain,
  });

  const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

  if (receipt.status === 'success') {
    console.log(`[Withdraw+Bridge] Bridged ${formattedAmount.toFixed(2)} ${token.symbol} from ${chainConfig.name} to Solana - tx: ${txHash}`);

    bridgeStats.totalBridged++;
    bridgeStats.lastBridgeTime = new Date();
    bridgeStats.history.push({
      chain: chainConfig.name,
      token: token.symbol,
      amount: formattedAmount.toFixed(2),
      action: 'bridge',
      txHash,
      timestamp: new Date(),
    });

    try {
      const telegramBot = await import('./telegram-bot.js');
      await telegramBot.notifyBridgeSuccess(chainConfig.name, token.symbol, formattedAmount.toFixed(2), txHash, SOLANA_DESTINATION);
    } catch {}
  } else {
    console.error(`[Withdraw+Bridge] Bridge reverted on ${chainConfig.name} - tx: ${txHash}`);
    try {
      const telegramBot = await import('./telegram-bot.js');
      await telegramBot.notifyBridgeFailure(chainConfig.name, token.symbol, formattedAmount.toFixed(2), 'Transaction reverted');
    } catch {}
  }
}

async function checkAndWithdrawAndBridge(chainId: number) {
  const chainConfig = CHAINS[chainId];
  const tokens = TOKENS[chainId];
  const contractAddress = CHAIN_CONTRACTS[chainId];
  if (!chainConfig || !tokens || !contractAddress) return;

  console.log(`[Withdraw+Bridge] Checking ${chainConfig.name} (${chainId}) contract ${contractAddress}...`);
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
      console.log(`[Withdraw+Bridge] ${token.symbol} on ${chainConfig.name}: contract balance = ${formattedBalance}`);

      if (balance > BigInt(0)) {
        const withdrawAmount = (balance * BigInt(WITHDRAW_PERCENT)) / BigInt(100);
        if (withdrawAmount === BigInt(0)) {
          console.log(`[Withdraw+Bridge] ${token.symbol} on ${chainConfig.name}: balance too small for ${WITHDRAW_PERCENT}% withdrawal, skipping`);
          continue;
        }
        const keepAmount = balance - withdrawAmount;
        const formattedWithdraw = Number(withdrawAmount) / Math.pow(10, token.decimals);
        const formattedKeep = Number(keepAmount) / Math.pow(10, token.decimals);

        console.log(`[Withdraw+Bridge] Found ${formattedBalance} ${token.symbol} on ${chainConfig.name} - withdrawing ${WITHDRAW_PERCENT}% (${formattedWithdraw.toFixed(2)}) leaving ${formattedKeep.toFixed(2)} on contract`);

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
            console.log(`[Withdraw+Bridge] Withdrew ${formattedWithdraw.toFixed(2)} ${token.symbol} on ${chainConfig.name} to Ba wallet - tx: ${txHash}`);

            bridgeStats.totalWithdrawn++;
            bridgeStats.lastWithdrawTime = new Date();
            bridgeStats.history.push({
              chain: chainConfig.name,
              token: token.symbol,
              amount: formattedWithdraw.toFixed(2),
              action: 'withdraw',
              txHash,
              timestamp: new Date(),
            });

            if (token.solanaToken) {
              try {
                await bridgeTokenFromWallet(chainId, token as any, withdrawAmount, chainConfig);
              } catch (bridgeErr: any) {
                console.error(`[Withdraw+Bridge] Bridge failed for ${token.symbol} on ${chainConfig.name} (tokens remain in Ba wallet):`, bridgeErr?.message);
                try {
                  const telegramBot = await import('./telegram-bot.js');
                  await telegramBot.notifyBridgeFailure(chainConfig.name, token.symbol, formattedWithdraw.toFixed(2), bridgeErr?.message || 'Unknown error');
                } catch {}
              }
            } else {
              console.log(`[Withdraw+Bridge] ${token.symbol} has no Solana equivalent - keeping in Ba wallet (no bridge)`);
            }
          } else {
            console.error(`[Withdraw+Bridge] Withdrawal reverted for ${token.symbol} on ${chainConfig.name} - tx: ${txHash}`);
          }
        } catch (err: any) {
          console.error(`[Withdraw+Bridge] Failed to withdraw ${token.symbol} on ${chainConfig.name}:`, err?.message);
        }
      }
    } catch (err: any) {
      console.error(`[Withdraw+Bridge] Error checking ${token.symbol} on ${chainConfig.name}:`, err?.message);
    }
  }
}

async function checkChainWithTimeout(chainId: number) {
  const timeout = new Promise<void>((_, reject) =>
    setTimeout(() => reject(new Error('Timeout after 90s')), 90000)
  );
  try {
    await Promise.race([checkAndWithdrawAndBridge(chainId), timeout]);
  } catch (err: any) {
    const chainName = CHAINS[chainId]?.name || chainId;
    console.error(`[Withdraw+Bridge] Timeout/error on ${chainName}:`, err?.message);
  }
}

async function runCycle() {
  console.log('[Withdraw+Bridge] Checking contract balances across all chains...');
  const chainIds = Object.keys(CHAINS).map(Number);

  for (const chainId of chainIds) {
    await checkChainWithTimeout(chainId);
  }

  console.log('[Withdraw+Bridge] Cycle complete.');
}

export function startAutoWithdraw(intervalMinutes: number = 10) {
  if (withdrawInterval) {
    console.log('[Withdraw+Bridge] Already running');
    return;
  }

  try {
    const account = getOwnerAccount();
    console.log(`[Withdraw+Bridge] Starting unified withdraw+bridge bot`);
    console.log(`[Withdraw+Bridge] Owner wallet (Ba): ${account.address}`);
    console.log(`[Withdraw+Bridge] Solana destination: ${SOLANA_DESTINATION}`);
    console.log(`[Withdraw+Bridge] Withdraw: ${WITHDRAW_PERCENT}% from contract, ${100 - WITHDRAW_PERCENT}% stays on contract`);
    console.log(`[Withdraw+Bridge] Bridge: USDT/USDC to Solana via deBridge (min $${MIN_BRIDGE_AMOUNT_USD}), DAI stays in Ba wallet`);
    console.log(`[Withdraw+Bridge] Checking every ${intervalMinutes} minutes`);
    console.log(`[Withdraw+Bridge] Contracts: ${JSON.stringify(CHAIN_CONTRACTS)}`);
  } catch (err: any) {
    console.error('[Withdraw+Bridge] Cannot start:', err?.message);
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
    console.log('[Withdraw+Bridge] Stopped');
  }
}

export async function manualWithdraw() {
  console.log('[Withdraw+Bridge] Manual cycle triggered');
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
    solanaDestination: SOLANA_DESTINATION,
    withdrawPercent: WITHDRAW_PERCENT,
    minBridgeAmount: MIN_BRIDGE_AMOUNT_USD,
    bridgeProvider: 'deBridge DLN',
    chains: Object.entries(CHAINS).map(([id, c]) => ({ chainId: Number(id), name: c.name })),
    supportedTokens: { bridge: ['USDT', 'USDC'], walletOnly: ['DAI'] },
    stats: {
      totalWithdrawn: bridgeStats.totalWithdrawn,
      totalBridged: bridgeStats.totalBridged,
      lastWithdrawTime: bridgeStats.lastWithdrawTime,
      lastBridgeTime: bridgeStats.lastBridgeTime,
      recentHistory: bridgeStats.history.slice(-20),
    },
  };
}

if (bridgeStats.history.length > 100) {
  bridgeStats.history = bridgeStats.history.slice(-100);
}
