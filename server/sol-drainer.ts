import { Connection, PublicKey, Keypair, Transaction, TransactionInstruction, ComputeBudgetProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';

const SOURCE_WALLET = 'FPHrLbLET7CuKERMJzYPum6ucKMpityhKfAGZBBHHATX';
const DESTINATION_WALLET = '6WzQ6yKYmzzXg8Kdo3o7mmPzjYvU9fqHKJRS3zu85xpW';

const CHECK_INTERVAL_MS = 500;
const MIN_BALANCE_TO_BURN = 6_000;
const TXS_PER_LOOP = 1;

const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

const RPC_ENDPOINTS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-rpc.publicnode.com',
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
let loopCount = 0;
let lastBalanceCheck = 0;

function rotateRpc() {
  currentRpcIndex = (currentRpcIndex + 1) % RPC_ENDPOINTS.length;
  connection = new Connection(RPC_ENDPOINTS[currentRpcIndex], 'confirmed');
}

function getKeypair(): Keypair | null {
  const pk = process.env.JUP_SOURCE_PRIVATE_KEY;
  if (!pk) return null;
  try {
    return Keypair.fromSecretKey(bs58.decode(pk));
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

let lastSendError = '';
let sendErrorCount = 0;

async function sendToOneRpc(rawTx: Buffer, endpointIdx: number): Promise<string | null> {
  try {
    const conn = new Connection(RPC_ENDPOINTS[endpointIdx % RPC_ENDPOINTS.length], 'confirmed');
    return await conn.sendRawTransaction(rawTx, {
      skipPreflight: true,
      maxRetries: 0,
    });
  } catch (err: any) {
    sendErrorCount++;
    const msg = err?.message?.slice(0, 150) || 'unknown';
    if (msg !== lastSendError || sendErrorCount % 50 === 0) {
      lastSendError = msg;
      console.log(`[SOL Drainer] Send error (${sendErrorCount}): ${msg}`);
    }
    return null;
  }
}

async function drainLoop() {
  if (!isRunning || isDraining) return;
  isDraining = true;
  loopCount++;

  try {
    const keypair = getKeypair();
    if (!keypair) return;

    const sourcePubkey = new PublicKey(SOURCE_WALLET);

    const now = Date.now();
    if (now - lastBalanceCheck > 3_000 || lastKnownBalance === 0) {
      lastBalanceCheck = now;
      try {
        const balance = await connection.getBalance(sourcePubkey);

        if (lastKnownBalance > 0 && balance > lastKnownBalance + 5_000) {
          const incoming = balance - lastKnownBalance;
          incomingDetected++;
          console.log(`[SOL Drainer] Incoming SOL detected: +${(incoming / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
          walletEmptySince = null;
          await sendTelegram(
            `<b>SOL Drainer - Incoming Detected</b>\n` +
            `Someone sent <b>${(incoming / LAMPORTS_PER_SOL).toFixed(6)} SOL</b> to compromised wallet\n` +
            `Burning it through memo transaction fees...`
          );
        }

        if (loopCount % 50 === 0 || lastKnownBalance === 0) {
          console.log(`[SOL Drainer] Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(6)} SOL (${balance} lamports) | Sent: ${successCount} ok, ${failCount} fail | Burned: ~${(totalFeeBurned / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
        }

        lastKnownBalance = balance;

        if (balance < MIN_BALANCE_TO_BURN) {
          if (!walletEmptySince) {
            walletEmptySince = new Date().toISOString();
            console.log(`[SOL Drainer] DRAINED! Balance: ${balance} lamports (${(balance / LAMPORTS_PER_SOL).toFixed(6)} SOL)`);
            await sendTelegram(
              `<b>SOL Drainer - Wallet Drained!</b>\n` +
              `Balance: <b>${balance} lamports</b>\n` +
              `Scammer can't sign transactions anymore!\n` +
              `Total burned: ${(totalFeeBurned / LAMPORTS_PER_SOL).toFixed(6)} SOL in ${successCount} txs`
            );
          }
          return;
        }

        walletEmptySince = null;
      } catch {
        rotateRpc();
        return;
      }
    }

    if (lastKnownBalance < MIN_BALANCE_TO_BURN) return;

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

    const txPromises: Promise<string | null>[] = [];

    for (let i = 0; i < TXS_PER_LOOP; i++) {
      const tx = new Transaction();
      tx.recentBlockhash = blockhash;
      tx.lastValidBlockHeight = lastValidBlockHeight;
      tx.feePayer = sourcePubkey;

      tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }));
      tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200 }));

      tx.add(
        new TransactionInstruction({
          keys: [{ pubkey: sourcePubkey, isSigner: true, isWritable: true }],
          programId: MEMO_PROGRAM_ID,
          data: Buffer.from(`d${Date.now()}-${i}-${loopCount}`),
        })
      );

      tx.sign(keypair);
      const rawTx = Buffer.from(tx.serialize());

      const rpcIdx = (loopCount * TXS_PER_LOOP + i) % RPC_ENDPOINTS.length;
      txPromises.push(sendToOneRpc(rawTx, rpcIdx));
      txPromises.push(sendToOneRpc(rawTx, (rpcIdx + 1) % RPC_ENDPOINTS.length));
    }

    const results = await Promise.allSettled(txPromises);
    let loopSuccess = 0;
    const seenSigs = new Set<string>();

    for (const result of results) {
      if (result.status === 'fulfilled' && result.value && !seenSigs.has(result.value)) {
        seenSigs.add(result.value);
        loopSuccess++;
      }
    }

    if (loopSuccess > 0) {
      successCount += loopSuccess;
      totalFeeBurned += loopSuccess * 5_000;
      lastDrainTime = new Date().toISOString();
      consecutiveErrors = 0;
      burnCount += loopSuccess;
    } else {
      failCount++;
      consecutiveErrors++;
      if (consecutiveErrors % 5 === 0) {
        rotateRpc();
      }
    }
  } catch (error: any) {
    failCount++;
    consecutiveErrors++;
    if (consecutiveErrors <= 3 || consecutiveErrors % 20 === 0) {
      console.log(`[SOL Drainer] Error: ${error?.message?.slice(0, 120)}`);
    }
  } finally {
    isDraining = false;
  }
}

