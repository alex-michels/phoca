/**
 * utils.ts — small helpers shared by all scripts.
 * Think of this as the "toolbox" every other script borrows from.
 *
 * Stack: @solana/kit (the modern, zero-dependency Solana SDK by Anza) +
 * @solana-program/token-2022. Migrated from web3.js 1.x per
 * docs/KIT-MIGRATION.md — behavior is identical, proven by the localnet
 * integration gate in CI.
 */
import {
  createSolanaRpc,
  createKeyPairSignerFromBytes,
  createKeyPairSignerFromPrivateKeyBytes,
  getAddressEncoder,
  getBase64EncodedWireTransaction,
  getSignatureFromTransaction,
  createTransactionMessage,
  setTransactionMessageFeePayerSigner,
  setTransactionMessageLifetimeUsingBlockhash,
  appendTransactionMessageInstructions,
  signTransactionMessageWithSigners,
  pipe,
  type Instruction,
  type KeyPairSigner,
  type Option,
} from "@solana/kit";
import { type Extension } from "@solana-program/token-2022";
import * as fs from "fs";
import * as path from "path";
import * as dotenv from "dotenv";
import { DECIMALS, FEE_SPLIT_BPS } from "./config";

dotenv.config();

// PHOCA_KEYS_DIR / PHOCA_TRANSPARENCY_LOG exist for TEST ISOLATION only:
// the localnet integration tests run the REAL scripts against a throwaway
// directory and a throwaway chain, so they can never touch your actual
// devnet wallet, mint file, registry, or the real transparency log.
// Normal runs never set these.
export const KEYS_DIR =
  process.env.PHOCA_KEYS_DIR ?? path.join(__dirname, "..", "keys");
export const WALLET_PATH = path.join(KEYS_DIR, "devnet-wallet.json");
export const MINT_PATH = path.join(KEYS_DIR, "mint-address.txt");
export const TOKEN_ACCOUNTS_PATH = path.join(KEYS_DIR, "token-accounts.json");
export const TRANSPARENCY_LOG_PATH =
  process.env.PHOCA_TRANSPARENCY_LOG ??
  path.join(__dirname, "..", "docs", "TRANSPARENCY-LOG.md");

/**
 * The unforgeable fingerprint of the devnet chain. Every Solana cluster has a
 * unique "genesis hash" (the ID of its very first block) — mainnet, testnet
 * and devnet all differ, and no RPC URL trickery can fake it.
 * Verified against https://api.devnet.solana.com on 2026-07-06.
 */
export const DEVNET_GENESIS_HASH = "EtWTRABZaYq6iMfeYKouRu166VU2xqa1wcaWoxPkrZBG";

