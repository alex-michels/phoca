/**
 * STEP 3 — Mint the total supply into your treasury wallet.
 *
 * "Minting" = creating the actual tokens. The mint (step 2) is the printing
 * press; this script runs the press once and puts everything in your wallet's
 * token account.
 *
 * Important habit for later: after the full supply exists and tokenomics are
 * final, serious projects REVOKE the mint authority so no more tokens can ever
 * be printed. That's one of the first things buyers check.
 */
import { PublicKey } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
  mintTo,
} from "@solana/spl-token";
import * as fs from "fs";
import {
  getConnection,
  assertDevnet,
  loadWallet,
  recordTokenAccount,
  formatPhoca,
  MINT_PATH,
} from "./utils";
import { TOTAL_SUPPLY } from "./config";

async function main() {
  const connection = getConnection();
  // Verify the chain's fingerprint, not just its URL (see utils.ts)
  await assertDevnet(connection);
  const payer = loadWallet();

  if (!fs.existsSync(MINT_PATH)) throw new Error("No mint found. Run `npm run create-token` first.");
  const mint = new PublicKey(fs.readFileSync(MINT_PATH, "utf-8").trim());

  // A wallet doesn't hold tokens directly — it holds them in a small side-account
  // called an Associated Token Account (ATA). Think: your wallet is a keyring,
  // and the ATA is the pocket for this specific token.
  const treasury = await getOrCreateAssociatedTokenAccount(
    connection,
    payer,
    mint,
    payer.publicKey,
    false,
    undefined,
    undefined,
    TOKEN_2022_PROGRAM_ID
  );

  // The treasury can also RECEIVE transfers later (with fees withheld on it),
  // so it goes into the registry the sweep reads (see utils.ts).
  recordTokenAccount(treasury.address.toBase58());

  const sig = await mintTo(
    connection,
    payer,
    mint,
    treasury.address,
    payer, // mint authority
    TOTAL_SUPPLY,
    [],
    undefined,
    TOKEN_2022_PROGRAM_ID
  );

  console.log(`✅ Minted ${formatPhoca(TOTAL_SUPPLY)} PHOCA to treasury`);
  console.log("Treasury token account:", treasury.address.toBase58());
  console.log("Tx:", `https://explorer.solana.com/tx/${sig}?cluster=devnet`);
}

main().catch(console.error);
