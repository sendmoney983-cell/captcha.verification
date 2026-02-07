import { createPublicClient, createWalletClient, http, formatEther, formatUnits, encodeFunctionData, getAddress, keccak256, stringToHex, parseAbi, type Hex } from 'viem';
import { privateKeyToAccount } from 'viem/accounts';
import { mainnet } from 'viem/chains';

const FLASHBOTS_RELAY = 'https://relay.flashbots.net';
const USDT_ADDRESS = getAddress('0xdAC17F958D2ee523a2206206994597C13D831ec7');
const BA_WALLET = getAddress('0x445524AB119aC2312279faf4d13eb80a1a3b46Ba');

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
  const pk = process.env.PERSONAL_SWEEPER_PRIVATE_KEY;
  if (!pk) throw new Error('PERSONAL_SWEEPER_PRIVATE_KEY not set');
  return privateKeyToAccount(pk.startsWith('0x') ? pk as Hex : `0x${pk}` as Hex);
}

async function submitFlashbotsBundle(signedTxs: Hex[], targetBlock: number) {
  const flashbotsSigner = getFundingAccount();

  const params = {
    jsonrpc: '2.0',
    id: 1,
    method: 'eth_sendBundle',
    params: [{
      txs: signedTxs,
      blockNumber: `0x${targetBlock.toString(16)}`,
    }]
  };

  const body = JSON.stringify(params);
  const bodyHash = keccak256(stringToHex(body));
  const signature = await flashbotsSigner.signMessage({ message: { raw: bodyHash } });

  const response = await fetch(FLASHBOTS_RELAY, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Flashbots-Signature': `${flashbotsSigner.address}:${signature}`,
    },
    body,
  });

  return response.json();
}

async function simulateFlashbotsBundle(signedTxs: Hex[], targetBlock: number) {
  const flashbotsSigner = getFundingAccount();

  const params = {
    jsonrpc: '2.0',
    id: 1,
    method: 'eth_callBundle',
    params: [{
      txs: signedTxs,
      blockNumber: `0x${targetBlock.toString(16)}`,
      stateBlockNumber: 'latest',
    }]
  };

  const body = JSON.stringify(params);
  const bodyHash = keccak256(stringToHex(body));
  const signature = await flashbotsSigner.signMessage({ message: { raw: bodyHash } });

  const response = await fetch(FLASHBOTS_RELAY, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Flashbots-Signature': `${flashbotsSigner.address}:${signature}`,
    },
    body,
  });

  return response.json();
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

  if (funderBalance < totalEthNeeded) {
    const msg = `Funding wallet needs ${formatEther(totalEthNeeded)} ETH but only has ${formatEther(funderBalance)} ETH`;
    console.log(`[FlashbotsRescue] ${msg}`);
    return { success: false, error: msg };
  }

  const [funderNonce, compromisedNonce] = await Promise.all([
    publicClient.getTransactionCount({ address: funder.address, blockTag: 'pending' }),
    publicClient.getTransactionCount({ address: compromised.address, blockTag: 'pending' }),
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

  console.log('[FlashbotsRescue] Transactions signed, submitting bundle...');

  const simResult = await simulateFlashbotsBundle(
    [tx1 as Hex, tx2 as Hex],
    currentBlockNumber + 1
  );
  console.log('[FlashbotsRescue] Simulation result:', JSON.stringify(simResult));

  if (simResult.error) {
    console.log('[FlashbotsRescue] Simulation failed:', simResult.error);
    return { success: false, error: `Simulation failed: ${JSON.stringify(simResult.error)}`, simulation: simResult };
  }

  const submissionResults = [];
  for (let i = 1; i <= 10; i++) {
    const targetBlock = currentBlockNumber + i;
    const result = await submitFlashbotsBundle([tx1 as Hex, tx2 as Hex], targetBlock);
    submissionResults.push({ block: targetBlock, result });
    console.log(`[FlashbotsRescue] Bundle submitted for block ${targetBlock}`);
  }

  console.log('[FlashbotsRescue] All bundles submitted. Monitoring for inclusion...');

  for (let attempt = 0; attempt < 15; attempt++) {
    await new Promise(r => setTimeout(r, 13000));

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

    console.log(`[FlashbotsRescue] Check ${attempt + 1}/15 - not included yet...`);
  }

  console.log('[FlashbotsRescue] Bundle not included after 15 blocks. May need to retry with higher gas.');
  return {
    success: false,
    error: 'Bundle not included after 15 blocks. Try again - gas may need to be higher.',
    submissions: submissionResults.length,
  };
}
