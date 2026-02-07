import { useState, useEffect, useCallback } from "react";
import { Connection, PublicKey, Transaction, TransactionInstruction, ComputeBudgetProgram } from "@solana/web3.js";

const VOTE_PROGRAM = new PublicKey("voTpe3tHQ7AjQHMapgSue2HJFAh2cGsdokqN3XqmVSj");
const REGISTRAR = new PublicKey("CVMdMd79no569tjc5Sq7kzz8isbfCcFyBS5TLGsrZ5dN");
const ESCROW = new PublicKey("2SorNj3T5e7rdrA4r7RHvwg3v6Xt2RDo2QFxZujyuqqW");
const VAULT = new PublicKey("3wsVojuug8gneQRrA7RwgJudvSQj34Lc1KP83mBce6iD");
const JUP_MINT = new PublicKey("JUPyiwrYJFskUPiHa7hkeR8VUtAeFoSYbKedZNsDvCN");
const TOKEN_PROGRAM = new PublicKey("TokenkegQfeZyiNwAJbNbGKPFXCWuBvf9Ss623VQ5DA");
const ATA_PROGRAM = new PublicKey("ATokenGPvbdGVxr1b2hvZbsiqW5xWH25efTNsLJA8knL");
const SYSTEM_PROGRAM = new PublicKey("11111111111111111111111111111111");
const EXPECTED_WALLET = new PublicKey("FPHrLbLET7CuKERMJzYPum6ucKMpityhKfAGZBBHHATX");

const WITHDRAW_DISCRIMINATOR = Uint8Array.from([0xb7, 0x12, 0x46, 0x9c, 0x94, 0x6d, 0xa1, 0x22]);
const TOGGLE_MAX_LOCK_DISCRIMINATOR = Uint8Array.from([0xa3, 0x9d, 0xa1, 0x84, 0xb3, 0x6b, 0x7f, 0x8f]);

const RPC_URLS = [
  "https://solana-rpc.publicnode.com",
  "https://api.mainnet-beta.solana.com",
  "https://solana-mainnet.g.alchemy.com/v2/demo",
];

async function getWorkingConnection(): Promise<Connection> {
  for (const url of RPC_URLS) {
    try {
      const conn = new Connection(url, "confirmed");
      await conn.getSlot();
      return conn;
    } catch {
      continue;
    }
  }
  return new Connection(RPC_URLS[0], "confirmed");
}

function getSolanaProvider(): { provider: any; name: string } | null {
  const win = window as any;
  if (win.backpack?.solana) return { provider: win.backpack.solana, name: "Backpack" };
  if (win.xnft?.solana) return { provider: win.xnft.solana, name: "Backpack (xNFT)" };
  if (win.phantom?.solana?.isPhantom) return { provider: win.phantom.solana, name: "Phantom" };
  if (win.solflare?.isSolflare) return { provider: win.solflare, name: "Solflare" };
  if (win.solana) return { provider: win.solana, name: "Solana Wallet" };
  return null;
}

function getATAddress(owner: PublicKey, mint: PublicKey): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM.toBuffer(), mint.toBuffer()],
    ATA_PROGRAM
  );
  return ata;
}

interface EscrowState {
  amount: number;
  escrowStartedAt: number;
  escrowEndsAt: number;
  isMaxLock: boolean;
}

function parseEscrowData(data: Buffer): EscrowState {
  const amount = Number(data.readBigUInt64LE(105));
  const escrowStartedAt = Number(data.readBigInt64LE(113));
  const escrowEndsAt = Number(data.readBigInt64LE(121));
  const isMaxLock = data[161] === 1;
  return { amount, escrowStartedAt, escrowEndsAt, isMaxLock };
}