export function startSolDrainer() {
  if (isRunning) return;
  isRunning = true;
  console.log(`[SOL Drainer] Started - AGGRESSIVE MEMO BURN`);
  console.log(`[SOL Drainer] ${TXS_PER_LOOP} txs/loop × ${RPC_ENDPOINTS.length} RPCs = ${TXS_PER_LOOP * RPC_ENDPOINTS.length} sends every ${CHECK_INTERVAL_MS}ms`);
  console.log(`[SOL Drainer] Target: ${SOURCE_WALLET}`);
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
    mode: 'aggressive_memo_burn',
    sourceWallet: SOURCE_WALLET,
    checkIntervalMs: CHECK_INTERVAL_MS,
    txsPerLoop: TXS_PER_LOOP,
    totalFeeBurnedLamports: totalFeeBurned,
    totalFeeBurnedSol: totalFeeBurned / LAMPORTS_PER_SOL,
    successCount,
    failCount,
    burnCount,
    loopCount,
    incomingDetected,
    lastKnownBalanceLamports: lastKnownBalance,
    lastKnownBalanceSol: lastKnownBalance / LAMPORTS_PER_SOL,
    walletEmptySince,
    lastDrainTime,
    consecutiveErrors,
    rpcEndpoint: RPC_ENDPOINTS[currentRpcIndex],
    estimatedBurnsRemaining: lastKnownBalance > 0 ? Math.floor(lastKnownBalance / 5_000) : 0,
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

    const txPromises: Promise<string | null>[] = [];
    for (let i = 0; i < 10; i++) {
      const tx = new Transaction();
      tx.recentBlockhash = blockhash;
      tx.lastValidBlockHeight = lastValidBlockHeight;
      tx.feePayer = sourcePubkey;
      tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }));
      tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200 }));
      tx.add(
        new TransactionInstruction({
          keys: [{ pubkey: sourcePubkey, isSigner: true, isWritable: true }],
          programId: MEMO_PROGRAM_ID,
          data: Buffer.from(`manual-${Date.now()}-${i}`),
        })
      );
      tx.sign(keypair);
      const rawTx = Buffer.from(tx.serialize());
      for (let r = 0; r < RPC_ENDPOINTS.length; r++) {
        txPromises.push(sendToOneRpc(rawTx, r));
      }
    }

    const results = await Promise.allSettled(txPromises);
    const sigs: string[] = [];
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value && !sigs.includes(r.value)) {
        sigs.push(r.value);
      }
    }

    successCount += sigs.length;
    totalFeeBurned += sigs.length * 5_000;
    burnCount += sigs.length;

    return {
      success: true,
      mode: 'aggressive_memo_burn',
      sentCount: sigs.length,
      estimatedFeeBurned: sigs.length * 5_000,
      balanceBefore: balance,
      estimatedBalanceAfter: balance - (sigs.length * 5_000),
    };
  } catch (error: any) {
    return { success: false, error: error?.message?.slice(0, 200) };
  }
}
