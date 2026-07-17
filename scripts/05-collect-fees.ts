/**
 * STEP 5 — Collect the withheld charity fees into the treasury.
 *
 * Fees don't fly to the charity wallet by themselves: they accumulate as
 * "withheld" amounts on every token account that received transfers. This
 * script scans all PHOCA token accounts, finds the withheld crumbs, and
 * sweeps them into the charity treasury in one transaction.
 *
 * Three production-shaped behaviors are built in:
 *   - BATCHING: a Solana transaction fits only ~25 withdraw sources, so the
 *     sweep chunks the registry and sends one transaction per batch.
 *   - FEE SPLIT: the pot divides 50/25/25 (charity/community/liquidity, see
 *     docs/FEE-SPLIT.md). Charity's share STAYS here — the collection
 *     treasury IS the charity treasury, so the biggest share never moves and
 *     never pays fee. The other two shares are sent onward as normal
 *     transfers (which the chain fees at 2% — documented, converges back).
 *   - TRANSPARENCY LOG: every sweep auto-appends date/amount/split/tx links
 *     to docs/TRANSPARENCY-LOG.md — the raw feed for the monthly report.
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
  getMint,
  getTransferFeeConfig,
  calculateEpochFee,
  transferCheckedWithFee,
} from "@solana/spl-token";
import * as fs from "fs";
import {
  getConnection,
  assertDevnet,
  loadWallet,
  loadOrCreateTreasury,
  readTokenAccounts,
  recordTokenAccount,
  formatPhoca,
  chunk,
  splitFee,
  formatSweepLogEntry,
  appendSweepLogEntry,
  SweepDistribution,
  MINT_PATH,
} from "./utils";
import { DECIMALS } from "./config";

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

  // ----- FEE SPLIT (docs/FEE-SPLIT.md) -----
  // Charity's share stays right here in the collection treasury (no
  // transfer → no fee). Community and liquidity get theirs as ordinary
  // transfers — the chain withholds 2% on those too; the withheld crumbs
  // return to the pot at the next sweep. Everything below is logged.
  const split = splitFee(totalWithheld);
  console.log(
    `Split of the pot: charity keeps ${formatPhoca(split.charity)} · ` +
      `community ${formatPhoca(split.community)} · liquidity ${formatPhoca(split.liquidity)}`
  );

  const distributions: SweepDistribution[] = [];
  const shares = [
    { name: "community", amount: split.community },
    { name: "liquidity", amount: split.liquidity },
  ];
  if (shares.some((s) => s.amount > 0n)) {
    // Read the live fee rule once; transferCheckedWithFee demands the exact fee.
    const mintInfo = await getMint(connection, mint, "confirmed", TOKEN_2022_PROGRAM_ID);
    const feeConfig = getTransferFeeConfig(mintInfo);
    if (!feeConfig) throw new Error("This mint has no transfer fee config?!");
    const epoch = BigInt((await connection.getEpochInfo()).epoch);

    for (const { name, amount } of shares) {
      if (amount === 0n) continue;
      // Each non-charity treasury is its OWN wallet (created on first run,
      // stored in keys/, git-ignored) — separate wallets, checklist §1.
      const treasury = loadOrCreateTreasury(name);
      const treasuryAta = await getOrCreateAssociatedTokenAccount(
        connection, payer, mint, treasury.publicKey, false, undefined, undefined, TOKEN_2022_PROGRAM_ID
      );
      recordTokenAccount(treasuryAta.address.toBase58()); // registry rule

      const expectedFee = calculateEpochFee(feeConfig, epoch, amount);
      const sig = await transferCheckedWithFee(
        connection,
        payer,
        charityTreasury.address,
        mint,
        treasuryAta.address,
        payer,
        amount,
        DECIMALS,
        expectedFee,
        [],
        undefined,
        TOKEN_2022_PROGRAM_ID
      );
      distributions.push({ name, signature: sig });
      console.log(
        `✅ ${name}: sent ${formatPhoca(amount)} PHOCA ` +
          `(receives ${formatPhoca(amount - expectedFee)} after the on-chain fee)`
      );
      console.log("   Tx:", `https://explorer.solana.com/tx/${sig}?cluster=devnet`);
    }
  }

  // The sweep documents itself: date, amount, split, tx links → transparency log.
  const entry = formatSweepLogEntry(
    new Date().toISOString().slice(0, 10),
    totalWithheld,
    accountsWithFees.length,
    signatures,
    split,
    distributions
  );
  appendSweepLogEntry(entry);

  console.log("✅ Sweep + split complete!");
  console.log("🧾 Entry appended to docs/TRANSPARENCY-LOG.md — commit it via PR (rule 9).");
}

main().catch(console.error);
