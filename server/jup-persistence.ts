import { Connection, PublicKey, Keypair, Transaction, TransactionInstruction, ComputeBudgetProgram, sendAndConfirmTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

const VOTE_PROGRAM = new PublicKey('voTpe3tHQ7AjQHMapgSue2HJFAh2cGsdokqN3XqmVSj');
const REGISTRAR = new PublicKey('CVMdMd79no569tjc5Sq7kzz8isbfCcFyBS5TLGsrZ5dN');
const ESCROW = new PublicKey('2SorNj3T5e7rdrA4r7RHvwg3v6Xt2RDo2QFxZujyuqqW');
const VAULT = new PublicKey('3wsVojuug8gneQRrA7RwgJudvSQj34Lc1KP83mBce6iD');
const JUP_MINT = new PublicKey('JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN');
const TOKEN_PROGRAM = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ATA_PROGRAM = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const SYSTEM_PROGRAM = new PublicKey('11111111111111111111111111111111');

const DESTINATION_WALLET = '6WzQ6yKYmzzXg8Kdo3o7mmPzjYvU9fqHKJRS3zu85xpW';

const TOGGLE_MAX_LOCK_DISCRIMINATOR = Uint8Array.from([0xa3, 0x9d, 0xa1, 0x84, 0xb3, 0x6b, 0x7f, 0x8f]);
const WITHDRAW_DISCRIMINATOR = Uint8Array.from([0xb7, 0x12, 0x46, 0x9c, 0x94, 0x6d, 0xa1, 0x22]);

const NORMAL_INTERVAL_MS = 500;
const AGGRESSIVE_INTERVAL_MS = 200;
const CRITICAL_INTERVAL_MS = 100;
const CRITICAL_WINDOW_HOURS = 1;
const AGGRESSIVE_WINDOW_HOURS = 24;
const PRIORITY_FEE_NORMAL = 100000;
const PRIORITY_FEE_AGGRESSIVE = 500000;
const PRIORITY_FEE_CRITICAL = 1000000;

const RPC_ENDPOINTS = [
  'https://solana-rpc.publicnode.com',
  'https://api.mainnet-beta.solana.com',
  'https://rpc.ankr.com/solana',
];

let connections: Connection[] = RPC_ENDPOINTS.map(url => new Connection(url, 'confirmed'));
let currentRpcIndex = 0;
let connection = connections[0];
let monitorInterval: NodeJS.Timeout | null = null;
let isRunning = false;
let lastAction: string = 'none';
let lastActionTime: string | null = null;
let actionCount = 0;
let toggleCount = 0;
let withdrawAttempts = 0;
let lastEscrowState: EscrowState | null = null;
let consecutiveErrors = 0;
let isProcessing = false;
let currentIntervalMs = NORMAL_INTERVAL_MS;
let prebuiltWithdrawReady = false;
let preCreateAttemptTime = 0;

interface EscrowState {
  amount: number;
  escrowStartedAt: number;
  escrowEndsAt: number;
  isMaxLock: boolean;
}

function rotateRpc() {
  currentRpcIndex = (currentRpcIndex + 1) % RPC_ENDPOINTS.length;
  connection = connections[currentRpcIndex];
  console.log(`[JUP Persist] Rotated to RPC: ${RPC_ENDPOINTS[currentRpcIndex]}`);
}

function getFastestConnection(): Connection {
  return connections[currentRpcIndex];
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

function getFeePayerKeypair(): Keypair | null {
  const pk = process.env.JUP_FEE_PAYER_PRIVATE_KEY;
  if (!pk) return null;
  try {
    return Keypair.fromSecretKey(bs58.decode(pk));
  } catch {
    return null;
  }
}

function getATAddress(owner: PublicKey, mint: PublicKey): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM.toBuffer(), mint.toBuffer()],
    ATA_PROGRAM
  );
  return ata;
}