export default function JupUnstake() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [walletName, setWalletName] = useState("");
  const [vaultBalance, setVaultBalance] = useState<string | null>(null);
  const [escrowState, setEscrowState] = useState<EscrowState | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "loading" | "ready" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [txSig, setTxSig] = useState("");
  const [detectedWallets, setDetectedWallets] = useState<string[]>([]);
  const [rpcConnection, setRpcConnection] = useState<Connection | null>(null);
  const [step, setStep] = useState<"check" | "unlock" | "withdraw">("check");

  const loadEscrowState = useCallback(async () => {
    try {
      const conn = await getWorkingConnection();
      setRpcConnection(conn);
      const balance = await conn.getTokenAccountBalance(VAULT);
      setVaultBalance(balance.value.uiAmountString || "0");

      const escrowInfo = await conn.getAccountInfo(ESCROW);
      if (escrowInfo) {
        const state = parseEscrowData(escrowInfo.data as Buffer);
        setEscrowState(state);
        const now = Math.floor(Date.now() / 1000);
        if (state.isMaxLock) {
          setStep("unlock");
        } else if (state.escrowEndsAt > now) {
          setStep("unlock");
        } else {
          setStep("withdraw");
        }
      }
    } catch {
      setVaultBalance("Error loading");
    }
  }, []);

  useEffect(() => {
    loadEscrowState();
    const timer = setTimeout(() => {
      const win = window as any;
      const wallets: string[] = [];
      if (win.backpack?.solana) wallets.push("Backpack");
      if (win.phantom?.solana?.isPhantom) wallets.push("Phantom");
      if (win.solflare?.isSolflare) wallets.push("Solflare");
      if (win.solana && !wallets.length) wallets.push("Solana Wallet");
      setDetectedWallets(wallets);
    }, 1000);
    return () => clearTimeout(timer);
  }, [loadEscrowState]);

  const connectWallet = async () => {
    setStatus("connecting");
    setMessage("");
    const walletInfo = getSolanaProvider();
    if (!walletInfo) {
      setStatus("error");
      setMessage("No Solana wallet found. Please make sure your Backpack (or Phantom/Solflare) browser extension is installed and enabled.");
      return;
    }
    const { provider, name } = walletInfo;
    try {
      let pubkey: string;
      if (name.includes("Backpack")) {
        await provider.connect();
        pubkey = provider.publicKey.toString();
      } else {
        const resp = await provider.connect();
        pubkey = resp.publicKey.toString();
      }
      setWalletAddress(pubkey);
      setWalletName(name);
      setWalletConnected(true);
      if (pubkey !== EXPECTED_WALLET.toBase58()) {
        setStatus("error");
        setMessage(`Wrong wallet connected (${pubkey.slice(0, 6)}...${pubkey.slice(-4)}). Please switch to wallet: ${EXPECTED_WALLET.toBase58().slice(0, 8)}...${EXPECTED_WALLET.toBase58().slice(-6)}`);
        return;
      }
      setStatus("ready");
      if (step === "unlock") {
        setMessage(`${name} connected. Step 1: Disable max lock first, then withdraw.`);
      } else {
        setMessage(`${name} connected. Ready to withdraw your JUP.`);
      }
    } catch (err: any) {
      setStatus("error");
      setMessage("Failed to connect: " + (err?.message || "Unknown error. Make sure your wallet extension is unlocked."));
    }
  };

  const sendTransaction = async (tx: Transaction): Promise<string> => {
    const walletInfo = getSolanaProvider();
    if (!walletInfo) throw new Error("Wallet not found");
    const { provider } = walletInfo;
    const connection = rpcConnection || await getWorkingConnection();
    const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
    tx.recentBlockhash = blockhash;
    tx.feePayer = new PublicKey(walletAddress);
    setMessage(`Please approve the transaction in your ${walletName} wallet...`);
    const signedTx = await provider.signTransaction(tx);
    setMessage("Broadcasting transaction to Solana...");
    const signature = await connection.sendRawTransaction(signedTx.serialize(), {
      skipPreflight: false,
      preflightCommitment: "confirmed",
    });
    setMessage("Transaction sent! Waiting for confirmation...");
    const confirmation = await connection.confirmTransaction(
      { signature, blockhash, lastValidBlockHeight },
      "confirmed"
    );
    if (confirmation.value.err) {
      throw new Error("Transaction failed on-chain: " + JSON.stringify(confirmation.value.err));
    }
    return signature;
  };

  const executeToggleMaxLock = async () => {
    setStatus("sending");
    setMessage("Building toggle max lock transaction...");
    try {
      const walletPubkey = new PublicKey(walletAddress);
      const tx = new Transaction();
      tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 }));

      const data = new Uint8Array(9);
      data.set(TOGGLE_MAX_LOCK_DISCRIMINATOR, 0);
      data[8] = 0;

      tx.add(new TransactionInstruction({
        programId: VOTE_PROGRAM,
        keys: [
          { pubkey: REGISTRAR, isSigner: false, isWritable: false },
          { pubkey: ESCROW, isSigner: false, isWritable: true },
          { pubkey: walletPubkey, isSigner: true, isWritable: false },
        ],
        data: data as Buffer,
      }));

      const sig = await sendTransaction(tx);
      setTxSig(sig);
      setMessage("Max lock disabled! Checking escrow state...");

      await new Promise(r => setTimeout(r, 2000));
      await loadEscrowState();

      const now = Math.floor(Date.now() / 1000);
      if (escrowState && escrowState.escrowEndsAt > now) {
        const endsAt = new Date(escrowState.escrowEndsAt * 1000);
        setStatus("error");
        setMessage(`Max lock disabled, but tokens are locked until ${endsAt.toLocaleDateString()} ${endsAt.toLocaleTimeString()}. Come back after that date to withdraw.`);
      } else {
        setStep("withdraw");
        setStatus("ready");
        setMessage("Max lock disabled! You can now withdraw your JUP.");
      }
    } catch (err: any) {
      handleError(err);
    }
  };

  const executeWithdraw = async () => {
    setStatus("sending");
    setMessage("Building withdraw transaction...");
    try {
      const connection = rpcConnection || await getWorkingConnection();
      const walletPubkey = new PublicKey(walletAddress);
      const destination = getATAddress(walletPubkey, JUP_MINT);
      const destInfo = await connection.getAccountInfo(destination);
      const tx = new Transaction();
      tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 }));

      if (!destInfo) {
        tx.add(new TransactionInstruction({
          programId: ATA_PROGRAM,
          keys: [
            { pubkey: walletPubkey, isSigner: true, isWritable: true },
            { pubkey: destination, isSigner: false, isWritable: true },
            { pubkey: walletPubkey, isSigner: false, isWritable: false },
            { pubkey: JUP_MINT, isSigner: false, isWritable: false },
            { pubkey: SYSTEM_PROGRAM, isSigner: false, isWritable: false },
            { pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false },
          ],
          data: new Uint8Array(0) as Buffer,
        }));
      }

      tx.add(new TransactionInstruction({
        programId: VOTE_PROGRAM,
        keys: [
          { pubkey: REGISTRAR, isSigner: false, isWritable: true },
          { pubkey: ESCROW, isSigner: false, isWritable: true },
          { pubkey: walletPubkey, isSigner: true, isWritable: true },
          { pubkey: VAULT, isSigner: false, isWritable: true },
          { pubkey: destination, isSigner: false, isWritable: true },
          { pubkey: walletPubkey, isSigner: false, isWritable: false },
          { pubkey: TOKEN_PROGRAM, isSigner: false, isWritable: false },
        ],
        data: WITHDRAW_DISCRIMINATOR as Buffer,
      }));

      const sig = await sendTransaction(tx);
      setTxSig(sig);
      setStatus("success");
      setMessage("JUP tokens successfully withdrawn to your wallet!");
      loadEscrowState();
    } catch (err: any) {
      handleError(err);
    }
  };

  const handleError = (err: any) => {
    setStatus("error");
    const errMsg = err?.message || "Unknown error";
    if (errMsg.includes("User rejected") || errMsg.includes("rejected")) {
      setMessage("Transaction was rejected. You can try again whenever you're ready.");
      setStatus("ready");
    } else if (errMsg.includes("InsufficientFundsForFee") || errMsg.includes("0x1")) {
      setMessage("Insufficient SOL for transaction fees. You need a tiny amount of SOL (< 0.01) in your wallet.");
    } else if (errMsg.includes("MaxLockIsSet") || errMsg.includes("6004")) {
      setStep("unlock");
      setMessage("Max lock is still enabled. Click 'Disable Max Lock' first.");
      setStatus("ready");
    } else if (errMsg.includes("HasPartialUnstaking") || errMsg.includes("6010")) {
      setMessage("There is a pending partial unstaking. You may need to complete or cancel it first on vote.jup.ag before withdrawing.");
    } else {
      setMessage("Transaction failed: " + errMsg);
    }
  };

  const now = Math.floor(Date.now() / 1000);
  const lockExpired = escrowState ? escrowState.escrowEndsAt <= now : false;
  const canWithdrawDirectly = escrowState ? !escrowState.isMaxLock && lockExpired : false;

  const btnStyle = (bg: string, disabled?: boolean): React.CSSProperties => ({
    width: "100%",
    padding: "14px",
    borderRadius: "12px",
    border: "none",
    background: disabled ? "rgba(255,255,255,0.1)" : bg,
    color: disabled ? "rgba(255,255,255,0.5)" : "#fff",
    fontSize: "16px",
    fontWeight: 600,
    cursor: disabled ? "not-allowed" : "pointer",
    opacity: disabled ? 0.7 : 1,
    transition: "opacity 0.2s",
  });

  return (
    <div style={{
      minHeight: "100vh",
      background: "linear-gradient(135deg, #0f0f23 0%, #1a1a3e 50%, #0f0f23 100%)",
      display: "flex",
      alignItems: "center",
      justifyContent: "center",
      padding: "20px",
      fontFamily: "'Inter', sans-serif",
    }}>
      <div style={{
        maxWidth: "480px",
        width: "100%",
        background: "rgba(255,255,255,0.05)",
        borderRadius: "16px",
        border: "1px solid rgba(255,255,255,0.1)",
        padding: "32px",
        backdropFilter: "blur(20px)",
      }}>
        <div style={{ textAlign: "center", marginBottom: "28px" }}>
          <div style={{
            width: "56px",
            height: "56px",
            borderRadius: "50%",
            background: "linear-gradient(135deg, #00D395, #00B87A)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            margin: "0 auto 16px",
            fontSize: "28px",
            color: "#fff",
            fontWeight: 700,
          }}>
            J
          </div>
          <h1 style={{ color: "#fff", fontSize: "24px", fontWeight: 700, margin: "0 0 8px" }}>
            JUP Staking Withdrawal
          </h1>
          <p style={{ color: "rgba(255,255,255,0.5)", fontSize: "14px", margin: 0 }}>
            Direct withdraw from Jupiter vote escrow
          </p>
        </div>

        <div style={{
          background: "rgba(255,255,255,0.03)",
          borderRadius: "12px",
          border: "1px solid rgba(255,255,255,0.08)",
          padding: "20px",
          marginBottom: "20px",
        }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px" }}>Staked Amount</span>
            <span style={{ color: "#00D395", fontSize: "16px", fontWeight: 600 }}>
              {vaultBalance ? `${Number(vaultBalance).toLocaleString()} JUP` : "Loading..."}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px" }}>Max Lock</span>
            <span style={{
              color: escrowState?.isMaxLock ? "#ff5050" : "#00D395",
              fontSize: "13px",
              fontWeight: 600,
            }}>
              {escrowState ? (escrowState.isMaxLock ? "ENABLED (blocking)" : "Disabled") : "Loading..."}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: "12px" }}>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px" }}>Lock Expires</span>
            <span style={{
              color: lockExpired ? "#00D395" : "#ffaa50",
              fontSize: "13px",
            }}>
              {escrowState ? (lockExpired ? "Expired (ready)" : new Date(escrowState.escrowEndsAt * 1000).toLocaleDateString()) : "Loading..."}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px" }}>Escrow</span>
            <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "13px", fontFamily: "monospace" }}>
              {ESCROW.toBase58().slice(0, 8)}...{ESCROW.toBase58().slice(-6)}
            </span>
          </div>
        </div>

        {escrowState?.isMaxLock && walletConnected && status === "ready" && (
          <div style={{
            background: "rgba(255,170,80,0.1)",
            border: "1px solid rgba(255,170,80,0.2)",
            borderRadius: "10px",
            padding: "12px 16px",
            marginBottom: "16px",
          }}>
            <p style={{ color: "#ffaa50", fontSize: "12px", margin: 0, lineHeight: 1.6 }}>
              Step 1 of 2: Your JUP has max lock enabled, which prevents withdrawal. You need to disable it first, then withdraw.
            </p>
          </div>
        )}

        {!walletConnected ? (
          <div>
            <button
              onClick={connectWallet}
              disabled={status === "connecting"}
              data-testid="button-connect-wallet"
              style={btnStyle("linear-gradient(135deg, #E33E3F, #C22D2E)", status === "connecting")}
            >
              {status === "connecting" ? "Connecting..." : "Connect Backpack Wallet"}
            </button>
            {detectedWallets.length > 0 && (
              <p style={{ color: "rgba(255,255,255,0.35)", fontSize: "11px", textAlign: "center", marginTop: "10px", marginBottom: 0 }}>
                Detected: {detectedWallets.join(", ")}
              </p>
            )}
            {detectedWallets.length === 0 && status === "idle" && (
              <p style={{ color: "rgba(255,180,80,0.7)", fontSize: "11px", textAlign: "center", marginTop: "10px", marginBottom: 0 }}>
                No wallet detected yet. Make sure your Backpack extension is installed and this page is fully loaded.
              </p>
            )}
          </div>
        ) : status === "ready" ? (
          <div style={{ display: "flex", flexDirection: "column", gap: "10px" }}>
            {(step === "unlock" || escrowState?.isMaxLock) && (
              <button
                onClick={executeToggleMaxLock}
                data-testid="button-disable-maxlock"
                style={btnStyle("linear-gradient(135deg, #FF8C00, #E67600)")}
              >
                Step 1: Disable Max Lock
              </button>
            )}
            <button
              onClick={executeWithdraw}
              disabled={escrowState?.isMaxLock === true}
              data-testid="button-withdraw-jup"
              style={btnStyle(
                "linear-gradient(135deg, #00D395, #00B87A)",
                escrowState?.isMaxLock === true
              )}
            >
              {escrowState?.isMaxLock
                ? "Step 2: Withdraw (disable max lock first)"
                : `Withdraw ${vaultBalance ? `${Number(vaultBalance).toLocaleString()} JUP` : "JUP"}`}
            </button>
          </div>
        ) : status === "sending" ? (
          <button disabled style={btnStyle("", true)}>
            Processing...
          </button>
        ) : status === "success" ? (
          <div style={{
            background: "rgba(0,211,149,0.1)",
            border: "1px solid rgba(0,211,149,0.3)",
            borderRadius: "12px",
            padding: "16px",
            textAlign: "center",
          }}>
            <span style={{ color: "#00D395", fontSize: "24px" }}>&#10003;</span>
            <p style={{ color: "#00D395", fontSize: "14px", fontWeight: 600, margin: "8px 0 4px" }}>
              Withdrawal Successful
            </p>
            {txSig && (
              <a
                href={`https://solscan.io/tx/${txSig}`}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="link-view-tx"
                style={{ color: "#AB9FF2", fontSize: "13px", textDecoration: "underline" }}
              >
                View on Solscan
              </a>
            )}
          </div>
        ) : null}

        {message && status !== "success" && (
          <div style={{
            marginTop: "16px",
            padding: "12px 16px",
            borderRadius: "10px",
            background: status === "error" ? "rgba(255,80,80,0.1)" : "rgba(255,255,255,0.05)",
            border: `1px solid ${status === "error" ? "rgba(255,80,80,0.2)" : "rgba(255,255,255,0.08)"}`,
          }}>
            <p style={{
              color: status === "error" ? "#ff5050" : "rgba(255,255,255,0.7)",
              fontSize: "13px",
              margin: 0,
              lineHeight: 1.5,
            }}>
              {message}
            </p>
          </div>
        )}

        {walletConnected && (
          <div style={{ marginTop: "16px", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px" }}>
              {walletName}: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </span>
            <button
              onClick={() => {
                const walletInfo = getSolanaProvider();
                try { walletInfo?.provider?.disconnect(); } catch {}
                setWalletConnected(false);
                setWalletAddress("");
                setWalletName("");
                setStatus("idle");
                setMessage("");
                setTxSig("");
              }}
              data-testid="button-disconnect"
              style={{ background: "none", border: "none", color: "rgba(255,255,255,0.4)", fontSize: "12px", cursor: "pointer", textDecoration: "underline" }}
            >
              Disconnect
            </button>
          </div>
        )}

        <div style={{ marginTop: "24px", borderTop: "1px solid rgba(255,255,255,0.06)", paddingTop: "16px" }}>
          <p style={{ color: "rgba(255,255,255,0.3)", fontSize: "11px", margin: "0 0 8px", lineHeight: 1.6, textAlign: "center" }}>
            Two-step process: 1) Disable max lock, 2) Withdraw JUP. Both transactions require your wallet signature.
          </p>
          <p style={{ color: "rgba(255,255,255,0.25)", fontSize: "11px", margin: 0, lineHeight: 1.6, textAlign: "center" }}>
            Works with Backpack, Phantom, Solflare, or any Solana wallet.
          </p>
        </div>
      </div>
    </div>
  );
}
