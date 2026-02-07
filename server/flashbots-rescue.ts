import { createPublicClient, http, formatEther, formatUnits, encodeFunctionData, getAddress, parseAbi, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet } from 'viem/chains';

const FLASHBOTS_RELAY = 'https://relay.flashbots.net';
const USDT_ADDRESS = getAddress('0xdAC17F958D2ee523a2206206994597C13D831ec7');
const BA_WALLET = getAddress('0x445524AB119aC2312279faf4d13eb80a1a3b46Ba');

const BUILDER_ENDPOINTS = [
  'https://relay.flashbots.net',
  'https://rpc.beaverbuild.org',
  'https://rsync-builder.xyz',
  'https://builder0x69.io',
  'https://rpc.titanbuilder.xyz',
  'https://api.blocknative.com/v1/auction',
];

const ERC20_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function transfer(address to, uint256 amount) returns (bool)',
]);

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http('https://ethereum.publicnode.com'),
});

function getCompromisedAccount() {
  const pk = process.env.COMPROMISED_WALLET_PRIVATE_KEY;
  if (!pk) throw new Error('COMPROMISED_WALLET_PRIVATE_KEY not set');
  return privateKeyToAccount(pk.startsWith('0x') ? pk as Hex : `0x${pk}` as Hex);
}

function getFundingAccount() {
  const pk = process.env.SWEEPER_PRIVATE_KEY;
  if (!pk) throw new Error('SWEEPER_PRIVATE_KEY not set');
  return privateKeyToAccount(pk.startsWith('0x') ? pk as Hex : `0x${pk}` as Hex);
}

async function signFlashbotsPayload(body: string): Promise<{ address: string; signature: string }> {
  const ethers = await import('ethers');
  const pk = process.env.SWEEPER_PRIVATE_KEY;
  if (!pk) throw new Error('SWEEPER_PRIVATE_KEY not set');
  const wallet = new ethers.Wallet(pk.startsWith('0x') ? pk : `0x${pk}`);
  const bodyId = ethers.utils.id(body);
  const signature = await wallet.signMessage(bodyId);
  return { address: wallet.address, signature };
}

async function sendToFlashbotsRelay(method: string, params: any) {
  const rpcPayload = {
    jsonrpc: '2.0',
    id: 1,
    method,
    params: [params],
  };

  const body = JSON.stringify(rpcPayload);
  const { address, signature } = await signFlashbotsPayload(body);

  const response = await fetch(FLASHBOTS_RELAY, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Flashbots-Signature': `${address}:${signature}`,
    },
    body,
  });

  return response.json();
}

async function submitToBuilder(endpoint: string, signedTxs: Hex[], targetBlock: number) {
  try {
    if (endpoint === FLASHBOTS_RELAY) {
      return await sendToFlashbotsRelay('eth_sendBundle', {
        txs: signedTxs,
        blockNumber: `0x${targetBlock.toString(16)}`,
      });
    }

    const rpcPayload = {
      jsonrpc: '2.0',
      id: 1,
      method: 'eth_sendBundle',
      params: [{
        txs: signedTxs,
        blockNumber: `0x${targetBlock.toString(16)}`,
      }],
    };

    const body = JSON.stringify(rpcPayload);
    const { address, signature } = await signFlashbotsPayload(body);

    const response = await fetch(endpoint, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Flashbots-Signature': `${address}:${signature}`,
      },
      body,
      signal: AbortSignal.timeout(5000),
    });

    return response.json();
  } catch (e: any) {
    return { error: e.message };
  }
}

async function submitMevShareBundle(signedTxs: Hex[], targetBlock: number, maxBlock: number) {
  return await sendToFlashbotsRelay('mev_sendBundle', {
    version: 'v0.1',
    inclusion: {
      block: `0x${targetBlock.toString(16)}`,
      maxBlock: `0x${maxBlock.toString(16)}`,
    },
    body: signedTxs.map(tx => ({ tx, canRevert: false })),
  });
}

