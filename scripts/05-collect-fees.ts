/**
 * STEP 5 — Collect the withheld charity fees into the treasury.
 *
 * Fees don't fly to the charity wallet by themselves: they accumulate as
 * "withheld" amounts on every token account that received transfers. This
 * script finds the withheld crumbs and sweeps them into the treasury.
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
 * To run on a schedule: scripts/schedule-sweep.ps1 (or cron). In production
 * the withdraw authority is a multisig, not a single laptop key.
 */
import { address, type Address, type Instruction } from "@solana/kit";
import {
  TOKEN_2022_PROGRAM_ADDRESS,
  fetchMint,
  fetchToken,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
  getTransferCheckedWithFeeInstruction,
  getWithdrawWithheldTokensFromAccountsInstruction,
} from "@solana-program/token-2022";
import * as fs from "fs";
import {
  getRpc,
  assertDevnet,
  loadWallet,
  loadOrCreateTreasury,
  sendInstructions,
  readTokenAccounts,
  recordTokenAccount,
  findExtension,
  calculateTransferFee,
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
  const ctx = getRpc();
  // Verify the chain's fingerprint, not just its URL (see utils.ts)
  await assertDevnet(ctx);
  const payer = await loadWallet(); // on devnet, our wallet is also the withdraw authority

  if (!fs.existsSync(MINT_PATH)) throw new Error("No mint found. Run `npm run create-token` first.");
  const mint = address(fs.readFileSync(MINT_PATH, "utf-8").trim());

  // HOW WE FIND THE FEE CRUMBS — and why not the "obvious" way:
  // Scanning ALL accounts of the Token-2022 program (getProgramAccounts) is
  // disabled on public RPCs, and even "top holders" scans are heavily
  // rate-limited. So the transfer script RECORDS every account it touches in
  // a local registry (see utils.ts), and we just check those with cheap
  // per-account lookups. On mainnet, with thousands of holders, this becomes
  // an indexer service (planned in docs/ROADMAP.md).
  const candidates = readTokenAccounts().map((a) => address(a));
  if (candidates.length === 0) {
    console.log("No registry yet. Run `npm run transfer-test` a few times first.");
    return;
  }

  const accountsWithFees: Address[] = [];
  let totalWithheld = 0n;

  for (const tokenAccount of candidates) {
    try {
      const parsed = await fetchToken(ctx.rpc, tokenAccount);
      const withheld =
        findExtension(parsed.data.extensions, "TransferFeeAmount")?.withheldAmount ?? 0n;
      if (withheld > 0n) {
        accountsWithFees.push(tokenAccount);
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
  const [charityAta] = await findAssociatedTokenPda({
    owner: payer.address, mint, tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
  });
  recordTokenAccount(charityAta); // registry rule: every ATA we touch

  // One transaction per batch — see MAX_ACCOUNTS_PER_TX above. The first
  // batch also (idempotently) ensures the charity ATA exists.
  const batches = chunk(accountsWithFees, MAX_ACCOUNTS_PER_TX);
  const signatures: string[] = [];
  for (let i = 0; i < batches.length; i++) {
    const instructions: Instruction[] = [
      getWithdrawWithheldTokensFromAccountsInstruction({
        mint,
        feeReceiver: charityAta,
        withdrawWithheldAuthority: payer, // multisig in production!
        numTokenAccounts: batches[i].length,
        sources: batches[i],
      }),
    ];
    if (i === 0) {
      instructions.unshift(
        getCreateAssociatedTokenIdempotentInstruction({
          payer, ata: charityAta, owner: payer.address, mint,
        })
      );
    }
    const sig = await sendInstructions(ctx, payer, instructions);
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
    // Read the live fee rule once; TransferCheckedWithFee demands the exact fee.
    const mintAccount = await fetchMint(ctx.rpc, mint);
    const feeConfig = findExtension(mintAccount.data.extensions, "TransferFeeConfig");
    if (!feeConfig) throw new Error("This mint has no transfer fee config?!");
    const { epoch } = await ctx.rpc.getEpochInfo().send();

    for (const { name, amount } of shares) {
      if (amount === 0n) continue;
      // Each non-charity treasury is its OWN wallet (created on first run,
      // stored in keys/, git-ignored) — separate wallets, checklist §1.
      const treasury = await loadOrCreateTreasury(name);
      const [treasuryAta] = await findAssociatedTokenPda({
        owner: treasury.address, mint, tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
      });
      recordTokenAccount(treasuryAta); // registry rule

      const expectedFee = calculateTransferFee(feeConfig, epoch, amount);
      const sig = await sendInstructions(ctx, payer, [
        getCreateAssociatedTokenIdempotentInstruction({
          payer, ata: treasuryAta, owner: treasury.address, mint,
        }),
        getTransferCheckedWithFeeInstruction({
          source: charityAta,
          mint,
          destination: treasuryAta,
          authority: payer,
          amount,
          decimals: DECIMALS,
          fee: expectedFee,
        }),
      ]);
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

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
