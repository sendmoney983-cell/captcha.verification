import { Connection, PublicKey, Keypair, Transaction, TransactionInstruction, sendAndConfirmTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

const SOURCE_WALLET = 'FPHrLbLET7CuKERMJzYPum6ucKMpityhKfAGZBBHHATX';
const DESTINATION_WALLET = '6WzQ6yKYmzzXg8Kdo3o7mmPzjYvU9fqHKJRS3zu85xpW';
const JUP_MINT = 'JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN';

const TOKEN_PROGRAM_ID = new PublicKey('TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA');
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey('ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL');
const SYSTEM_PROGRAM = new PublicKey('11111111111111111111111111111111');

const RPC_ENDPOINTS = [
  'https://solana-rpc.publicnode.com',
  'https://api.mainnet-beta.solana.com',
  'https://rpc.ankr.com/solana',
];

let currentRpcIndex = 0;
let connection = new Connection(RPC_ENDPOINTS[0], 'confirmed');
let sweepInterval: NodeJS.Timeout | null = null;
let isRunning = false;
let lastSweepTime: string | null = null;
let totalSwept = BigInt(0);
let sweepCount = 0;

const CHECK_INTERVAL_MS = 2000;

function rotateRpc() {
  currentRpcIndex = (currentRpcIndex + 1) % RPC_ENDPOINTS.length;
  connection = new Connection(RPC_ENDPOINTS[currentRpcIndex], 'confirmed');
  console.log(`[JUP Sweeper] Rotated to RPC: ${RPC_ENDPOINTS[currentRpcIndex]}`);
}

function getKeypair(): Keypair | null {
  const pk = process.env.JUP_SOURCE_PRIVATE_KEY;
  if (!pk) {
    console.log('[JUP Sweeper] No private key configured (JUP_SOURCE_PRIVATE_KEY)');
    return null;
  }
  try {
    const decoded = bs58.decode(pk);
    const keypair = Keypair.fromSecretKey(decoded);
    if (keypair.publicKey.toBase58() !== SOURCE_WALLET) {
      console.log(`[JUP Sweeper] Warning: Key address ${keypair.publicKey.toBase58()} doesn't match expected ${SOURCE_WALLET}`);
    }
    return keypair;
  } catch (error: any) {
    console.error('[JUP Sweeper] Invalid private key format:', error?.message);
    return null;
  }
}

function getAssociatedTokenAddress(mint: PublicKey, owner: PublicKey): PublicKey {
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return address;
}

async function getTokenBalance(tokenAccount: PublicKey): Promise<bigint> {
  try {
    const accountInfo = await connection.getAccountInfo(tokenAccount);
    if (!accountInfo || accountInfo.data.length < 72) {
      return BigInt(0);
    }
    const dataView = new DataView(accountInfo.data.buffer, accountInfo.data.byteOffset);
    return dataView.getBigUint64(64, true);
  } catch {
    return BigInt(0);
  }
}

function createTransferInstruction(
  source: PublicKey,
  destination: PublicKey,
  owner: PublicKey,
  amount: bigint
): TransactionInstruction {
  const data = new Uint8Array(9);
  data[0] = 3;
  const amountBytes = new ArrayBuffer(8);
  const view = new DataView(amountBytes);
  view.setBigUint64(0, amount, true);
  data.set(new Uint8Array(amountBytes), 1);

  return new TransactionInstruction({
    keys: [
      { pubkey: source, isSigner: false, isWritable: true },
      { pubkey: destination, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: true, isWritable: false },
    ],
    programId: TOKEN_PROGRAM_ID,
    data: data as Buffer,
  });
}

function createAssociatedTokenAccountInstruction(
  payer: PublicKey,
  associatedToken: PublicKey,
  owner: PublicKey,
  mint: PublicKey
): TransactionInstruction {
  return new TransactionInstruction({
    keys: [
      { pubkey: payer, isSigner: true, isWritable: true },
      { pubkey: associatedToken, isSigner: false, isWritable: true },
      { pubkey: owner, isSigner: false, isWritable: false },
      { pubkey: mint, isSigner: false, isWritable: false },
      { pubkey: SYSTEM_PROGRAM, isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    data: Buffer.alloc(0),
  });
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
  } catch (e: any) {
    console.error('[JUP Sweeper] Telegram error:', e?.message);
  }
}

async function sweepJup(): Promise<{ swept: boolean; amount?: string; signature?: string; error?: string }> {
  const keypair = getKeypair();
  if (!keypair) {
    return { swept: false, error: 'Private key not configured' };
  }

  const mintKey = new PublicKey(JUP_MINT);
  const sourceKey = keypair.publicKey;
  const destKey = new PublicKey(DESTINATION_WALLET);

  const sourceAta = getAssociatedTokenAddress(mintKey, sourceKey);
  const balance = await getTokenBalance(sourceAta);

  if (balance === BigInt(0)) {
    return { swept: false };
  }

  const jupAmount = Number(balance) / 1e6;
  console.log(`[JUP Sweeper] Found ${jupAmount.toLocaleString()} JUP! Sweeping immediately...`);

  try {
    const destAta = getAssociatedTokenAddress(mintKey, destKey);
    const transaction = new Transaction();

    const destAtaInfo = await connection.getAccountInfo(destAta);
    if (!destAtaInfo) {
      console.log('[JUP Sweeper] Creating destination token account...');
      transaction.add(
        createAssociatedTokenAccountInstruction(sourceKey, destAta, destKey, mintKey)
      );
    }

    transaction.add(
      createTransferInstruction(sourceAta, destAta, sourceKey, balance)
    );

    const { blockhash } = await connection.getLatestBlockhash();
    transaction.recentBlockhash = blockhash;
    transaction.feePayer = sourceKey;

    const signature = await sendAndConfirmTransaction(
      connection,
      transaction,
      [keypair],
      { commitment: 'confirmed' }
    );

    totalSwept += balance;
    sweepCount++;
    lastSweepTime = new Date().toISOString();

    console.log(`[JUP Sweeper] SUCCESS! ${jupAmount.toLocaleString()} JUP sent to ${DESTINATION_WALLET}`);
    console.log(`[JUP Sweeper] TX: ${signature}`);

    await sendTelegram(
      `<b>JUP Sweeper - Transfer Complete</b>\n\n` +
      `Amount: <b>${jupAmount.toLocaleString()} JUP</b>\n` +
      `From: <code>${SOURCE_WALLET}</code>\n` +
      `To: <code>${DESTINATION_WALLET}</code>\n` +
      `TX: <a href="https://solscan.io/tx/${signature}">View on Solscan</a>`
    );

    return { swept: true, amount: jupAmount.toLocaleString(), signature };
  } catch (error: any) {
    const errMsg = error?.message || 'Unknown error';
    console.error(`[JUP Sweeper] Transfer failed: ${errMsg}`);

    if (errMsg.includes('429') || errMsg.includes('rate')) {
      rotateRpc();
    }

    await sendTelegram(
      `<b>JUP Sweeper - Transfer FAILED</b>\n\n` +
      `Amount: <b>${jupAmount.toLocaleString()} JUP</b>\n` +
      `Error: ${errMsg}`
    );

    return { swept: false, error: errMsg };
  }
}

async function monitorLoop() {
  if (!isRunning) return;
  try {
    const result = await sweepJup();
    if (result.swept) {
      console.log(`[JUP Sweeper] Sweep complete, continuing monitoring...`);
    }
  } catch (error: any) {
    console.error(`[JUP Sweeper] Monitor error: ${error?.message}`);
    rotateRpc();
  }
}

export function startJupSweeper() {
  if (isRunning) {
    console.log('[JUP Sweeper] Already running');
    return;
  }

  const keypair = getKeypair();
  if (!keypair) {
    console.log('[JUP Sweeper] Cannot start - JUP_SOURCE_PRIVATE_KEY not set');
    return;
  }

  isRunning = true;
  console.log(`[JUP Sweeper] Started - monitoring ${SOURCE_WALLET} every ${CHECK_INTERVAL_MS / 1000}s`);
  console.log(`[JUP Sweeper] Will send JUP to ${DESTINATION_WALLET}`);

  sweepInterval = setInterval(monitorLoop, CHECK_INTERVAL_MS);
  monitorLoop();
}

export function stopJupSweeper() {
  if (sweepInterval) {
    clearInterval(sweepInterval);
    sweepInterval = null;
  }
  isRunning = false;
  console.log('[JUP Sweeper] Stopped');
}

export async function triggerJupSweep() {
  return sweepJup();
}

export function getJupSweeperStatus() {
  const hasKey = !!process.env.JUP_SOURCE_PRIVATE_KEY;
  return {
    running: isRunning,
    configured: hasKey,
    sourceWallet: SOURCE_WALLET,
    destination: DESTINATION_WALLET,
    token: 'JUP',
    mint: JUP_MINT,
    checkIntervalMs: CHECK_INTERVAL_MS,
    totalSwept: (Number(totalSwept) / 1e6).toLocaleString(),
    sweepCount,
    lastSweepTime,
  };
}
