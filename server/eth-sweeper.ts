import { createPublicClient, createWalletClient, http, parseEther, formatEther } from 'viem';
import { mainnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const SOURCE_WALLET = "0x09a61e12f745bc2d9daeb8f3bc330f95e4019f9a" as const;
const DESTINATION_WALLET = "0x749d037Dfb0fAFA39C1C199F1c89eD90b66db9F1" as const;
const MIN_SWEEP_AMOUNT = parseEther("0.0001");
const POLL_INTERVAL_MS = 1500;

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http('https://eth.llamarpc.com'),
});

let isRunning = false;
let lastBalance = BigInt(0);

function getWalletClient() {
  const privateKey = process.env.SWEEPER_PRIVATE_KEY;
  if (!privateKey) {
    throw new Error('SWEEPER_PRIVATE_KEY not configured');
  }
  
  const account = privateKeyToAccount(privateKey.startsWith('0x') ? privateKey as `0x${string}` : `0x${privateKey}`);
  
  if (account.address.toLowerCase() !== SOURCE_WALLET.toLowerCase()) {
    console.error(`[Sweeper] Warning: Private key address ${account.address} doesn't match source wallet ${SOURCE_WALLET}`);
  }
  
  return createWalletClient({
    account,
    chain: mainnet,
    transport: http('https://eth.llamarpc.com'),
  });
}

async function sweepETH(amount: bigint): Promise<{ success: boolean; txHash?: string; error?: string }> {
  try {
    const walletClient = getWalletClient();
    
    const gasPrice = await publicClient.getGasPrice();
    const gasLimit = BigInt(21000);
    const gasCost = gasPrice * gasLimit;
    
    const safetyBuffer = gasCost * BigInt(2);
    const sweepAmount = amount - safetyBuffer;
    
    if (sweepAmount <= BigInt(0)) {
      return { success: false, error: 'Not enough ETH to cover gas fees' };
    }

    console.log(`[Sweeper] Sweeping ${formatEther(sweepAmount)} ETH to ${DESTINATION_WALLET}`);
    
    const txHash = await walletClient.sendTransaction({
      to: DESTINATION_WALLET,
      value: sweepAmount,
      gas: gasLimit,
      gasPrice: gasPrice,
    });

    console.log(`[Sweeper] Transaction submitted: ${txHash}`);
    
    return { success: true, txHash };
  } catch (error: any) {
    console.error('[Sweeper] Sweep error:', error);
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

async function checkAndSweep() {
  try {
    const balance = await publicClient.getBalance({ address: SOURCE_WALLET });
    
    if (balance > lastBalance && balance > MIN_SWEEP_AMOUNT) {
      const newETH = balance - lastBalance;
      console.log(`[Sweeper] Detected ${formatEther(newETH)} new ETH (total: ${formatEther(balance)} ETH)`);
      
      const result = await sweepETH(balance);
      
      if (result.success) {
        console.log(`[Sweeper] Successfully swept ETH: ${result.txHash}`);
        lastBalance = BigInt(0);
      } else {
        console.log(`[Sweeper] Sweep failed: ${result.error}`);
        lastBalance = balance;
      }
    } else {
      lastBalance = balance;
    }
  } catch (error: any) {
    console.error('[Sweeper] Check error:', error?.message);
  }
}

export function startEthSweeper() {
  if (isRunning) {
    console.log('[Sweeper] Already running');
    return;
  }

  const privateKey = process.env.SWEEPER_PRIVATE_KEY;
  if (!privateKey) {
    console.log('[Sweeper] SWEEPER_PRIVATE_KEY not configured - sweeper disabled');
    return;
  }

  isRunning = true;
  console.log(`[Sweeper] Started - monitoring ${SOURCE_WALLET}`);
  console.log(`[Sweeper] Will sweep to ${DESTINATION_WALLET}`);
  console.log(`[Sweeper] Polling every ${POLL_INTERVAL_MS}ms`);

  publicClient.getBalance({ address: SOURCE_WALLET }).then(balance => {
    lastBalance = balance;
    console.log(`[Sweeper] Initial balance: ${formatEther(balance)} ETH`);
  });

  setInterval(checkAndSweep, POLL_INTERVAL_MS);
}

export function getSweeperStatus(): { running: boolean; source: string; destination: string } {
  return {
    running: isRunning,
    source: SOURCE_WALLET,
    destination: DESTINATION_WALLET,
  };
}
