/**
 * utils.ts — small helpers shared by all scripts.
 * Think of this as the "toolbox" every other script borrows from.
 */
import { Connection, Keypair } from "@solana/web3.js";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { DECIMALS } from "./config";

dotenv.config();

export const KEYS_DIR = path.join(__dirname, "..", "keys");
export const WALLET_PATH = path.join(KEYS_DIR, "devnet-wallet.json");
export const MINT_PATH = path.join(KEYS_DIR, "mint-address.txt");
export const TOKEN_ACCOUNTS_PATH = path.join(KEYS_DIR, "token-accounts.json");

/**
 * The unforgeable fingerprint of the devnet chain. Every Solana cluster has a
 * unique "genesis hash" (the ID of its very first block) — mainnet, testnet
 * and devnet all differ, and no RPC URL trickery can fake it.
 * Verified against https://api.devnet.solana.com on 2026-07-06.
 */
export const DEVNET_GENESIS_HASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";

/** Is this a local test validator address? (Its genesis hash is random, so we skip that check.) */
export function isLocalhostUrl(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return host === "localhost" || host === "127.0.0.1";
  } catch {
    return false;
  }
}

/**
 * Pure, testable core of the interlock: does this RPC URL point somewhere safe?
 *
 * We parse the URL and look at the HOSTNAME only. The old check searched the
 * whole URL string, so `https://mainnet-rpc.example.com/?key=devnet` (magic
 * word in the query) or `https://evil-localhost.com` (sound-alike hostname)
 * would have passed. Now: localhost must match exactly, and "devnet" must
 * appear inside a hostname label (api.devnet.solana.com, devnet.helius-rpc.com,
 * solana-devnet.g.alchemy.com — all fine). Unparseable URLs are refused:
 * not provably safe = not safe.
 */
export function isSafeRpcUrl(url: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    return false;
  }
  const host = parsed.hostname.toLowerCase();
  if (host === "localhost" || host === "127.0.0.1") return true;
  return host.split(".").some((label) => label.includes("devnet"));
}

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

  if (!isSafeRpcUrl(url) && process.env.I_UNDERSTAND_THIS_IS_NOT_DEVNET !== "true") {
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
 * Belt AND suspenders: a hostname can merely SOUND like devnet, so scripts
 * that sign transactions also ask the cluster for its genesis hash and check
 * the fingerprint. Local validators are skipped (each has a random genesis
 * hash), and the explicit .env override skips the check the same way it
 * opens the URL interlock — one override, one decision.
 */
export async function assertDevnet(connection: Connection): Promise<void> {
  if (process.env.I_UNDERSTAND_THIS_IS_NOT_DEVNET === "true") return;
  if (isLocalhostUrl(connection.rpcEndpoint)) return;
  const genesisHash = await connection.getGenesisHash();
  if (genesisHash !== DEVNET_GENESIS_HASH) {
    throw new Error(
      "🛑 This RPC's genesis hash does not match devnet.\n" +
        `Expected ${DEVNET_GENESIS_HASH}\n` +
        `Got      ${genesisHash}\n` +
        "The URL looked safe, but the chain behind it is NOT devnet. Refusing to continue."
    );
  }
}

/**
 * TOKEN ACCOUNT REGISTRY — why we keep our own list.
 *
 * Withheld charity fees sit on the RECIPIENTS' token accounts, so the sweep
 * needs to know every account that ever received PHOCA. Asking the RPC to
 * scan for them (getProgramAccounts / getTokenLargestAccounts) is expensive,
 * and public RPCs disable or heavily rate-limit those calls. So we do what a
 * production system does: remember addresses at the moment we touch them.
 *
 * THE RULE THAT KEEPS IT COMPLETE: every script that creates or uses a token
 * account must call recordTokenAccount for it. If tokens ever move through a
 * path that doesn't record, the sweep will silently miss those fees.
 *
 * The registry lives in keys/ (git-ignored, devnet-local state — same as the
 * mint address). It stores only PUBLIC addresses, never keys.
 */
export function readTokenAccounts(registryPath: string = TOKEN_ACCOUNTS_PATH): string[] {
  if (!fs.existsSync(registryPath)) return [];
  let parsed: unknown;
  try {
    parsed = JSON.parse(fs.readFileSync(registryPath, "utf-8"));
  } catch {
    throw new Error(
      `Token account registry ${registryPath} is not valid JSON. ` +
        "Fix it or delete it (the transfer script will rebuild it as accounts are touched)."
    );
  }
  if (!Array.isArray(parsed) || !parsed.every((x) => typeof x === "string")) {
    throw new Error(
      `Token account registry ${registryPath} should be a JSON array of address strings. ` +
        "Fix it or delete it."
    );
  }
  return parsed;
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
  try {
    const secret = Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")));
    return Keypair.fromSecretKey(secret);
  } catch {
    // Deliberately NO details from inside the file in this message —
    // error text must never leak key material.
    throw new Error(
      `Wallet file ${walletPath} is corrupted — expected a JSON array of numbers. ` +
        "On devnet: delete it and run `npm run wallet` to create a fresh one."
    );
  }
}

/**
 * Format a base-unit amount (bigint) as a human-readable PHOCA string.
 *
 * Why not Number(amount) / 10 ** 9? Because Number silently loses precision
 * above ~9 million PHOCA (2^53 base units) — fine until the day it isn't.
 * BigInt math is exact at any size; this helper is the ONLY approved way to
 * display token amounts.
 */
export function formatPhoca(baseUnits: bigint): string {
  const negative = baseUnits < 0n;
  const abs = negative ? -baseUnits : baseUnits;
  const one = 10n ** BigInt(DECIMALS);
  const whole = abs / one;
  const frac = abs % one;
  let out = whole.toString();
  if (frac > 0n) {
    out += "." + frac.toString().padStart(DECIMALS, "0").replace(/0+$/, "");
  }
  return (negative ? "-" : "") + out;
}