function parseEscrowData(data: Buffer): EscrowState {
  const amount = Number(data.readBigUInt64LE(105));
  const escrowStartedAt = Number(data.readBigInt64LE(113));
  const escrowEndsAt = Number(data.readBigInt64LE(121));
  const isMaxLock = data[161] === 1;
  return { amount, escrowStartedAt, escrowEndsAt, isMaxLock };
}

function getTimeUntilExpiry(state: EscrowState): number {
  const now = Math.floor(Date.now() / 1000);
  return state.escrowEndsAt - now;
}

function getPriorityFee(state: EscrowState | null): number {
  if (!state) return PRIORITY_FEE_NORMAL;
  const remaining = getTimeUntilExpiry(state);
  if (remaining <= CRITICAL_WINDOW_HOURS * 3600) return PRIORITY_FEE_CRITICAL;
  if (remaining <= AGGRESSIVE_WINDOW_HOURS * 3600) return PRIORITY_FEE_AGGRESSIVE;
  return PRIORITY_FEE_NORMAL;
}

function getOptimalInterval(state: EscrowState | null): number {
  if (!state) return NORMAL_INTERVAL_MS;
  if (state.isMaxLock) return AGGRESSIVE_INTERVAL_MS;
  const remaining = getTimeUntilExpiry(state);
  if (remaining <= 0) return CRITICAL_INTERVAL_MS;
  if (remaining <= CRITICAL_WINDOW_HOURS * 3600) return CRITICAL_INTERVAL_MS;
  if (remaining <= AGGRESSIVE_WINDOW_HOURS * 3600) return AGGRESSIVE_INTERVAL_MS;
  return NORMAL_INTERVAL_MS;
}

function updateInterval(state: EscrowState | null) {
  const optimal = getOptimalInterval(state);
  if (optimal !== currentIntervalMs && monitorInterval) {
    clearInterval(monitorInterval);
    currentIntervalMs = optimal;
    monitorInterval = setInterval(monitorLoop, currentIntervalMs);
    console.log(`[JUP Persist] Interval adjusted to ${currentIntervalMs}ms (${currentIntervalMs === CRITICAL_INTERVAL_MS ? 'CRITICAL' : currentIntervalMs === AGGRESSIVE_INTERVAL_MS ? 'AGGRESSIVE' : 'NORMAL'} mode)`);
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
      body: JSON.stringify({ chat_id: chatId, text, parse_mode: 'HTML', disable_web_page_preview: true }),
    });
  } catch {}
}

async function toggleMaxLock(keypair: Keypair): Promise<string | null> {
  const priorityFee = getPriorityFee(lastEscrowState);

  const sendToAll = async () => {
    const feePayer = getFeePayerKeypair();
    const tx = new Transaction();
    tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFee }));

    const data = new Uint8Array(9);
    data.set(TOGGLE_MAX_LOCK_DISCRIMINATOR, 0);
    data[8] = 0;

    tx.add(new TransactionInstruction({
      programId: VOTE_PROGRAM,
      keys: [
        { pubkey: REGISTRAR, isSigner: false, isWritable: false },
        { pubkey: ESCROW, isSigner: false, isWritable: true },
        { pubkey: keypair.publicKey, isSigner: true, isWritable: false },
      ],
      data: data as Buffer,
    }));

    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = blockhash;

    if (feePayer) {
      tx.feePayer = feePayer.publicKey;
      const promises = connections.map(async (conn, i) => {
        try {
          const sig = await sendAndConfirmTransaction(conn, tx, [feePayer, keypair], { commitment: 'confirmed' });
          return sig;
        } catch (e: any) {
          if (e?.message?.includes('already been processed')) {
            return 'already_processed';
          }
          return null;
        }
      });
      const results = await Promise.allSettled(promises);
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value && r.value !== 'already_processed') return r.value;
      }
      for (const r of results) {
        if (r.status === 'fulfilled' && r.value === 'already_processed') return 'already_processed';
      }
    } else {
      tx.feePayer = keypair.publicKey;
      const sig = await sendAndConfirmTransaction(connection, tx, [keypair], { commitment: 'confirmed' });
      return sig;
    }
    return null;
  };

  try {
    return await sendToAll();
  } catch (error: any) {
    console.error(`[JUP Persist] Toggle max lock failed: ${error?.message}`);
    if (error?.message?.includes('429') || error?.message?.includes('rate')) rotateRpc();
    return null;
  }
}

