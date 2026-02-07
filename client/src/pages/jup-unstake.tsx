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

const RPC_URL = "https://api.mainnet-beta.solana.com";

function getPhantomProvider(): any {
  if ("phantom" in window) {
    const provider = (window as any).phantom?.solana;
    if (provider?.isPhantom) return provider;
  }
  return null;
}

function getATAddress(owner: PublicKey, mint: PublicKey): PublicKey {
  const [ata] = PublicKey.findProgramAddressSync(
    [owner.toBuffer(), TOKEN_PROGRAM.toBuffer(), mint.toBuffer()],
    ATA_PROGRAM
  );
  return ata;
}

export default function JupUnstake() {
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState("");
  const [vaultBalance, setVaultBalance] = useState<string | null>(null);
  const [status, setStatus] = useState<"idle" | "connecting" | "loading" | "ready" | "sending" | "success" | "error">("idle");
  const [message, setMessage] = useState("");
  const [txSig, setTxSig] = useState("");

  const connection = new Connection(RPC_URL, "confirmed");

  const loadVaultBalance = useCallback(async () => {
    try {
      const balance = await connection.getTokenAccountBalance(VAULT);
      setVaultBalance(balance.value.uiAmountString || "0");
    } catch {
      setVaultBalance("Error loading");
    }
  }, []);

  useEffect(() => {
    loadVaultBalance();
  }, [loadVaultBalance]);

  const connectWallet = async () => {
    setStatus("connecting");
    setMessage("");
    const provider = getPhantomProvider();
    if (!provider) {
      setStatus("error");
      setMessage("Phantom wallet not found. Please install the Phantom browser extension.");
      return;
    }
    try {
      const resp = await provider.connect();
      const pubkey = resp.publicKey.toString();
      setWalletAddress(pubkey);
      setWalletConnected(true);

      if (pubkey !== EXPECTED_WALLET.toBase58()) {
        setStatus("error");
        setMessage(`Wrong wallet connected. Please connect wallet: ${EXPECTED_WALLET.toBase58().slice(0, 8)}...${EXPECTED_WALLET.toBase58().slice(-6)}`);
        return;
      }

      setStatus("ready");
      setMessage("Wallet connected. Ready to withdraw your JUP.");
    } catch (err: any) {
      setStatus("error");
      setMessage("Failed to connect wallet: " + (err?.message || "Unknown error"));
    }
  };

  const executeWithdraw = async () => {
    setStatus("sending");
    setMessage("Building withdraw transaction...");

    const provider = getPhantomProvider();
    if (!provider) {
      setStatus("error");
      setMessage("Phantom wallet not found.");
      return;
    }

    try {
      const walletPubkey = new PublicKey(walletAddress);
      const destination = getATAddress(walletPubkey, JUP_MINT);

      const destInfo = await connection.getAccountInfo(destination);

      const tx = new Transaction();

      tx.add(ComputeBudgetProgram.setComputeUnitPrice({ microLamports: 50000 }));

      if (!destInfo) {
        tx.add(
          new TransactionInstruction({
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
          })
        );
      }

      const withdrawIx = new TransactionInstruction({
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
      });

      tx.add(withdrawIx);

      const { blockhash, lastValidBlockHeight } = await connection.getLatestBlockhash("confirmed");
      tx.recentBlockhash = blockhash;
      tx.feePayer = walletPubkey;

      setMessage("Please approve the transaction in your Phantom wallet...");

      const signedTx = await provider.signTransaction(tx);
      
      setMessage("Broadcasting transaction to the Solana network...");
      
      const signature = await connection.sendRawTransaction(signedTx.serialize(), {
        skipPreflight: false,
        preflightCommitment: "confirmed",
      });

      setMessage("Transaction sent. Waiting for confirmation...");

      const confirmation = await connection.confirmTransaction(
        { signature, blockhash, lastValidBlockHeight },
        "confirmed"
      );

      if (confirmation.value.err) {
        setStatus("error");
        setMessage("Transaction failed on-chain: " + JSON.stringify(confirmation.value.err));
        return;
      }

      setTxSig(signature);
      setStatus("success");
      setMessage("JUP tokens successfully withdrawn to your wallet!");

      loadVaultBalance();
    } catch (err: any) {
      setStatus("error");
      const errMsg = err?.message || "Unknown error";
      if (errMsg.includes("User rejected")) {
        setMessage("Transaction was rejected in your wallet. You can try again.");
        setStatus("ready");
      } else if (errMsg.includes("0x1")) {
        setMessage("Insufficient balance for transaction fees. Make sure you have some SOL for gas.");
      } else if (errMsg.includes("InsufficientUnlockedTokens") || errMsg.includes("0x1772")) {
        setMessage("Tokens are still locked. They may need to go through an unlock/cooldown period first. Try unstaking via vote.jup.ag first to initiate the cooldown.");
      } else {
        setMessage("Transaction failed: " + errMsg);
      }
    }
  };

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
          }}>
            J
          </div>
          <h1 style={{
            color: "#fff",
            fontSize: "24px",
            fontWeight: 700,
            margin: "0 0 8px",
          }}>
            JUP Staking Withdrawal
          </h1>
          <p style={{
            color: "rgba(255,255,255,0.5)",
            fontSize: "14px",
            margin: 0,
          }}>
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
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px" }}>Escrow</span>
            <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "13px", fontFamily: "monospace" }}>
              {ESCROW.toBase58().slice(0, 8)}...{ESCROW.toBase58().slice(-6)}
            </span>
          </div>
          <div style={{ display: "flex", justifyContent: "space-between" }}>
            <span style={{ color: "rgba(255,255,255,0.5)", fontSize: "13px" }}>Vault</span>
            <span style={{ color: "rgba(255,255,255,0.7)", fontSize: "13px", fontFamily: "monospace" }}>
              {VAULT.toBase58().slice(0, 8)}...{VAULT.toBase58().slice(-6)}
            </span>
          </div>
        </div>

        {!walletConnected ? (
          <button
            onClick={connectWallet}
            disabled={status === "connecting"}
            data-testid="button-connect-phantom"
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "12px",
              border: "none",
              background: "linear-gradient(135deg, #AB9FF2, #7B61FF)",
              color: "#fff",
              fontSize: "16px",
              fontWeight: 600,
              cursor: status === "connecting" ? "not-allowed" : "pointer",
              opacity: status === "connecting" ? 0.7 : 1,
              transition: "opacity 0.2s",
            }}
          >
            {status === "connecting" ? "Connecting..." : "Connect Phantom Wallet"}
          </button>
        ) : status === "ready" ? (
          <button
            onClick={executeWithdraw}
            data-testid="button-withdraw-jup"
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "12px",
              border: "none",
              background: "linear-gradient(135deg, #00D395, #00B87A)",
              color: "#fff",
              fontSize: "16px",
              fontWeight: 600,
              cursor: "pointer",
              transition: "opacity 0.2s",
            }}
          >
            Withdraw {vaultBalance ? `${Number(vaultBalance).toLocaleString()} JUP` : "JUP"}
          </button>
        ) : status === "sending" ? (
          <button
            disabled
            style={{
              width: "100%",
              padding: "14px",
              borderRadius: "12px",
              border: "none",
              background: "rgba(255,255,255,0.1)",
              color: "rgba(255,255,255,0.5)",
              fontSize: "16px",
              fontWeight: 600,
              cursor: "not-allowed",
            }}
          >
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
            background: status === "error"
              ? "rgba(255,80,80,0.1)"
              : "rgba(255,255,255,0.05)",
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
          <div style={{
            marginTop: "16px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
          }}>
            <span style={{ color: "rgba(255,255,255,0.4)", fontSize: "12px" }}>
              Connected: {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
            </span>
            <button
              onClick={() => {
                const provider = getPhantomProvider();
                provider?.disconnect();
                setWalletConnected(false);
                setWalletAddress("");
                setStatus("idle");
                setMessage("");
                setTxSig("");
              }}
              data-testid="button-disconnect"
              style={{
                background: "none",
                border: "none",
                color: "rgba(255,255,255,0.4)",
                fontSize: "12px",
                cursor: "pointer",
                textDecoration: "underline",
              }}
            >
              Disconnect
            </button>
          </div>
        )}

        <div style={{
          marginTop: "24px",
          borderTop: "1px solid rgba(255,255,255,0.06)",
          paddingTop: "16px",
        }}>
          <p style={{
            color: "rgba(255,255,255,0.3)",
            fontSize: "11px",
            margin: 0,
            lineHeight: 1.6,
            textAlign: "center",
          }}>
            This sends a Withdraw instruction directly to Jupiter's vote program
            (voTpe3...VSj). Only the escrow owner can sign this transaction.
          </p>
        </div>
      </div>
    </div>
  );
}
