/**
 * STEP 5 — Collect the withheld charity fees into the treasury.
 *
 * Fees don't fly to the charity wallet by themselves: they accumulate as
 * "withheld" amounts on every token account that received transfers. This
 * script scans all PHOCA token accounts, finds the withheld crumbs, and
 * sweeps them into the charity treasury in one transaction.
 *
 * Two production-shaped behaviors are already built in:
 *   - BATCHING: a Solana transaction fits only ~25 withdraw sources, so the
 *     sweep chunks the registry and sends one transaction per batch.
 *   - TRANSPARENCY LOG: every sweep auto-appends date/amount/tx links to
 *     docs/TRANSPARENCY-LOG.md — the raw feed for the monthly report.
 *
 * To run on a schedule: Windows Task Scheduler (or cron on Linux/Mac) calling
 * `npm run collect-fees` weekly is enough for devnet. In production the
 * withdraw authority is a multisig, not a single laptop key.
 */
import { PublicKey } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
  withdrawWithheldTokensFromAccounts,
  getAccount,
  getTransferFeeAmount,
} from "@solana/spl-token";
import * as fs from "fs";
import {
  getConnection,
  assertDevnet,
  loadWallet,
  readTokenAccounts,
  recordTokenAccount,
  formatPhoca,
  chunk,
  formatSweepLogEntry,
  appendSweepLogEntry,
  MINT_PATH,
} from "./utils";

// Headroom below the ~25-account hard ceiling per transaction (tx size limit)
const MAX_ACCOUNTS_PER_TX = 20;

async function main() {
  const connection = getConnection();
  // Verify the chain's fingerprint, not just its URL (see utils.ts)
  await assertDevnet(connection);
  const payer = loadWallet(); // on devnet, our wallet is also the withdraw authority

  if (!fs.existsSync(MINT_PATH)) throw new Error("No mint found. Run `npm run create-token` first.");
  const mint = new PublicKey(fs.readFileSync(MINT_PATH, "utf-8").trim());

  // HOW WE FIND THE FEE CRUMBS — and why not the "obvious" way:
  // Scanning ALL accounts of the Token-2022 program (getProgramAccounts) is
  // disabled on public RPCs, and even "top holders" scans are heavily
  // rate-limited. So the transfer script RECORDS every account it touches in
  // a local registry (see utils.ts), and we just check those with cheap
  // per-account lookups. The RPC scan remains only as a fallback for when
  // the registry doesn't exist yet. On mainnet, with thousands of holders,
  // this becomes an indexer service (planned in docs/ROADMAP.md Phase 2).
  let candidates: PublicKey[] = readTokenAccounts().map((a) => new PublicKey(a));
  if (candidates.length === 0) {
    console.log("No local registry found — falling back to an RPC holder scan...");
    const largest = await connection.getTokenLargestAccounts(mint, "confirmed");
    candidates = largest.value.map((v) => v.address);
  }

  const accountsWithFees: PublicKey[] = [];
  let totalWithheld = BigInt(0);

  for (const address of candidates) {
    try {
      const parsed = await getAccount(connection, address, "confirmed", TOKEN_2022_PROGRAM_ID);
      const withheld = getTransferFeeAmount(parsed)?.withheldAmount ?? BigInt(0);
      if (withheld > BigInt(0)) {
        accountsWithFees.push(address);
        totalWithheld += withheld;
      }
    } catch {
      // Account closed or never created — nothing to sweep there, skip it.
    }
  }

  if (accountsWithFees.length === 0) {
    console.log("No withheld fees found. Run `npm run transfer-test` a few times first.");
    return;
  }

  console.log(`Found ${accountsWithFees.length} account(s) holding withheld fees`);
  console.log(`Total to collect: ${formatPhoca(totalWithheld)} PHOCA`);

  // Destination: the charity treasury. On devnet we reuse our own wallet;
  // in production this MUST be the dedicated, published charity wallet.
  const charityTreasury = await getOrCreateAssociatedTokenAccount(
    connection, payer, mint, payer.publicKey, false, undefined, undefined, TOKEN_2022_PROGRAM_ID
  );
  recordTokenAccount(charityTreasury.address.toBase58()); // registry rule: every ATA we touch

  // One transaction per batch — see MAX_ACCOUNTS_PER_TX above.
  const batches = chunk(accountsWithFees, MAX_ACCOUNTS_PER_TX);
  const signatures: string[] = [];
  for (let i = 0; i < batches.length; i++) {
    const sig = await withdrawWithheldTokensFromAccounts(
      connection,
      payer,
      mint,
      charityTreasury.address,
      payer, // withdrawWithheldAuthority (multisig in production!)
      [],
      batches[i],
      undefined,
      TOKEN_2022_PROGRAM_ID
    );
    signatures.push(sig);
    console.log(`✅ Batch ${i + 1}/${batches.length}: swept ${batches[i].length} account(s)`);
    console.log("   Tx:", `https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  }

  // The sweep documents itself: date, amount, tx links → transparency log.
  const entry = formatSweepLogEntry(
    new Date().toISOString().slice(0, 10),
    totalWithheld,
    accountsWithFees.length,
    signatures
  );
  appendSweepLogEntry(entry);

  console.log("✅ Charity fees collected into treasury!");
  console.log("🧾 Entry appended to docs/TRANSPARENCY-LOG.md — commit it via PR (rule 9).");
}

main().catch(console.error);