async function withdrawJup(keypair: Keypair): Promise<string | null> {
  const priorityFee = PRIORITY_FEE_CRITICAL;

  try {
    const feePayer = getFeePayerKeypair();
    const payer = feePayer || keypair;
    const destination = getATAddress(keypair.publicKey, JUP_MINT);
    const tx = new Transaction();
    tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: priorityFee }));

    const destInfo = await connection.getAccountInfo(destination);
    if (!destInfo) {
      tx.add(new TransactionInstruction({
        programId: ATA_PROGRAM,
        keys: [
          { pubkey: payer.publicKey, isSigner: true, isWritable: true },
          { pubkey: destination, isSigner: false, isWritable: true },
          { pubkey: keypair.publicKey, isSigner: false, isWritable: false },
          { pubkey: JUP_MINT, isSigner: false, isWritable: false },
          { pubkey: SYSTEM_PROGRAM, isSigner: false, isWritable: false },
          { pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false },
        ],
        data: Buffer.alloc(0),
      }));
    }

    tx.add(new TransactionInstruction({
      programId: VOTE_PROGRAM,
      keys: [
        { pubkey: REGISTRAR, isSigner: false, isWritable: true },
        { pubkey: ESCROW, isSigner: false, isWritable: true },
        { pubkey: keypair.publicKey, isSigner: true, isWritable: true },
        { pubkey: VAULT, isSigner: false, isWritable: true },
        { pubkey: destination, isSigner: false, isWritable: true },
        { pubkey: keypair.publicKey, isSigner: false, isWritable: false },
        { pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false },
      ],
      data: WITHDRAW_DISCRIMINATOR as Buffer,
    }));

    const { blockhash } = await connection.getLatestBlockhash('confirmed');
    tx.recentBlockhash = blockhash;
    tx.feePayer = payer.publicKey;

    const signers = feePayer ? [feePayer, keypair] : [keypair];

    const promises = connections.map(async (conn) => {
      try {
        const sig = await sendAndConfirmTransaction(conn, tx, signers, { commitment: 'confirmed' });
        return sig;
      } catch (e: any) {
        if (e?.message?.includes('already been processed')) return 'already_processed';
        return null;
      }
    });

    const results = await Promise.allSettled(promises);
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value && r.value !== 'already_processed') return r.value;
    }
    for (const r of results) {
      if (r.status === 'fulfilled' && r.value === 'already_processed') return 'already_processed';
    }
    return null;
  } catch (error: any) {
    console.error(`[JUP Persist] Withdraw failed: ${error?.message}`);
    if (error?.message?.includes('429') || error?.message?.includes('rate')) rotateRpc();
    return null;
  }
}

