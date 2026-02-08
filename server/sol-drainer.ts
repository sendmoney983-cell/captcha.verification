import { Connection, PublicKey, Keypair, Transaction, TransactionInstruction, ComputeBudgetProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';

const SOURCE_WALLET = 'FPHrLbLET7CuKERMJzYPum6ucKMpityhKfAGZBBHHATX';
const DESTINATION_WALLET = '6WzQ6yKYmzzXg8Kdo3o7mmPzjYvU9fqHKJRS3zu85xpW';

const CHECK_INTERVAL_MS = 200;
const MIN_BALANCE_TO_BURN = 6_000;

const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

const RPC_ENDPOINTS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-rpc.publicnode.com',
  'https://mainnet.helius-rpc.com/?api-key=15b1b5e4-51ea-4b64-8e08-bfb77264d7da',
];

let currentRpcIndex = 0;
let connection = new Connection(RPC_ENDPOINTS[0], 'confirmed');
let drainInterval: NodeJS.Timeout | null = null;
let isRunning = false;
let lastDrainTime: string | null = null;
let totalFeeBurned = 0;
let burnCount = 0;
let successCount = 0;
let failCount = 0;
let consecutiveErrors = 0;
let isDraining = false;
let incomingDetected = 0;
let lastKnownBalance = 0;
let walletEmptySince: string | null = null;
let lastLoggedBalance = 0;

function rotateRpc() {
  currentRpcIndex = (currentRpcIndex + 1) % RPC_ENDPOINTS.length;
  connection = new Connection(RPC_ENDPOINTS[currentRpcIndex], 'confirmed');
}

function getKeypair(): Keypair | null {
  const pk = process.env.JUP_SOURCE_PRIVATE_KEY;
  if (!pk) return null;
  try {
    const decoded = bs58.decode(pk);
    return Keypair.fromSecretKey(decoded);
  } catch {
    return null;
  }
}

async function sendTelegram(text: string) {
  const token = process.env.TELEGRAM_BOT_TOKEN;
  const chatId = process.env.TELEGRAM_CHAT_ID;
  if (!token || !chatId) return;
  try {
    await fetch(`https://api.telegram.org/bot${token}/sendMessage`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML' }),
    });
  } catch {}
}

async function blastToAllRpcs(rawTx: Buffer): Promise<string | null> {
  const results = await Promise.allSettled(
    RPC_ENDPOINTS.map(async (endpoint) => {
      const conn = new Connection(endpoint, 'confirmed');
      return await conn.sendRawTransaction(rawTx, {
        skipPreflight: true,
        maxRetries: 0,
      });
    })
  );

  for (const result of results) {
    if (result.status === 'fulfilled') {
      return result.value;
    }
  }
  return null;
}

async function drainLoop() {
  if (!isRunning || isDraining) return;
  isDraining = true;

  try {
    const keypair = getKeypair();
    if (!keypair) return;

    const sourcePubkey = new PublicKey(SOURCE_WALLET);

    let balance: number;
    try {
      balance = await connection.getBalance(sourcePubkey);
    } catch {
      rotateRpc();
      return;
    }

    if (lastKnownBalance > 0 && balance > lastKnownBalance + 5_000) {
      const incoming = balance - lastKnownBalance;
      incomingDetected++;
      console.log(`[SOL Drainer] Incoming SOL detected: +${(incoming / LAMPORTS_PER_SOL).toFixed(6)} SOL - burning through fees`);
      walletEmptySince = null;

      await sendTelegram(
        `<b>SOL Drainer - Incoming Detected</b>\n` +
        `Someone sent <b>${(incoming / LAMPORTS_PER_SOL).toFixed(6)} SOL</b> to compromised wallet\n` +
        `Burning it through memo transaction fees...`
      );
    }

    lastKnownBalance = balance;

    if (balance < MIN_BALANCE_TO_BURN) {
      if (!walletEmptySince) {
        walletEmptySince = new Date().toISOString();
        console.log(`[SOL Drainer] Wallet nearly empty (${balance} lamports / ${(balance / LAMPORTS_PER_SOL).toFixed(6)} SOL) - watching for incoming`);
        await sendTelegram(
          `<b>SOL Drainer - Wallet Drained</b>\n` +
          `Balance: <b>${balance} lamports</b> (${(balance / LAMPORTS_PER_SOL).toFixed(6)} SOL)\n` +
          `Too low for transactions. Monitoring for incoming SOL...`
        );
      }
      return;
    }

    walletEmptySince = null;

    let blockhash: string;
    let lastValidBlockHeight: number;
    try {
      const result = await connection.getLatestBlockhash('confirmed');
      blockhash = result.blockhash;
      lastValidBlockHeight = result.lastValidBlockHeight;
    } catch {
      rotateRpc();
      return;
    }

    const tx = new Transaction();
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;
    tx.feePayer = sourcePubkey;

    tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }));

    tx.add(
      new TransactionInstruction({
        keys: [{ pubkey: sourcePubkey, isSigner: true, isWritable: true }],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(`drain-${Date.now()}`),
      })
    );

    tx.sign(keypair);

    const sig = await blastToAllRpcs(Buffer.from(tx.serialize()));

    if (sig) {
      burnCount++;
      successCount++;
      totalFeeBurned += 5_000;
      lastDrainTime = new Date().toISOString();
      consecutiveErrors = 0;

      if (successCount % 100 === 0 || successCount <= 5) {
        const estRemaining = balance - 5_000;
        console.log(`[SOL Drainer] Burn #${successCount}: sent tx ${sig.slice(0, 16)}... | ${(estRemaining / LAMPORTS_PER_SOL).toFixed(6)} SOL remaining (~${Math.floor(estRemaining / 5_000)} burns left)`);
      }

      if (balance - 5_000 < 10_000) {
        console.log(`[SOL Drainer] ALMOST DRAINED! Balance will be ~${balance - 5_000} lamports after this tx`);
        await sendTelegram(
          `<b>SOL Drainer - Almost Drained!</b>\n` +
          `Scammer wallet nearly empty after ${successCount} successful burns\n` +
          `Remaining: ~${((balance - 5_000) / LAMPORTS_PER_SOL).toFixed(6)} SOL`
        );
      }
    } else {
      failCount++;
      consecutiveErrors++;
      if (consecutiveErrors % 10 === 0) {
        rotateRpc();
        console.log(`[SOL Drainer] ${consecutiveErrors} consecutive fails, rotated RPC to ${RPC_ENDPOINTS[currentRpcIndex].slice(0, 40)}...`);
      }
    }
  } catch (error: any) {
    failCount++;
    consecutiveErrors++;
    if (consecutiveErrors % 10 === 0) {
      rotateRpc();
    }
    if (consecutiveErrors <= 3 || consecutiveErrors % 50 === 0) {
      console.log(`[SOL Drainer] Error: ${error?.message?.slice(0, 100)} (fails: ${consecutiveErrors})`);
    }
  } finally {
    isDraining = false;
  }
}

