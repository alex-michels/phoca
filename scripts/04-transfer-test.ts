/**
 * STEP 4 — See the charity fee work with your own eyes.
 *
 * We send 1,000 $PHOCA to a fresh test wallet and watch the network hold back
 * the fee automatically. This is the moment the whole project clicks: the
 * charity cut is not a promise in a tweet — it's arithmetic the blockchain
 * performs on every single transfer.
 *
 * Note the special instruction: TransferCheckedWithFee. Token-2022 tokens
 * with a fee REQUIRE it (or TransferChecked) — a plain transfer would fail.
 * We must also state the fee we expect; if it doesn't match the on-chain
 * config exactly, the transfer fails. That protects users from silent fee
 * changes mid-transaction.
 */
import { address, generateKeyPairSigner } from "@solana/kit";
import {
  TOKEN_2022_PROGRAM_ADDRESS,
  fetchMint,
  fetchToken,
  findAssociatedTokenPda,
  getCreateAssociatedTokenIdempotentInstruction,
  getTransferCheckedWithFeeInstruction,
} from "@solana-program/token-2022";
import * as fs from "fs";
import {
  getRpc,
  assertDevnet,
  loadWallet,
  sendInstructions,
  recordTokenAccount,
  findExtension,
  calculateTransferFee,
  formatPhoca,
  MINT_PATH,
} from "./utils";
import { DECIMALS, ONE_PHOCA } from "./config";

const SEND_AMOUNT = 1_000n * ONE_PHOCA; // 1,000 PHOCA

async function main() {
  const ctx = getRpc();
  // Verify the chain's fingerprint, not just its URL (see utils.ts)
  await assertDevnet(ctx);
  const payer = await loadWallet();

  if (!fs.existsSync(MINT_PATH)) throw new Error("No mint found. Run `npm run create-token` first.");
  const mint = address(fs.readFileSync(MINT_PATH, "utf-8").trim());

  // A throwaway recipient — imagine this is a seal fan buying their first PHOCA
  const recipient = await generateKeyPairSigner();
  console.log("Test recipient:", recipient.address);

  const [sourceAta] = await findAssociatedTokenPda({
    owner: payer.address, mint, tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
  });
  const [destAta] = await findAssociatedTokenPda({
    owner: recipient.address, mint, tokenProgram: TOKEN_2022_PROGRAM_ADDRESS,
  });

  // Remember both accounts so `npm run collect-fees` can find the withheld
  // fees WITHOUT expensive RPC scan calls (see the registry note in utils.ts).
  recordTokenAccount(sourceAta);
  recordTokenAccount(destAta);

  // Read the fee rule straight from the blockchain (never trust hardcoded values)
  const mintAccount = await fetchMint(ctx.rpc, mint);
  const feeConfig = findExtension(mintAccount.data.extensions, "TransferFeeConfig");
  if (!feeConfig) throw new Error("This mint has no transfer fee config?!");

  const { epoch } = await ctx.rpc.getEpochInfo().send();
  const expectedFee = calculateTransferFee(feeConfig, epoch, SEND_AMOUNT);

  console.log(`Sending ${formatPhoca(SEND_AMOUNT)} PHOCA...`);
  console.log(`Expected charity fee: ${formatPhoca(expectedFee)} PHOCA`);

  const signature = await sendInstructions(ctx, payer, [
    // The recipient's ATA doesn't exist yet — create it (idempotent) in the same tx
    getCreateAssociatedTokenIdempotentInstruction({
      payer, ata: destAta, owner: recipient.address, mint,
    }),
    getTransferCheckedWithFeeInstruction({
      source: sourceAta,
      mint,
      destination: destAta,
      authority: payer,
      amount: SEND_AMOUNT,
      decimals: DECIMALS,
      fee: expectedFee,
    }),
  ]);

  // Now inspect the recipient's account: the fee sits there as "withheld",
  // untouchable by the recipient — only the withdraw authority can collect it.
  const destAccount = await fetchToken(ctx.rpc, destAta);
  const withheld =
    findExtension(destAccount.data.extensions, "TransferFeeAmount")?.withheldAmount ?? 0n;

  console.log("✅ Transfer done!");
  console.log(`Recipient received: ${formatPhoca(destAccount.data.amount)} PHOCA`);
  console.log(`Withheld for charity on this account: ${formatPhoca(withheld)} PHOCA`);
  console.log("Tx:", `https://explorer.solana.com/tx/${signature}?cluster=devnet`);
  console.log("\nNext: `npm run collect-fees` to sweep withheld fees into the charity treasury.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