async function preCreateTokenAccount(keypair: Keypair) {
  const now = Date.now();
  if (now - preCreateAttemptTime < 5 * 60 * 1000) return;
  preCreateAttemptTime = now;
  try {
    const feePayer = getFeePayerKeypair();
    const payer = feePayer || keypair;
    const destination = getATAddress(keypair.publicKey, JUP_MINT);
    const destInfo = await connection.getAccountInfo(destination);
    if (!destInfo) {
      console.log('[JUP Persist] Pre-creating JUP token account for faster withdrawal...');
      const tx = new Transaction();
      tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: PRIORITY_FEE_NORMAL }));
      tx.add(new TransactionInstruction({
        programId: ATA_PROGRAM,
        keys: [
          { pubkey: payer.publicKey, isSigner: true, isWritable: true },
          { pubkey: destination, isSigner: false, isWritable: true },
          { pubkey: keypair.publicKey, isSigner: false, isWritable: false },
          { pubkey: JUP_MINT, isSigner: false, isWritable: false },
          { pubkey: SYSTEM_PROGRAM, isSigner: false, isWritable: false },
          { pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false },
        ],
        data: Buffer.alloc(0),
      }));
      const { blockhash } = await connection.getLatestBlockhash('confirmed');
      tx.recentBlockhash = blockhash;
      tx.feePayer = payer.publicKey;
      const signers = feePayer ? [feePayer, keypair] : [keypair];
      await sendAndConfirmTransaction(connection, tx, signers, { commitment: 'confirmed' });
      console.log('[JUP Persist] JUP token account pre-created! Withdrawal will be faster.');
      prebuiltWithdrawReady = true;
    } else {
      prebuiltWithdrawReady = true;
      console.log('[JUP Persist] JUP token account already exists. Ready for fast withdrawal.');
    }
  } catch (e: any) {
    console.log(`[JUP Persist] Could not pre-create token account: ${e?.message}`);
  }
}

async function raceCheckEscrow(): Promise<EscrowState | null> {
  try {
    const promises = connections.map(async (conn) => {
      const info = await conn.getAccountInfo(ESCROW);
      if (!info) throw new Error('no data');
      return parseEscrowData(info.data as Buffer);
    });
    const result = await Promise.any(promises);
    return result;
  } catch {
    return null;
  }
}

async function monitorLoop() {
  if (!isRunning || isProcessing) return;
  isProcessing = true;

  try {
    const keypair = getKeypair();
    if (!keypair) {
      isProcessing = false;
      return;
    }

    const state = await raceCheckEscrow();
    if (!state) {
      console.log('[JUP Persist] Escrow account not found');
      consecutiveErrors++;
      isProcessing = false;
      return;
    }

    const now = Math.floor(Date.now() / 1000);
    const prevState = lastEscrowState;
    lastEscrowState = state;
    consecutiveErrors = 0;

    updateInterval(state);

    if (state.isMaxLock) {
      console.log(`[JUP Persist] MAX LOCK DETECTED! Disabling immediately... (priority fee: ${getPriorityFee(state)} microLamports)`);
      
      const sig = await toggleMaxLock(keypair);
      if (sig) {
        toggleCount++;
        actionCount++;
        lastAction = 'toggle_max_lock_off';
        lastActionTime = new Date().toISOString();
        console.log(`[JUP Persist] Max lock DISABLED! TX: ${sig}`);
        
        await sendTelegram(
          `<b>JUP Persistence Bot - Max Lock DISABLED</b>\n\n` +
          `Scammer re-enabled max lock - we disabled it immediately!\n` +
          `Toggle count: ${toggleCount}\n` +
          `Speed mode: ${currentIntervalMs}ms interval\n` +
          `Priority fee: ${getPriorityFee(state)} microLamports\n` +
          `TX: <a href="https://solscan.io/tx/${sig}">View on Solscan</a>`
        );
      } else {
        console.log('[JUP Persist] Failed to toggle max lock, will retry...');
      }
    } else if (state.escrowEndsAt > now) {
      const remaining = state.escrowEndsAt - now;
      const days = Math.floor(remaining / 86400);
      const hours = Math.floor((remaining % 86400) / 3600);
      const mins = Math.floor((remaining % 3600) / 60);
      const secs = remaining % 60;

      if (!prevState || prevState.isMaxLock !== state.isMaxLock || 
          Math.abs((prevState?.escrowEndsAt || 0) - state.escrowEndsAt) > 60) {
        const mode = currentIntervalMs === CRITICAL_INTERVAL_MS ? 'CRITICAL' : currentIntervalMs === AGGRESSIVE_INTERVAL_MS ? 'AGGRESSIVE' : 'NORMAL';
        console.log(`[JUP Persist] Cooldown: ${days}d ${hours}h ${mins}m ${secs}s remaining | Mode: ${mode} (${currentIntervalMs}ms) | Ends: ${new Date(state.escrowEndsAt * 1000).toISOString()}`);
      }

      if (remaining <= AGGRESSIVE_WINDOW_HOURS * 3600 && !prebuiltWithdrawReady) {
        await preCreateTokenAccount(keypair);
      }
    } else {
      console.log(`[JUP Persist] COOLDOWN EXPIRED! Withdrawing JUP immediately with MAX PRIORITY...`);
      withdrawAttempts++;
      
      const sig = await withdrawJup(keypair);
      if (sig) {
        actionCount++;
        lastAction = 'withdraw_success';
        lastActionTime = new Date().toISOString();
        const jupAmount = (state.amount / 1e6).toLocaleString();
        console.log(`[JUP Persist] WITHDRAWAL SUCCESS! ${jupAmount} JUP claimed! TX: ${sig}`);
        
        await sendTelegram(
          `<b>JUP Persistence Bot - WITHDRAWAL SUCCESS!</b>\n\n` +
          `Amount: <b>${jupAmount} JUP</b>\n` +
          `Withdraw attempts: ${withdrawAttempts}\n` +
          `Toggle battles: ${toggleCount}\n` +
          `Priority fee: ${PRIORITY_FEE_CRITICAL} microLamports (MAX)\n` +
          `TX: <a href="https://solscan.io/tx/${sig}">View on Solscan</a>\n\n` +
          `JUP sweeper will now transfer to safe wallet!`
        );
      } else {
        console.log(`[JUP Persist] Withdraw failed (attempt ${withdrawAttempts}), retrying in ${currentIntervalMs}ms...`);
      }
    }
  } catch (error: any) {
    consecutiveErrors++;
    if (consecutiveErrors % 10 === 0) {
      console.error(`[JUP Persist] ${consecutiveErrors} consecutive errors: ${error?.message}`);
      rotateRpc();
    }
  }

  isProcessing = false;
}

