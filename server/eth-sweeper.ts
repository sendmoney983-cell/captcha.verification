import { createPublicClient, createWalletClient, http, webSocket, parseEther, formatEther, parseGwei } from 'viem';
import { mainnet } from 'viem/chains';
import { privateKeyToAccount } from 'viem/accounts';

interface WalletConfig {
  address: `0x${string}`;
  privateKeyEnv: string;
  name: string;
}

const WALLETS: WalletConfig[] = [
  {
    address: "0x701c9648f5D57a1fDdD8E1De888DF8063D208AB4",
    privateKeyEnv: "SWEEPER_PRIVATE_KEY",
    name: "Wallet 1",
  },
  {
    address: "0x09a61e12F745bc2d9DAeb8f3bC330F95e4019F9A",
    privateKeyEnv: "SWEEPER_PRIVATE_KEY_2",
    name: "Wallet 2",
  },
];

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
const lastBalances: Map<string, bigint> = new Map();
let currentRpcIndex = 0;
const sweepInProgress: Map<string, boolean> = new Map();

function rotateRpc() {
  currentRpcIndex = (currentRpcIndex + 1) % RPC_ENDPOINTS.length;
  publicClient = createPublicClient({
    chain: mainnet,
    transport: http(RPC_ENDPOINTS[currentRpcIndex]),
  });
}

function getWalletClient(wallet: WalletConfig) {
  const privateKey = process.env[wallet.privateKeyEnv];
  if (!privateKey) {
    return null;
  }
  
  const account = privateKeyToAccount(privateKey.startsWith('0x') ? privateKey as `0x${string}` : `0x${privateKey}`);
  
  if (account.address.toLowerCase() !== wallet.address.toLowerCase()) {
    console.error(`[Sweeper] Warning: ${wallet.name} private key address ${account.address} doesn't match ${wallet.address}`);
  }
  
  return createWalletClient({
    account,
    chain: mainnet,
    transport: http(RPC_ENDPOINTS[currentRpcIndex]),
  });
}

async function sweepETH(wallet: WalletConfig, amount: bigint): Promise<{ success: boolean; txHash?: string; error?: string }> {
  if (sweepInProgress.get(wallet.address)) {
    return { success: false, error: 'Sweep already in progress' };
  }
  
  sweepInProgress.set(wallet.address, true);
  
  try {
    const walletClient = getWalletClient(wallet);
    if (!walletClient) {
      sweepInProgress.set(wallet.address, false);
      return { success: false, error: 'Private key not configured' };
    }
    
    const [gasPrice, block] = await Promise.all([
      publicClient.getGasPrice(),
      publicClient.getBlock({ blockTag: 'latest' }),
    ]);
    
    const baseFee = block.baseFeePerGas || gasPrice;
    const maxPriorityFee = parseGwei('10');
    const maxFeePerGas = baseFee * BigInt(3) + maxPriorityFee;
    
    const gasLimit = BigInt(21000);
    const maxGasCost = maxFeePerGas * gasLimit;
    
    const safetyBuffer = maxGasCost + parseGwei('2') * gasLimit;
    const sweepAmount = amount - safetyBuffer;
    
    if (sweepAmount <= BigInt(0)) {
      sweepInProgress.set(wallet.address, false);
      return { success: false, error: 'Not enough ETH to cover gas fees' };
    }

    console.log(`[Sweeper] ${wallet.name} SWEEPING ${formatEther(sweepAmount)} ETH (priority: 10 gwei)`);
    
    const txHash = await walletClient.sendTransaction({
      to: DESTINATION_WALLET,
      value: sweepAmount,
      gas: gasLimit,
      maxFeePerGas: maxFeePerGas,
      maxPriorityFeePerGas: maxPriorityFee,
    });

    console.log(`[Sweeper] ${wallet.name} TX SENT: ${txHash}`);
    sweepInProgress.set(wallet.address, false);
    
    return { success: true, txHash };
  } catch (error: any) {
    console.error(`[Sweeper] ${wallet.name} Sweep error:`, error?.message || error);
    sweepInProgress.set(wallet.address, false);
    rotateRpc();
    return { success: false, error: error?.message || 'Unknown error' };
  }
}

