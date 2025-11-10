import type { Express, Request, Response, NextFunction } from "express";
import { createServer, type Server } from "http";
import { storage } from "./storage";
import { insertApplicationSchema } from "@shared/schema";

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

  const httpServer = createServer(app);

  return httpServer;
}
