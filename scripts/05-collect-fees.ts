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
  unpackAccount,
  getTransferFeeAmount,
} from "@solana/spl-token";
import * as fs from "fs";
import { getConnection, loadWallet, MINT_PATH } from "./utils";

const DECIMALS = 9;

async function main() {
  const connection = getConnection();
  const payer = loadWallet(); // on devnet, our wallet is also the withdraw authority

  if (!fs.existsSync(MINT_PATH)) throw new Error("No mint found. Run `npm run create-token` first.");
  const mint = new PublicKey(fs.readFileSync(MINT_PATH, "utf-8").trim());

  // Find every token account of this mint (offset 0 = where the mint address
  // lives inside a token account's raw data)
  const allAccounts = await connection.getProgramAccounts(TOKEN_2022_PROGRAM_ID, {
    commitment: "confirmed",
    filters: [{ memcmp: { offset: 0, bytes: mint.toBase58() } }],
  });

  const accountsWithFees: PublicKey[] = [];
  let totalWithheld = BigInt(0);

  for (const { pubkey, account } of allAccounts) {
    const parsed = unpackAccount(pubkey, account, TOKEN_2022_PROGRAM_ID);
    const withheld = getTransferFeeAmount(parsed)?.withheldAmount ?? BigInt(0);
    if (withheld > BigInt(0)) {
      accountsWithFees.push(pubkey);
      totalWithheld += withheld;
    }
  }

  if (accountsWithFees.length === 0) {
    console.log("No withheld fees found. Run `npm run transfer-test` a few times first.");
    return;
  }

  console.log(`Found ${accountsWithFees.length} account(s) holding withheld fees`);
  console.log(`Total to collect: ${Number(totalWithheld) / 10 ** DECIMALS} PHOCA`);

  // Destination: the charity treasury. On devnet we reuse our own wallet;
  // in production this MUST be the dedicated, published charity wallet.
  const charityTreasury = await getOrCreateAssociatedTokenAccount(
    connection, payer, mint, payer.publicKey, false, undefined, undefined, TOKEN_2022_PROGRAM_ID
  );

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