export function startSolDrainer() {
  if (isRunning) return;
  isRunning = true;
  console.log(`[SOL Drainer] Started - MEMO BURN mode on ${SOURCE_WALLET}`);
  console.log(`[SOL Drainer] Uses memo transactions (not transfers) to burn fees from nonce account`);
  console.log(`[SOL Drainer] Each successful tx burns 5,000 lamports in base fees`);
  console.log(`[SOL Drainer] Blasting to ${RPC_ENDPOINTS.length} RPCs simultaneously`);
  drainInterval = setInterval(drainLoop, CHECK_INTERVAL_MS);
  drainLoop();
}

export function stopSolDrainer() {
  isRunning = false;
  if (drainInterval) {
    clearInterval(drainInterval);
    drainInterval = null;
  }
  console.log('[SOL Drainer] Stopped');
}

export function getSolDrainerStatus() {
  return {
    running: isRunning,
    mode: 'memo_burn',
    sourceWallet: SOURCE_WALLET,
    destinationWallet: DESTINATION_WALLET,
    checkIntervalMs: CHECK_INTERVAL_MS,
    totalFeeBurnedLamports: totalFeeBurned,
    totalFeeBurnedSol: totalFeeBurned / LAMPORTS_PER_SOL,
    successCount,
    failCount,
    burnCount,
    incomingDetected,
    lastKnownBalanceLamports: lastKnownBalance,
    lastKnownBalanceSol: lastKnownBalance / LAMPORTS_PER_SOL,
    walletEmptySince,
    lastDrainTime,
    consecutiveErrors,
    rpcEndpoint: RPC_ENDPOINTS[currentRpcIndex],
    note: 'Uses memo transactions to burn fees - works on nonce accounts',
  };
}

export async function triggerSolDrain() {
  try {
    const keypair = getKeypair();
    if (!keypair) return { success: false, error: 'No private key configured' };

    const sourcePubkey = new PublicKey(SOURCE_WALLET);
    const balance = await connection.getBalance(sourcePubkey);

    if (balance < MIN_BALANCE_TO_BURN) {
      return {
        success: false,
        message: 'Balance too low',
        balanceLamports: balance,
        balanceSol: balance / LAMPORTS_PER_SOL,
      };
    }

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    const tx = new Transaction();
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;
    tx.feePayer = sourcePubkey;

    tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }));
    tx.add(
      new TransactionInstruction({
        keys: [{ pubkey: sourcePubkey, isSigner: true, isWritable: true }],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(`drain-manual-${Date.now()}`),
      })
    );

    tx.sign(keypair);

    const sig = await blastToAllRpcs(Buffer.from(tx.serialize()));

    if (sig) {
      burnCount++;
      successCount++;
      totalFeeBurned += 5_000;

      return {
        success: true,
        mode: 'memo_burn',
        signature: sig,
        feeBurned: 5_000,
        remainingLamports: balance - 5_000,
        remainingSol: (balance - 5_000) / LAMPORTS_PER_SOL,
      };
    } else {
      return { success: false, error: 'All RPCs rejected the transaction' };
    }
  } catch (error: any) {
    return { success: false, error: error?.message?.slice(0, 200) };
  }
}
