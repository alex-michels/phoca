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
import { address } from "@solana/kit";
import {
  TOKEN_2022_PROGRAM_ADDRESS,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
  getMintToInstruction,
} from "@solana-program/token-2022";
import * as fs from "fs";
import {
  getRpc,
  assertDevnet,
  loadWallet,
  sendInstructions,
  recordTokenAccount,
  formatPhoca,
  MINT_PATH,
} from "./utils";
import { TOTAL_SUPPLY } from "./config";

async function main() {
  const ctx = getRpc();
  // Verify the chain's fingerprint, not just its URL (see utils.ts)
  await assertDevnet(ctx);
  const payer = await loadWallet();

  if (!fs.existsSync(MINT_PATH)) throw new Error("No mint found. Run `npm run create-token` first.");
  const mint = address(fs.readFileSync(MINT_PATH, "utf-8").trim());

  // A wallet doesn't hold tokens directly — it holds them in a small side-account
  // called an Associated Token Account (ATA). Think: your wallet is a keyring,
  // and the ATA is the pocket for this specific token. Its address is DERIVED
  // (a "PDA") from owner + mint — pure math, same everywhere.
  const [treasuryAta] = await findAssociatedTokenPda({
    owner: payer.address,
    mint,
    tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
  });

  // The treasury can also RECEIVE transfers later (with fees withheld on it),
  // so it goes into the registry the sweep reads (see utils.ts).
  recordTokenAccount(treasuryAta);

  const signature = await sendInstructions(ctx, payer, [
    // Idempotent: creates the ATA if missing, does nothing if it exists
    getCreateAssociatedTokenIdempotentInstruction({
      payer,
      ata: treasuryAta,
      owner: payer.address,
      mint,
    }),
    getMintToInstruction({
      mint,
      token: treasuryAta,
      mintAuthority: payer,
      amount: TOTAL_SUPPLY,
    }),
  ]);

  console.log(`✅ Minted ${formatPhoca(TOTAL_SUPPLY)} PHOCA to treasury`);
  console.log("Treasury token account:", treasuryAta);
  console.log("Tx:", `https://explorer.solana.com/tx/${signature}?cluster=devnet`);
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