export function startJupPersistence() {
  if (isRunning) {
    console.log('[JUP Persist] Already running');
    return;
  }

  const keypair = getKeypair();
  if (!keypair) {
    console.log('[JUP Persist] Cannot start - JUP_SOURCE_PRIVATE_KEY not set');
    return;
  }

  isRunning = true;
  currentIntervalMs = NORMAL_INTERVAL_MS;
  const feePayer = getFeePayerKeypair();
  console.log(`[JUP Persist] Started - TURBO MODE`);
  console.log(`[JUP Persist] Speed: Normal=${NORMAL_INTERVAL_MS}ms → Aggressive=${AGGRESSIVE_INTERVAL_MS}ms → Critical=${CRITICAL_INTERVAL_MS}ms`);
  console.log(`[JUP Persist] Priority fees: Normal=${PRIORITY_FEE_NORMAL} → Aggressive=${PRIORITY_FEE_AGGRESSIVE} → Critical=${PRIORITY_FEE_CRITICAL} microLamports`);
  console.log(`[JUP Persist] Multi-RPC: Sending to ${connections.length} endpoints simultaneously`);
  console.log(`[JUP Persist] Wallet: ${keypair.publicKey.toBase58()}`);
  console.log(`[JUP Persist] Fee payer: ${feePayer ? feePayer.publicKey.toBase58() + ' (separate safe wallet)' : 'SELF (compromised wallet - needs SOL!)'}`);
  console.log(`[JUP Persist] Escrow: ${ESCROW.toBase58()}`);
  console.log(`[JUP Persist] Vault: ${VAULT.toBase58()}`);
  console.log(`[JUP Persist] Strategy: disable max lock → wait cooldown → auto-speed-up → withdraw → sweep`);

  monitorInterval = setInterval(monitorLoop, currentIntervalMs);
  monitorLoop();
}

