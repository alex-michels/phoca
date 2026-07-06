/**
 * utils.ts — small helpers shared by all scripts.
 * Think of this as the "toolbox" every other script borrows from.
 */
import { Connection, Keypair } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";

dotenv.config();

export const KEYS_DIR = path.join(__dirname, "..", "keys");
export const WALLET_PATH = path.join(KEYS_DIR, "devnet-wallet.json");
export const MINT_PATH = path.join(KEYS_DIR, "mint-address.txt");
export const TOKEN_ACCOUNTS_PATH = path.join(KEYS_DIR, "token-accounts.json");

/**
 * Connect to Solana. Defaults to devnet (free test network).
 *
 * SECURITY GUARD: this function REFUSES to connect to anything that isn't
 * devnet/localnet unless you explicitly opt in via .env. This prevents the
 * classic beginner disaster: accidentally running a test script against
 * mainnet with real money. See docs/SECURITY-CHECKLIST.md.
 */
export function getConnection(): Connection {
  const url = process.env.RPC_URL ?? "https://api.devnet.solana.com";
  const isSafeNetwork =
    url.includes("devnet") || url.includes("localhost") || url.includes("127.0.0.1");

  if (!isSafeNetwork && process.env.I_UNDERSTAND_THIS_IS_NOT_DEVNET !== "true") {
    throw new Error(
      "🛑 Refusing to run against a non-devnet RPC.\n" +
        "These are learning scripts. If you REALLY intend this (e.g. a reviewed, " +
        "deliberate mainnet deployment), set I_UNDERSTAND_THIS_IS_NOT_DEVNET=true " +
        "in .env and re-read docs/SECURITY-CHECKLIST.md first."
    );
  }
  // "confirmed" = wait until the network has reasonably accepted our transaction
  return new Connection(url, "confirmed");
}

/**
 * TOKEN ACCOUNT REGISTRY — why we keep our own list.
 *
 * Withheld charity fees sit on the RECIPIENTS' token accounts, so the sweep
 * needs to know every account that ever received PHOCA. Asking the RPC to
 * scan for them (getProgramAccounts / getTokenLargestAccounts) is expensive,
 * and public RPCs disable or heavily rate-limit those calls. So we do what a
 * production system does: remember addresses at the moment we touch them.
 * The registry lives in keys/ (git-ignored, devnet-local state — same as the
 * mint address). It stores only PUBLIC addresses, never keys.
 */
export function readTokenAccounts(registryPath: string = TOKEN_ACCOUNTS_PATH): string[] {
  if (!fs.existsSync(registryPath)) return [];
  return JSON.parse(fs.readFileSync(registryPath, "utf-8"));
}

/** Add a token account address to the registry (deduplicated). */
export function recordTokenAccount(
  address: string,
  registryPath: string = TOKEN_ACCOUNTS_PATH
): void {
  const list = readTokenAccounts(registryPath);
  if (!list.includes(address)) {
    list.push(address);
    fs.mkdirSync(path.dirname(registryPath), { recursive: true });
    fs.writeFileSync(registryPath, JSON.stringify(list, null, 2));
  }
}

/**
 * Load the wallet created by 01-create-wallet.ts.
 * The path parameter exists so tests can point at a temporary file —
 * every real script simply calls loadWallet() and gets the default.
 */
export function loadWallet(walletPath: string = WALLET_PATH): Keypair {
  if (!fs.existsSync(walletPath)) {
    throw new Error("No wallet found. Run `npm run wallet` first.");
  }
  const secret = Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")));
  return Keypair.fromSecretKey(secret);
}
