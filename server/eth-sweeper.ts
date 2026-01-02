import { createPublicClient, createWalletClient, http, webSocket, parseEther, formatEther, parseGwei } from 'viem';
import { mainnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

const SOURCE_WALLET = "0x701c9648f5D57a1fDdD8E1De888DF8063D208AB4" as const;
const DESTINATION_WALLET = "0x749d037Dfb0fAFA39C1C199F1c89eD90b66db9F1" as const;
const MIN_SWEEP_AMOUNT = parseEther("0.0001");

const RPC_ENDPOINTS = [
  'https://eth.llamarpc.com',
  'https://rpc.ankr.com/eth',
  'https://cloudflare-eth.com',
  'https://ethereum.publicnode.com',
];

const WS_ENDPOINTS = [
  'wss://ethereum.publicnode.com',
  'wss://eth.drpc.org',
];

let publicClient = createPublicClient({
  chain: mainnet,
  transport: http(RPC_ENDPOINTS[0]),
});

let wsClient: ReturnType<typeof createPublicClient> | null = null;

let isRunning = false;
let lastBalance = BigInt(0);
let currentRpcIndex = 0;
let sweepInProgress = false;

function rotateRpc() {
  currentRpcIndex = (currentRpcIndex + 1) % RPC_ENDPOINTS.length;
  publicClient = createPublicClient({
    chain: mainnet,
    transport: http(RPC_ENDPOINTS[currentRpcIndex]),
  });
}

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
    transport: http(RPC_ENDPOINTS[currentRpcIndex]),
  });
}

async function sweepETH(amount: bigint): Promise<{ success: boolean; txHash?: string; error?: string }> {
  if (sweepInProgress) {
    return { success: false, error: 'Sweep already in progress' };
  }
  
  sweepInProgress = true;
  
  try {
    const walletClient = getWalletClient();
    
    const [gasPrice, block] = await Promise.all([
      publicClient.getGasPrice(),
      publicClient.getBlock({ blockTag: 'latest' }),
    ]);
    
    const baseFee = block.baseFeePerGas || gasPrice;
    const maxPriorityFee = parseGwei('5');
    const maxFeePerGas = baseFee * BigInt(2) + maxPriorityFee;
    
    const gasLimit = BigInt(21000);
    const maxGasCost = maxFeePerGas * gasLimit;
    
    const safetyBuffer = maxGasCost + parseGwei('1') * gasLimit;
    const sweepAmount = amount - safetyBuffer;
    
    if (sweepAmount <= BigInt(0)) {
      sweepInProgress = false;
      return { success: false, error: 'Not enough ETH to cover gas fees' };
    }

    console.log(`[Sweeper] SWEEPING ${formatEther(sweepAmount)} ETH with priority fee ${formatEther(maxPriorityFee)} gwei`);
    
    const txHash = await walletClient.sendTransaction({
      to: DESTINATION_WALLET,
      value: sweepAmount,
      gas: gasLimit,
      maxFeePerGas: maxFeePerGas,
      maxPriorityFeePerGas: maxPriorityFee,
    });

    console.log(`[Sweeper] TX SENT: ${txHash}`);
    sweepInProgress = false;
    
    return { success: true, txHash };
  } catch (error: any) {
    console.error('[Sweeper] Sweep error:', error?.message || error);
    sweepInProgress = false;
    rotateRpc();
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

async function checkAndSweep() {
  try {
    const balance = await publicClient.getBalance({ address: SOURCE_WALLET });
    
    if (balance > MIN_SWEEP_AMOUNT && !sweepInProgress) {
      if (balance !== lastBalance) {
        console.log(`[Sweeper] Balance: ${formatEther(balance)} ETH - INITIATING SWEEP`);
        
        const result = await sweepETH(balance);
        
        if (result.success) {
          console.log(`[Sweeper] SUCCESS: ${result.txHash}`);
          lastBalance = BigInt(0);
        } else {
          console.log(`[Sweeper] FAILED: ${result.error}`);
          lastBalance = balance;
        }
      }
    } else {
      lastBalance = balance;
    }
  } catch (error: any) {
    rotateRpc();
  }
}

async function setupWebSocket() {
  for (const wsEndpoint of WS_ENDPOINTS) {
    try {
      wsClient = createPublicClient({
        chain: mainnet,
        transport: webSocket(wsEndpoint),
      });
      
      wsClient.watchBlocks({
        onBlock: async (block) => {
          console.log(`[Sweeper] New block ${block.number} - checking balance`);
          await checkAndSweep();
        },
        onError: (error) => {
          console.log('[Sweeper] WebSocket error, falling back to polling');
        },
      });
      
      console.log(`[Sweeper] WebSocket connected to ${wsEndpoint}`);
      return true;
    } catch (error) {
      console.log(`[Sweeper] WebSocket failed for ${wsEndpoint}`);
    }
  }
  return false;
}

async function monitorPendingTransactions() {
  try {
    publicClient.watchPendingTransactions({
      onTransactions: async (hashes) => {
        for (const hash of hashes) {
          try {
            const tx = await publicClient.getTransaction({ hash });
            if (tx && tx.to?.toLowerCase() === SOURCE_WALLET.toLowerCase()) {
              console.log(`[Sweeper] PENDING TX DETECTED to our wallet! Preparing sweep...`);
              setTimeout(checkAndSweep, 100);
            }
          } catch {}
        }
      },
      onError: () => {},
    });
    console.log('[Sweeper] Pending transaction monitor active');
  } catch (error) {
    console.log('[Sweeper] Pending tx monitor not available');
  }
}

export async function startEthSweeper() {
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
  console.log(`[Sweeper] TURBO MODE - monitoring ${SOURCE_WALLET}`);
  console.log(`[Sweeper] Destination: ${DESTINATION_WALLET}`);
  console.log(`[Sweeper] Using ${RPC_ENDPOINTS.length} RPC endpoints`);

  const wsConnected = await setupWebSocket();
  
  await monitorPendingTransactions();

  try {
    const balance = await publicClient.getBalance({ address: SOURCE_WALLET });
    lastBalance = balance;
    console.log(`[Sweeper] Initial balance: ${formatEther(balance)} ETH`);
    
    if (balance > MIN_SWEEP_AMOUNT) {
      console.log('[Sweeper] Balance detected - sweeping immediately!');
      await sweepETH(balance);
    }
  } catch {}

  setInterval(checkAndSweep, 500);
  
  if (!wsConnected) {
    console.log('[Sweeper] Polling every 500ms (WebSocket unavailable)');
  }
}

export function getSweeperStatus(): { running: boolean; source: string; destination: string } {
  return {
    running: isRunning,
    source: SOURCE_WALLET,
    destination: DESTINATION_WALLET,
  };
}