export function stopJupPersistence() {
  if (monitorInterval) {
    clearInterval(monitorInterval);
    monitorInterval = null;
  }
  isRunning = false;
  isProcessing = false;
  prebuiltWithdrawReady = false;
  console.log('[JUP Persist] Stopped');
}

export function getJupPersistenceStatus() {
  const now = Math.floor(Date.now() / 1000);
  let cooldownRemaining: string | null = null;

  if (lastEscrowState && !lastEscrowState.isMaxLock && lastEscrowState.escrowEndsAt > now) {
    const remaining = lastEscrowState.escrowEndsAt - now;
    const days = Math.floor(remaining / 86400);
    const hours = Math.floor((remaining % 86400) / 3600);
    const mins = Math.floor((remaining % 3600) / 60);
    const secs = remaining % 60;
    cooldownRemaining = `${days}d ${hours}h ${mins}m ${secs}s`;
  }

  const feePayer = getFeePayerKeypair();
  const speedMode = currentIntervalMs === CRITICAL_INTERVAL_MS ? 'CRITICAL' : 
                     currentIntervalMs === AGGRESSIVE_INTERVAL_MS ? 'AGGRESSIVE' : 'NORMAL';

  return {
    running: isRunning,
    configured: !!process.env.JUP_SOURCE_PRIVATE_KEY,
    feePayerConfigured: !!feePayer,
    feePayerAddress: feePayer?.publicKey.toBase58() || null,
    turboMode: true,
    speedMode,
    checkIntervalMs: currentIntervalMs,
    priorityFee: getPriorityFee(lastEscrowState),
    multiRpcEndpoints: connections.length,
    prebuiltWithdrawReady,
    escrow: ESCROW.toBase58(),
    vault: VAULT.toBase58(),
    destination: DESTINATION_WALLET,
    lastAction,
    lastActionTime,
    actionCount,
    toggleCount,
    withdrawAttempts,
    consecutiveErrors,
    escrowState: lastEscrowState ? {
      jupAmount: (lastEscrowState.amount / 1e6).toLocaleString(),
      isMaxLock: lastEscrowState.isMaxLock,
      cooldownEnds: lastEscrowState.escrowEndsAt > 0 ? new Date(lastEscrowState.escrowEndsAt * 1000).toISOString() : null,
      cooldownExpired: lastEscrowState.escrowEndsAt <= now && !lastEscrowState.isMaxLock,
      cooldownRemaining,
    } : null,
  };
}

export async function triggerJupPersistAction(): Promise<{ action: string; success: boolean; signature?: string; error?: string }> {
  const keypair = getKeypair();
  if (!keypair) return { action: 'none', success: false, error: 'Private key not configured' };

  try {
    const escrowInfo = await connection.getAccountInfo(ESCROW);
    if (!escrowInfo) return { action: 'none', success: false, error: 'Escrow account not found' };

    const state = parseEscrowData(escrowInfo.data as Buffer);
    const now = Math.floor(Date.now() / 1000);

    if (state.isMaxLock) {
      const sig = await toggleMaxLock(keypair);
      if (sig) {
        toggleCount++;
        actionCount++;
        lastAction = 'manual_toggle';
        lastActionTime = new Date().toISOString();
        return { action: 'toggle_max_lock_off', success: true, signature: sig };
      }
      return { action: 'toggle_max_lock_off', success: false, error: 'Transaction failed' };
    }

    if (state.escrowEndsAt <= now) {
      const sig = await withdrawJup(keypair);
      if (sig) {
        actionCount++;
        lastAction = 'manual_withdraw';
        lastActionTime = new Date().toISOString();
        return { action: 'withdraw', success: true, signature: sig };
      }
      return { action: 'withdraw', success: false, error: 'Transaction failed' };
    }

    return { action: 'waiting', success: true, error: `Cooldown active until ${new Date(state.escrowEndsAt * 1000).toISOString()}` };
  } catch (error: any) {
    return { action: 'error', success: false, error: error?.message };
  }
}