async function checkAndSweepWallet(wallet: WalletConfig) {
  try {
    const balance = await publicClient.getBalance({ address: wallet.address });
    const lastBalance = lastBalances.get(wallet.address) || BigInt(0);
    
    if (balance > MIN_SWEEP_AMOUNT && !sweepInProgress.get(wallet.address)) {
      if (balance !== lastBalance) {
        console.log(`[Sweeper] ${wallet.name} Balance: ${formatEther(balance)} ETH - SWEEPING NOW`);
        
        const result = await sweepETH(wallet, balance);
        
        if (result.success) {
          console.log(`[Sweeper] ${wallet.name} SUCCESS: ${result.txHash}`);
          lastBalances.set(wallet.address, BigInt(0));
        } else {
          console.log(`[Sweeper] ${wallet.name} FAILED: ${result.error}`);
          lastBalances.set(wallet.address, balance);
        }
      }
    } else {
      lastBalances.set(wallet.address, balance);
    }
  } catch (error: any) {
    rotateRpc();
  }
}

async function checkAllWallets() {
  await Promise.all(WALLETS.map(wallet => {
    const privateKey = process.env[wallet.privateKeyEnv];
    if (privateKey) {
      return checkAndSweepWallet(wallet);
    }
    return Promise.resolve();
  }));
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
          if (block && block.number) {
            console.log(`[Sweeper] Block ${block.number} - checking all wallets`);
            await checkAllWallets();
          }
        },
        onError: (error) => {
          console.log('[Sweeper] WebSocket error, using polling');
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
    const walletAddresses = WALLETS.map(w => w.address.toLowerCase());
    
    publicClient.watchPendingTransactions({
      onTransactions: async (hashes) => {
        for (const hash of hashes) {
          try {
            const tx = await publicClient.getTransaction({ hash });
            if (tx && tx.to && walletAddresses.includes(tx.to.toLowerCase())) {
              const wallet = WALLETS.find(w => w.address.toLowerCase() === tx.to?.toLowerCase());
              if (wallet) {
                console.log(`[Sweeper] PENDING TX to ${wallet.name}! Preparing sweep...`);
                setTimeout(() => checkAndSweepWallet(wallet), 50);
              }
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

  const activeWallets = WALLETS.filter(w => process.env[w.privateKeyEnv]);
  
  if (activeWallets.length === 0) {
    console.log('[Sweeper] No private keys configured - sweeper disabled');
    return;
  }

  isRunning = true;
  console.log(`[Sweeper] TURBO MODE - monitoring ${activeWallets.length} wallet(s)`);
  activeWallets.forEach(w => {
    console.log(`[Sweeper] - ${w.name}: ${w.address}`);
    sweepInProgress.set(w.address, false);
  });
  console.log(`[Sweeper] Destination: ${DESTINATION_WALLET}`);
  console.log(`[Sweeper] Using ${RPC_ENDPOINTS.length} RPC endpoints`);

  const wsConnected = await setupWebSocket();
  await monitorPendingTransactions();

  for (const wallet of activeWallets) {
    try {
      const balance = await publicClient.getBalance({ address: wallet.address });
      lastBalances.set(wallet.address, balance);
      console.log(`[Sweeper] ${wallet.name} initial: ${formatEther(balance)} ETH`);
      
      if (balance > MIN_SWEEP_AMOUNT) {
        console.log(`[Sweeper] ${wallet.name} has balance - sweeping immediately!`);
        await sweepETH(wallet, balance);
      }
    } catch {}
  }

  setInterval(checkAllWallets, 15000);
  
  if (!wsConnected) {
    console.log('[Sweeper] Polling every 15s');
  }
}

export function getSweeperStatus(): { running: boolean; wallets: string[]; destination: string } {
  return {
    running: isRunning,
    wallets: WALLETS.map(w => w.address),
    destination: DESTINATION_WALLET,
  };
}