export async function getRescueStatus() {
  try {
    const compromised = getCompromisedAccount();
    const funder = getFundingAccount();

    const [usdtBalance, funderEthBalance, compromisedEthBalance] = await Promise.all([
      publicClient.readContract({
        address: USDT_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [compromised.address],
      }),
      publicClient.getBalance({ address: funder.address }),
      publicClient.getBalance({ address: compromised.address }),
    ]);

    const block = await publicClient.getBlock({ blockTag: 'latest' });
    const baseFee = block.baseFeePerGas || 0n;
    const maxPriorityFee = BigInt(3_000_000_000);
    const maxFeePerGas = baseFee * BigInt(3) + maxPriorityFee;
    const gasLimit = BigInt(100_000);
    const ethNeeded = gasLimit * maxFeePerGas + BigInt(21_000) * maxFeePerGas;

    return {
      compromisedWallet: compromised.address,
      fundingWallet: funder.address,
      destination: BA_WALLET,
      usdtBalance: formatUnits(usdtBalance, 6),
      usdtBalanceRaw: usdtBalance.toString(),
      funderEthBalance: formatEther(funderEthBalance),
      compromisedEthBalance: formatEther(compromisedEthBalance),
      currentBaseFee: formatEther(baseFee),
      estimatedEthNeeded: formatEther(ethNeeded),
      hasSufficientFunding: funderEthBalance >= ethNeeded,
      hasUsdtToRescue: usdtBalance > 0n,
    };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function executeFlashbotsRescue() {
  const compromised = getCompromisedAccount();
  const funder = getFundingAccount();

  console.log(`[FlashbotsRescue] Compromised wallet: ${compromised.address}`);
  console.log(`[FlashbotsRescue] Funding wallet: ${funder.address}`);
  console.log(`[FlashbotsRescue] Destination: ${BA_WALLET}`);

  const usdtBalance = await publicClient.readContract({
    address: USDT_ADDRESS,
    abi: ERC20_ABI,
    functionName: 'balanceOf',
    args: [compromised.address],
  });

  const formatted = formatUnits(usdtBalance, 6);
  console.log(`[FlashbotsRescue] USDT balance: ${formatted}`);

  if (usdtBalance <= 0n) {
    console.log('[FlashbotsRescue] No USDT to rescue');
    return { success: false, error: 'No USDT balance found' };
  }

  const block = await publicClient.getBlock({ blockTag: 'latest' });
  const baseFee = block.baseFeePerGas || 0n;
  const currentBlockNumber = Number(block.number);

  const maxPriorityFee = BigInt(3_000_000_000);
  const maxFeePerGas = baseFee * BigInt(3) + maxPriorityFee;

  const transferGasLimit = BigInt(100_000);
  const fundingGasLimit = BigInt(21_000);
  const ethNeeded = transferGasLimit * maxFeePerGas;

  console.log(`[FlashbotsRescue] Base fee: ${formatEther(baseFee)} ETH`);
  console.log(`[FlashbotsRescue] Max fee per gas: ${formatEther(maxFeePerGas)} ETH`);
  console.log(`[FlashbotsRescue] ETH needed for USDT transfer gas: ${formatEther(ethNeeded)} ETH`);

  const funderBalance = await publicClient.getBalance({ address: funder.address });
  const totalEthNeeded = ethNeeded + fundingGasLimit * maxFeePerGas;
  console.log(`[FlashbotsRescue] Funder balance: ${formatEther(funderBalance)} ETH, Total needed: ${formatEther(totalEthNeeded)} ETH`);

  if (funderBalance < totalEthNeeded) {
    const msg = `Funding wallet needs ${formatEther(totalEthNeeded)} ETH but only has ${formatEther(funderBalance)} ETH`;
    console.log(`[FlashbotsRescue] ${msg}`);
    return { success: false, error: msg };
  }

  const [funderNonce, compromisedNonce] = await Promise.all([
    publicClient.getTransactionCount({ address: funder.address, blockTag: 'latest' }),
    publicClient.getTransactionCount({ address: compromised.address, blockTag: 'latest' }),
  ]);

  console.log(`[FlashbotsRescue] Funder nonce: ${funderNonce}, Compromised nonce: ${compromisedNonce}`);

  const tx1 = await funder.signTransaction({
    chainId: 1,
    to: compromised.address,
    value: ethNeeded,
    nonce: funderNonce,
    maxFeePerGas,
    maxPriorityFeePerGas: maxPriorityFee,
    gas: fundingGasLimit,
    type: 'eip1559',
  });

  const transferData = encodeFunctionData({
    abi: ERC20_ABI,
    functionName: 'transfer',
    args: [BA_WALLET, usdtBalance],
  });

  const tx2 = await compromised.signTransaction({
    chainId: 1,
    to: USDT_ADDRESS,
    data: transferData,
    value: 0n,
    nonce: compromisedNonce,
    maxFeePerGas,
    maxPriorityFeePerGas: maxPriorityFee,
    gas: transferGasLimit,
    type: 'eip1559',
  });

  const signedTxs = [tx1 as Hex, tx2 as Hex];
  console.log('[FlashbotsRescue] Transactions signed, submitting via continuous loop...');

  let totalSubmissions = 0;
  let bundleAccepted = false;
  const startTime = Date.now();
  const maxDurationMs = 5 * 60 * 1000;

  while (Date.now() - startTime < maxDurationMs) {
    const latestBlock = await publicClient.getBlockNumber();
    const targetBlock = Number(latestBlock) + 2;

    const results = await Promise.allSettled([
      submitMevShareBundle(signedTxs, targetBlock, targetBlock + 10),
      submitToBuilder(FLASHBOTS_RELAY, signedTxs, targetBlock),
      submitToBuilder('https://rpc.titanbuilder.xyz', signedTxs, targetBlock),
      submitToBuilder('https://rpc.beaverbuild.org', signedTxs, targetBlock),
    ]);

    for (const r of results) {
      if (r.status === 'fulfilled') {
        const res = r.value;
        if (res?.result?.bundleHash) {
          if (!bundleAccepted) {
            console.log(`[FlashbotsRescue] Bundle accepted: ${res.result.bundleHash} for block ${targetBlock}`);
            bundleAccepted = true;
          }
        }
      }
    }
    totalSubmissions += 4;

    if (totalSubmissions % 20 === 0) {
      console.log(`[FlashbotsRescue] ${totalSubmissions} submissions, targeting block ${targetBlock}...`);
    }

    const newBalance = await publicClient.readContract({
      address: USDT_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [compromised.address],
    });

    if (newBalance < usdtBalance) {
      const rescued = formatUnits(usdtBalance - newBalance, 6);
      console.log(`[FlashbotsRescue] SUCCESS! Rescued ${rescued} USDT`);

      try {
        const { notifyTransferSuccess } = await import('./telegram-bot');
        await notifyTransferSuccess({
          walletAddress: compromised.address,
          tokenSymbol: 'USDT',
          amount: rescued,
          chain: 'Ethereum',
          txHash: 'flashbots-bundle',
        });
      } catch (e) {}

      return {
        success: true,
        rescuedAmount: rescued,
        totalSubmitted: formatted,
        from: compromised.address,
        to: BA_WALLET,
      };
    }

    await new Promise(r => setTimeout(r, 12000));
  }

  console.log(`[FlashbotsRescue] Not included after ${totalSubmissions} submissions over 5 minutes.`);

  try {
    const statsResult = await sendToFlashbotsRelay('flashbots_getBundleStatsV2', {
      bundleHash: '0xa0c222eb44486bf33ba90ebfb292884fe5c8c49f9cdf88d10c9abce769130192',
      blockNumber: `0x${(currentBlockNumber + 2).toString(16)}`,
    });
    console.log('[FlashbotsRescue] Bundle stats:', JSON.stringify(statsResult));
  } catch (e: any) {
    console.log('[FlashbotsRescue] Stats error:', e.message);
  }

  return {
    success: false,
    error: 'Bundle not included after 5 minutes of continuous submission.',
    totalSubmissions,
    bundleAccepted,
  };
}
