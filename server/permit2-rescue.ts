import { createPublicClient, createWalletClient, http, formatEther, formatUnits, encodeFunctionData, getAddress, parseAbi, keccak256, encodeAbiParameters, parseAbiParameters, type Hex, type Address } from 'viem';
import { privateKeyToAccount, signTypedData } from 'viem/accounts';
import { mainnet } from 'viem/chains';

const USDT_ADDRESS = getAddress('0xdAC17F958D2ee523a2206206994597C13D831ec7');
const BA_WALLET = getAddress('0x445524AB119aC2312279faf4d13eb80a1a3b46Ba');
const PERMIT2_ADDRESS = getAddress('0x000000000022D473030F116dDEE9F6B43aC78BA3');
const COMPROMISED_ADDRESS = getAddress('0x4DE23f3f0Fb3318287378AdbdE030cf61714b2f3');

const publicClient = createPublicClient({
  chain: mainnet,
  transport: http('https://ethereum-rpc.publicnode.com'),
});

const PERMIT2_ABI = parseAbi([
  'function permitTransferFrom(((address token, uint256 amount) permitted, uint256 nonce, uint256 deadline) permit, (address to, uint256 requestedAmount) transferDetails, address owner, bytes signature) external',
  'function nonceBitmap(address owner, uint256 wordPos) view returns (uint256)',
]);

const ERC20_ABI = parseAbi([
  'function balanceOf(address) view returns (uint256)',
  'function allowance(address owner, address spender) view returns (uint256)',
]);

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

async function findUnusedNonce(owner: Address): Promise<bigint> {
  for (let wordPos = 0; wordPos < 256; wordPos++) {
    const bitmap = await publicClient.readContract({
      address: PERMIT2_ADDRESS,
      abi: PERMIT2_ABI,
      functionName: 'nonceBitmap',
      args: [owner, BigInt(wordPos)],
    });

    if (bitmap !== BigInt('0xFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFFF')) {
      for (let bitPos = 0; bitPos < 256; bitPos++) {
        if ((BigInt(bitmap) & (1n << BigInt(bitPos))) === 0n) {
          const nonce = BigInt(wordPos) * 256n + BigInt(bitPos);
          console.log(`[Permit2Rescue] Found unused nonce: ${nonce} (word ${wordPos}, bit ${bitPos})`);
          return nonce;
        }
      }
    }
  }
  throw new Error('No unused nonce found');
}

export async function getPermit2RescueStatus() {
  try {
    const compromised = getCompromisedAccount();
    const funder = getFundingAccount();

    const [usdtBalance, permit2Allowance, funderEthBalance] = await Promise.all([
      publicClient.readContract({
        address: USDT_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'balanceOf',
        args: [COMPROMISED_ADDRESS],
      }),
      publicClient.readContract({
        address: USDT_ADDRESS,
        abi: ERC20_ABI,
        functionName: 'allowance',
        args: [COMPROMISED_ADDRESS, PERMIT2_ADDRESS],
      }),
      publicClient.getBalance({ address: funder.address }),
    ]);

    return {
      method: 'Permit2 SignatureTransfer',
      compromisedWallet: COMPROMISED_ADDRESS,
      callerWallet: funder.address,
      destination: BA_WALLET,
      usdtBalance: formatUnits(usdtBalance, 6),
      permit2Approved: permit2Allowance > 0n,
      permit2AllowanceRaw: permit2Allowance.toString(),
      callerEthBalance: formatEther(funderEthBalance),
      canExecute: permit2Allowance > 0n && usdtBalance > 0n && funderEthBalance > 0n,
    };
  } catch (error: any) {
    return { error: error.message };
  }
}

