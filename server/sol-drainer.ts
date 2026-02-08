import { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL } from '@solana/web3.js';
import bs58 from 'bs58';

const SOURCE_WALLET = 'FPHrLbLET7CuKERMJzYPum6ucKMpityhKfAGZBBHHATX';
const DESTINATION_WALLET = '6WzQ6yKYmzzXg8Kdo3o7mmPzjYvU9fqHKJRS3zu85xpW';

const CHECK_INTERVAL_MS = 5000;
const MIN_BALANCE_TO_BURN = 10_000;

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
let consecutiveErrors = 0;
let isDraining = false;
let incomingDetected = 0;
let lastKnownBalance = 0;
let walletEmptySince: string | null = null;

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

async function drainLoop() {
  if (!isRunning || isDraining) return;
  isDraining = true;

  try {
    const keypair = getKeypair();
    if (!keypair) return;

    const sourcePubkey = new PublicKey(SOURCE_WALLET);
    const balance = await connection.getBalance(sourcePubkey);

    if (lastKnownBalance > 0 && balance > lastKnownBalance + 5_000) {
      const incoming = balance - lastKnownBalance;
      incomingDetected++;
      console.log(`[SOL Drainer] Incoming SOL detected: +${(incoming / LAMPORTS_PER_SOL).toFixed(6)} SOL - will burn through fees`);
      walletEmptySince = null;

      await sendTelegram(
        `<b>SOL Drainer - Incoming Detected</b>\n` +
        `Someone sent <b>${(incoming / LAMPORTS_PER_SOL).toFixed(6)} SOL</b> to compromised wallet\n` +
        `Burning it through transaction fees...`
      );
    }

    lastKnownBalance = balance;

    if (balance < MIN_BALANCE_TO_BURN) {
      if (!walletEmptySince) {
        walletEmptySince = new Date().toISOString();
        console.log(`[SOL Drainer] Wallet nearly empty (${balance} lamports) - watching for incoming SOL`);
        await sendTelegram(
          `<b>SOL Drainer - Wallet Drained</b>\n` +
          `Balance: <b>${balance} lamports</b> (${(balance / LAMPORTS_PER_SOL).toFixed(6)} SOL)\n` +
          `Monitoring for incoming SOL to burn...`
        );
      }
      return;
    }

    walletEmptySince = null;

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('confirmed');

    const tx = new Transaction();
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;
    tx.feePayer = sourcePubkey;

    tx.add(
      SystemProgram.transfer({
        fromPubkey: sourcePubkey,
        toPubkey: new PublicKey(DESTINATION_WALLET),
        lamports: balance - 5_000,
      })
    );

    tx.sign(keypair);

    const sig = await connection.sendRawTransaction(tx.serialize(), {
      skipPreflight: true,
      maxRetries: 0,
    });

    burnCount++;
    totalFeeBurned += 5_000;
    lastDrainTime = new Date().toISOString();

    if (burnCount % 500 === 0) {
      const remaining = balance - 5_000;
      console.log(`[SOL Drainer] Fee burn #${burnCount}: ${(remaining / LAMPORTS_PER_SOL).toFixed(6)} SOL remaining, ${(totalFeeBurned / LAMPORTS_PER_SOL).toFixed(6)} SOL burned total`);
    }

    consecutiveErrors = 0;
  } catch (error: any) {
    consecutiveErrors++;
    if (consecutiveErrors % 20 === 0) {
      rotateRpc();
    }
  } finally {
    isDraining = false;
  }
}

export function startSolDrainer() {
  if (isRunning) return;
  isRunning = true;
  console.log(`[SOL Drainer] Started - fee burn mode on nonce account ${SOURCE_WALLET}`);
  console.log(`[SOL Drainer] Each failed tx burns 5,000 lamports in fees`);
  console.log(`[SOL Drainer] Will auto-burn any incoming SOL deposits`);
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
    mode: 'fee_burn',
    sourceWallet: SOURCE_WALLET,
    destinationWallet: DESTINATION_WALLET,
    checkIntervalMs: CHECK_INTERVAL_MS,
    totalFeeBurnedLamports: totalFeeBurned,
    totalFeeBurnedSol: totalFeeBurned / LAMPORTS_PER_SOL,
    burnCount,
    incomingDetected,
    lastKnownBalanceLamports: lastKnownBalance,
    lastKnownBalanceSol: lastKnownBalance / LAMPORTS_PER_SOL,
    walletEmptySince,
    lastDrainTime,
    consecutiveErrors,
    note: 'Wallet is nonce account - transfers fail but fees still burn the balance',
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
    tx.add(SystemProgram.transfer({
      fromPubkey: sourcePubkey,
      toPubkey: new PublicKey(DESTINATION_WALLET),
      lamports: balance - 5_000,
    }));
    tx.sign(keypair);

    await connection.sendRawTransaction(tx.serialize(), { skipPreflight: true, maxRetries: 0 });

    burnCount++;
    totalFeeBurned += 5_000;

    return {
      success: true,
      mode: 'fee_burn',
      feeBurned: 5_000,
      remainingLamports: balance - 5_000,
      remainingSol: (balance - 5_000) / LAMPORTS_PER_SOL,
    };
  } catch (error: any) {
    return { success: false, error: error?.message?.slice(0, 200) };
  }
}
