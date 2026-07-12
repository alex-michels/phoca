/**
 * STEP 5 — Collect the withheld charity fees into the treasury.
 *
 * Fees don't fly to the charity wallet by themselves: they accumulate as
 * "withheld" amounts on every token account that received transfers. This
 * script scans all PHOCA token accounts, finds the withheld crumbs, and
 * sweeps them into the charity treasury in one transaction.
 *
 * In production you'd run this on a schedule (e.g. weekly), publish the tx
 * link in your transparency report (docs/TRANSPARENCY.md), and the withdraw
 * authority would be a multisig — not a single laptop key.
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
  MINT_PATH,
} from "./utils";

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

  const sig = await withdrawWithheldTokensFromAccounts(
    connection,
    payer,
    mint,
    charityTreasury.address,
    payer, // withdrawWithheldAuthority (multisig in production!)
    [],
    accountsWithFees,
    undefined,
    TOKEN_2022_PROGRAM_ID
  );

  console.log("✅ Charity fees collected into treasury!");
  console.log("Tx:", `https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  console.log("This tx link is exactly what goes into your public transparency report. 🦭");
}

main().catch(console.error);