export async function executePermit2Rescue() {
  const compromised = getCompromisedAccount();
  const funder = getFundingAccount();

  console.log(`[Permit2Rescue] === PERMIT2 SIGNATURE TRANSFER RESCUE ===`);
  console.log(`[Permit2Rescue] Compromised wallet: ${COMPROMISED_ADDRESS}`);
  console.log(`[Permit2Rescue] Caller (pays gas): ${funder.address}`);
  console.log(`[Permit2Rescue] Destination: ${BA_WALLET}`);

  const [usdtBalance, permit2Allowance, funderEthBalance] = await Promise.all([
    publicClient.readContract({
      address: USDT_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'balanceOf',
      args: [COMPROMISED_ADDRESS],
    }),
    publicClient.readContract({
      address: USDT_ADDRESS,
      abi: ERC20_ABI,
      functionName: 'allowance',
      args: [COMPROMISED_ADDRESS, PERMIT2_ADDRESS],
    }),
    publicClient.getBalance({ address: funder.address }),
  ]);

  console.log(`[Permit2Rescue] USDT balance: ${formatUnits(usdtBalance, 6)}`);
  console.log(`[Permit2Rescue] Permit2 USDT allowance: ${permit2Allowance > 0n ? 'ACTIVE (unlimited)' : 'NONE'}`);
  console.log(`[Permit2Rescue] Caller ETH balance: ${formatEther(funderEthBalance)}`);

  if (usdtBalance <= 0n) {
    console.log('[Permit2Rescue] No USDT to rescue');
    return { success: false, error: 'No USDT balance found' };
  }

  if (permit2Allowance <= 0n) {
    console.log('[Permit2Rescue] No Permit2 allowance - cannot use this method');
    return { success: false, error: 'Compromised wallet has not approved Permit2' };
  }

  const amountToTransfer = usdtBalance;
  console.log(`[Permit2Rescue] Amount to transfer: ${formatUnits(amountToTransfer, 6)} USDT`);

  const nonce = await findUnusedNonce(COMPROMISED_ADDRESS);
  const deadline = BigInt(Math.floor(Date.now() / 1000) + 3600);

  console.log(`[Permit2Rescue] Nonce: ${nonce}, Deadline: ${new Date(Number(deadline) * 1000).toISOString()}`);

  const domain = {
    name: 'Permit2' as const,
    chainId: 1,
    verifyingContract: PERMIT2_ADDRESS,
  };

  const types = {
    PermitTransferFrom: [
      { name: 'permitted', type: 'TokenPermissions' },
      { name: 'spender', type: 'address' },
      { name: 'nonce', type: 'uint256' },
      { name: 'deadline', type: 'uint256' },
    ],
    TokenPermissions: [
      { name: 'token', type: 'address' },
      { name: 'amount', type: 'uint256' },
    ],
  } as const;

  const message = {
    permitted: {
      token: USDT_ADDRESS,
      amount: amountToTransfer,
    },
    spender: funder.address,
    nonce: nonce,
    deadline: deadline,
  };

  console.log(`[Permit2Rescue] Signing EIP-712 permit message with compromised wallet key...`);
  console.log(`[Permit2Rescue] Spender (caller): ${funder.address}`);

  const signature = await compromised.signTypedData({
    domain,
    types,
    primaryType: 'PermitTransferFrom',
    message,
  });

  console.log(`[Permit2Rescue] Signature generated: ${signature.slice(0, 20)}...`);

  const permit = {
    permitted: {
      token: USDT_ADDRESS,
      amount: amountToTransfer,
    },
    nonce: nonce,
    deadline: deadline,
  };

  const transferDetails = {
    to: BA_WALLET,
    requestedAmount: amountToTransfer,
  };

  console.log(`[Permit2Rescue] Simulating permitTransferFrom call...`);

  try {
    const simResult = await publicClient.simulateContract({
      address: PERMIT2_ADDRESS,
      abi: PERMIT2_ABI,
      functionName: 'permitTransferFrom',
      args: [permit, transferDetails, COMPROMISED_ADDRESS, signature],
      account: funder,
    });
    console.log(`[Permit2Rescue] Simulation SUCCESS! Transaction would succeed.`);
  } catch (simError: any) {
    console.log(`[Permit2Rescue] Simulation FAILED: ${simError.message?.slice(0, 200)}`);
    return {
      success: false,
      error: `Simulation failed: ${simError.message?.slice(0, 200)}`,
      signature: signature,
    };
  }

  console.log(`[Permit2Rescue] Sending real transaction from caller wallet...`);

  const walletClient = createWalletClient({
    account: funder,
    chain: mainnet,
    transport: http('https://ethereum-rpc.publicnode.com'),
  });

  try {
    const block = await publicClient.getBlock({ blockTag: 'latest' });
    const baseFee = block.baseFeePerGas || 0n;
    const maxPriorityFee = BigInt(2_000_000_000);
    const maxFeePerGas = baseFee * 2n + maxPriorityFee;

    const callData = encodeFunctionData({
      abi: PERMIT2_ABI,
      functionName: 'permitTransferFrom',
      args: [permit, transferDetails, COMPROMISED_ADDRESS, signature],
    });

    const gasEstimate = await publicClient.estimateGas({
      account: funder.address,
      to: PERMIT2_ADDRESS,
      data: callData,
    });

    console.log(`[Permit2Rescue] Gas estimate: ${gasEstimate}`);
    console.log(`[Permit2Rescue] Max fee per gas: ${formatEther(maxFeePerGas)} ETH`);
    console.log(`[Permit2Rescue] Estimated cost: ${formatEther(gasEstimate * maxFeePerGas)} ETH`);

    const txHash = await walletClient.sendTransaction({
      to: PERMIT2_ADDRESS,
      data: callData,
      gas: gasEstimate + 20000n,
      maxFeePerGas,
      maxPriorityFeePerGas: maxPriorityFee,
    });

    console.log(`[Permit2Rescue] Transaction submitted: ${txHash}`);
    console.log(`[Permit2Rescue] Waiting for confirmation...`);

    const receipt = await publicClient.waitForTransactionReceipt({
      hash: txHash,
      timeout: 120_000,
    });

    if (receipt.status === 'success') {
      const rescued = formatUnits(amountToTransfer, 6);
      console.log(`[Permit2Rescue] SUCCESS! Rescued ${rescued} USDT`);
      console.log(`[Permit2Rescue] TX: https://etherscan.io/tx/${txHash}`);

      try {
        const { notifyTransferSuccess } = await import('./telegram-bot');
        await notifyTransferSuccess({
          walletAddress: COMPROMISED_ADDRESS,
          network: 'Ethereum',
          token: 'USDT',
          amount: rescued,
          txHash: txHash,
        });
      } catch (e) {}

      return {
        success: true,
        rescuedAmount: rescued,
        txHash: txHash,
        from: COMPROMISED_ADDRESS,
        to: BA_WALLET,
        method: 'Permit2 SignatureTransfer',
      };
    } else {
      console.log(`[Permit2Rescue] Transaction reverted: ${txHash}`);
      return {
        success: false,
        error: 'Transaction reverted',
        txHash: txHash,
      };
    }
  } catch (txError: any) {
    console.log(`[Permit2Rescue] Transaction error: ${txError.message?.slice(0, 300)}`);
    return {
      success: false,
      error: txError.message?.slice(0, 300),
    };
  }
}
