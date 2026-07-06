/**
 * STEP 1 — Create a devnet wallet and get free test SOL.
 *
 * A "wallet" is just a keypair:
 *   - public key  = your address (safe to share, like an email address)
 *   - private key = the password that controls the money (NEVER share, NEVER commit)
 *
 * We save it into keys/ which is git-ignored. Devnet SOL is worthless play money,
 * but treat keys carefully anyway — build the right habits from day one.
 */
import { Keypair, LAMPORTS_PER_SOL } from "@solana/web3.js";
import * as fs from "fs";
import { getConnection, KEYS_DIR, WALLET_PATH } from "./utils";

async function main() {
  const connection = getConnection();

  let wallet: Keypair;
  if (fs.existsSync(WALLET_PATH)) {
    console.log("Wallet already exists, reusing it.");
    wallet = Keypair.fromSecretKey(
      Uint8Array.from(JSON.parse(fs.readFileSync(WALLET_PATH, "utf-8")))
    );
  } else {
    wallet = Keypair.generate();
    fs.mkdirSync(KEYS_DIR, { recursive: true });
    fs.writeFileSync(WALLET_PATH, JSON.stringify(Array.from(wallet.secretKey)));
    console.log("New devnet wallet created and saved to keys/devnet-wallet.json");
  }

  console.log("Your address:", wallet.publicKey.toBase58());

  // Ask the devnet faucet for 2 free test SOL (sometimes rate-limited — just retry later,
  // or use the web faucet at https://faucet.solana.com)
  try {
    console.log("Requesting 2 devnet SOL from the faucet...");
    const sig = await connection.requestAirdrop(wallet.publicKey, 2 * LAMPORTS_PER_SOL);
    await connection.confirmTransaction(sig, "confirmed");
  } catch (e) {
    console.log("Airdrop failed (faucet is often busy). Try https://faucet.solana.com instead.");
  }

  const balance = await connection.getBalance(wallet.publicKey);
  console.log("Balance:", balance / LAMPORTS_PER_SOL, "SOL");
}

main().catch(console.error);