/** Our RPC bundle: the kit rpc client plus the URL it points at (kit doesn't expose it). */
export interface RpcContext {
  rpc: ReturnType<typeof createSolanaRpc>;
  url: string;
}

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
 * We parse the URL and look at the HOSTNAME only. A substring check over the
 * whole URL could be fooled by `https://mainnet-rpc.example.com/?key=devnet`
 * (magic word in the query) or `https://evil-localhost.com` (sound-alike
 * hostname). Here: localhost must match exactly, and "devnet" must appear
 * inside a hostname label (api.devnet.solana.com, devnet.helius-rpc.com,
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
export function getRpc(): RpcContext {
  const url = process.env.RPC_URL ?? "https://api.devnet.solana.com";

  if (!isSafeRpcUrl(url) && process.env.I_UNDERSTAND_THIS_IS_NOT_DEVNET !== "true") {
    throw new Error(
      "🛑 Refusing to run against a non-devnet RPC.\n" +
        "These are learning scripts. If you REALLY intend this (e.g. a reviewed, " +
        "deliberate mainnet deployment), set I_UNDERSTAND_THIS_IS_NOT_DEVNET=true " +
        "in .env and re-read docs/SECURITY-CHECKLIST.md first."
    );
  }
  return { rpc: createSolanaRpc(url), url };
}

/**
 * Belt AND suspenders: a hostname can merely SOUND like devnet, so scripts
 * that sign transactions also ask the cluster for its genesis hash and check
 * the fingerprint. Local validators are skipped (each has a random genesis
 * hash), and the explicit .env override skips the check the same way it
 * opens the URL interlock — one override, one decision.
 */
export async function assertDevnet(ctx: RpcContext): Promise<void> {
  if (process.env.I_UNDERSTAND_THIS_IS_NOT_DEVNET === "true") return;
  if (isLocalhostUrl(ctx.url)) return;
  const genesisHash = await ctx.rpc.getGenesisHash().send();
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
 * Build, sign, send and confirm one transaction from a list of instructions.
 * Kit is functional: we assemble a message, every embedded signer signs, and
 * we confirm by polling the signature status (no websockets needed).
 */
export async function sendInstructions(
  ctx: RpcContext,
  payer: KeyPairSigner,
  instructions: Instruction[]
): Promise<string> {
  const { value: latestBlockhash } = await ctx.rpc.getLatestBlockhash().send();
  const message = pipe(
    createTransactionMessage({ version: 0 }),
    (m) => setTransactionMessageFeePayerSigner(payer, m),
    (m) => setTransactionMessageLifetimeUsingBlockhash(latestBlockhash, m),
    (m) => appendTransactionMessageInstructions(instructions, m)
  );
  const signed = await signTransactionMessageWithSigners(message);
  const signature = getSignatureFromTransaction(signed);
  await ctx.rpc
    .sendTransaction(getBase64EncodedWireTransaction(signed), { encoding: "base64" })
    .send();
  await confirmSignature(ctx, signature);
  return signature;
}

/** Poll until the cluster confirms the signature (or give up loudly). */
export async function confirmSignature(ctx: RpcContext, signature: string): Promise<void> {
  for (let attempt = 0; attempt < 60; attempt++) {
    const { value } = await ctx.rpc
      .getSignatureStatuses([signature as Parameters<typeof ctx.rpc.getSignatureStatuses>[0][number]])
      .send();
    const status = value[0];
    if (status) {
      if (status.err) {
        throw new Error(`Transaction ${signature} failed on-chain: ${JSON.stringify(status.err)}`);
      }
      if (status.confirmationStatus === "confirmed" || status.confirmationStatus === "finalized") {
        return;
      }
    }
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error(`Transaction ${signature} was not confirmed in time.`);
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
 * The stored format is the standard 64-byte Solana secret key (32-byte seed
 * followed by the 32-byte public key) — the SAME format as before the kit
 * migration, so existing wallet files keep working unchanged.
 * The path parameter exists so tests can point at a temporary file.
 */
export async function loadWallet(walletPath: string = WALLET_PATH): Promise<KeyPairSigner> {
  if (!fs.existsSync(walletPath)) {
    throw new Error("No wallet found. Run `npm run wallet` first.");
  }
  try {
    const bytes = Uint8Array.from(JSON.parse(fs.readFileSync(walletPath, "utf-8")));
    return await createKeyPairSignerFromBytes(bytes);
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
 * Generate a NEW wallet whose secret can be saved to disk.
 * (Kit's default signers keep keys non-extractable — great for apps, useless
 * for a devnet wallet file — so we generate the 32-byte seed ourselves and
 * store the classic 64-byte seed+pubkey format.)
 */
export async function generatePersistableSigner(): Promise<{
  signer: KeyPairSigner;
  secretBytes: Uint8Array;
}> {
  const seed = new Uint8Array(32);
  crypto.getRandomValues(seed);
  const signer = await createKeyPairSignerFromPrivateKeyBytes(seed);
  const pubkeyBytes = getAddressEncoder().encode(signer.address);
  const secretBytes = new Uint8Array(64);
  secretBytes.set(seed, 0);
  secretBytes.set(new Uint8Array(pubkeyBytes), 32);
  return { signer, secretBytes };
}

/**
 * Load a named treasury wallet from keys/, creating it on first use.
 * Devnet practice for checklist §1 "separate wallets": community and
 * liquidity get their OWN keypairs (keys/treasury-<name>.json, git-ignored),
 * so the split lands in genuinely separate hands — on mainnet these become
 * multisigs with published addresses instead.
 */
export async function loadOrCreateTreasury(
  name: string,
  dir: string = KEYS_DIR
): Promise<KeyPairSigner> {
  const treasuryPath = path.join(dir, `treasury-${name}.json`);
  if (fs.existsSync(treasuryPath)) {
    return loadWallet(treasuryPath);
  }
  const { signer, secretBytes } = await generatePersistableSigner();
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(treasuryPath, JSON.stringify(Array.from(secretBytes)));
  return signer;
}

/**
 * Pull one typed extension out of a fetched Token-2022 account's extension
 * list (mints carry TransferFeeConfig/MetadataPointer/…, token accounts
 * carry TransferFeeAmount with the withheld fees). Extensions arrive as an
 * Option<Array<Extension>> — this unwraps and narrows in one move.
 */
export function findExtension<K extends Extension["__kind"]>(
  extensions: Option<Extension[]>,
  kind: K
): Extract<Extension, { __kind: K }> | undefined {
  if (extensions.__option !== "Some") return undefined;
  return extensions.value.find(
    (e): e is Extract<Extension, { __kind: K }> => e.__kind === kind
  );
}

/** The two fee schedules a Token-2022 mint carries (older/newer, epoch-gated). */
export interface TransferFeeSchedule {
  epoch: bigint;
  maximumFee: bigint;
  transferFeeBasisPoints: number;
}
export interface TransferFeeConfigLike {
  olderTransferFee: TransferFeeSchedule;
  newerTransferFee: TransferFeeSchedule;
}

/**
 * Predict the fee the on-chain program will charge — OUR port of the
 * program's arithmetic (ceiling division, capped), epoch-aware:
 *
 *   fee = ceil(amount × basis_points / 10_000), capped at maximumFee
 *
 * The old stack shipped this as calculateEpochFee; the kit stack doesn't,
 * so we own it — and the fee-math test suite pins it to the exact same
 * behavior (same expectations as before the migration).
 */
export function calculateTransferFee(
  config: TransferFeeConfigLike,
  epoch: bigint,
  amount: bigint
): bigint {
  const fee =
    epoch >= config.newerTransferFee.epoch
      ? config.newerTransferFee
      : config.olderTransferFee;
  const bps = BigInt(fee.transferFeeBasisPoints);
  if (bps === 0n || amount === 0n) return 0n;
  const raw = (amount * bps + 9_999n) / 10_000n;
  return raw > fee.maximumFee ? fee.maximumFee : raw;
}

export interface FeeSplit {
  charity: bigint;
  community: bigint;
  liquidity: bigint;
}

/**
 * Split a swept fee pot into the three treasuries per FEE_SPLIT_BPS.
 *
 * Integer math can't always divide exactly — 101 base units × 25% is 25.25.
 * Policy: community and liquidity round DOWN, and charity takes everything
 * that's left. Every rounding crumb goes to the seals, by design, and the
 * three parts ALWAYS sum to exactly the input — that invariant is tested
 * hard, because "almost adds up" is how treasuries leak.
 * See docs/FEE-SPLIT.md for the full design.
 */
export function splitFee(totalBaseUnits: bigint): FeeSplit {
  if (totalBaseUnits < 0n) {
    throw new Error(`splitFee: negative amount ${totalBaseUnits}`);
  }
  const community = (totalBaseUnits * BigInt(FEE_SPLIT_BPS.community)) / 10_000n;
  const liquidity = (totalBaseUnits * BigInt(FEE_SPLIT_BPS.liquidity)) / 10_000n;
  const charity = totalBaseUnits - community - liquidity;
  return { charity, community, liquidity };
}

/**
 * Split a list into chunks of at most `size` items, preserving order.
 *
 * Why it exists: a Solana transaction has a hard size limit (~1232 bytes),
 * and withdrawWithheldTokensFromAccounts fits only ~25 source accounts per
 * transaction. So the fee sweep processes the registry in batches. Pure
 * function — tested in tests/utils.test.ts.
 */
export function chunk<T>(items: T[], size: number): T[][] {
  if (!Number.isInteger(size) || size < 1) {
    throw new Error(`chunk size must be a positive integer, got ${size}`);
  }
  const out: T[][] = [];
  for (let i = 0; i < items.length; i += size) {
    out.push(items.slice(i, i + size));
  }
  return out;
}

const TRANSPARENCY_LOG_HEADER = `# 🧾 PHOCA transparency log (auto-appended)

Every fee sweep appends an entry here automatically: date, total collected,
how many accounts held fees, and the transaction link(s) — the raw feed for
the monthly transparency report (docs/TRANSPARENCY.md). Entries are written
by \`npm run collect-fees\` and committed via PR like everything else.
Do not edit entries by hand — the unbroken history IS the point.
`;

/** One distribution transfer out of the pot (community/liquidity share). */
export interface SweepDistribution {
  name: string;
  signature: string;
}

/**
 * Render one sweep as a markdown log entry. Pure function (tested).
 * When split/distributions are provided, the entry also records how the pot
 * divided and the transfer for each non-charity share (charity's share stays
 * in the collection treasury — no transfer, no fee; see docs/FEE-SPLIT.md).
 * Explorer links carry ?cluster=devnet — that suffix goes away on mainnet.
 */
export function formatSweepLogEntry(
  dateIso: string,
  totalBaseUnits: bigint,
  accountCount: number,
  signatures: string[],
  split?: FeeSplit,
  distributions?: SweepDistribution[]
): string {
  const txLines = signatures
    .map(
      (sig, i) =>
        `  - batch ${i + 1}: [${sig.slice(0, 8)}…](https://explorer.solana.com/tx/${sig}?cluster=devnet)`
    )
    .join("\n");
  let entry =
    `\n### ${dateIso} — swept ${formatPhoca(totalBaseUnits)} PHOCA\n` +
    `- Accounts holding fees: ${accountCount}\n` +
    `- Transaction${signatures.length === 1 ? "" : "s"} (${signatures.length}):\n` +
    `${txLines}\n`;
  if (split) {
    entry +=
      `- Split of the pot: charity keeps ${formatPhoca(split.charity)} · ` +
      `community ${formatPhoca(split.community)} · ` +
      `liquidity ${formatPhoca(split.liquidity)}\n`;
  }
  if (distributions && distributions.length > 0) {
    const distLines = distributions
      .map(
        (d) =>
          `  - ${d.name}: [${d.signature.slice(0, 8)}…](https://explorer.solana.com/tx/${d.signature}?cluster=devnet)`
      )
      .join("\n");
    entry +=
      `- Distribution transfers (the 2% fee applies to these too — docs/FEE-SPLIT.md):\n` +
      `${distLines}\n`;
  }
  return entry;
}

/** Append a sweep entry to the transparency log, creating it (with header) on first use. */
export function appendSweepLogEntry(
  entry: string,
  logPath: string = TRANSPARENCY_LOG_PATH
): void {
  if (!fs.existsSync(logPath)) {
    fs.mkdirSync(path.dirname(logPath), { recursive: true });
    fs.writeFileSync(logPath, TRANSPARENCY_LOG_HEADER);
  }
  fs.appendFileSync(logPath, entry);
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
