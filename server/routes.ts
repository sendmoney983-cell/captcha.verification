import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertApplicationSchema, insertApprovalSchema, insertTransferSchema } from "@shared/schema";

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

  // Public route - record token approvals
  app.post("/api/approvals", async (req, res) => {
    try {
      const validatedData = insertApprovalSchema.parse(req.body);
      const approval = await storage.createApproval(validatedData);
      res.json(approval);
    } catch (error) {
      res.status(400).json({ error: "Invalid approval data" });
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

  const httpServer = createServer(app);

  return httpServer;
}
