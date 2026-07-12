/**
 * STEP 4 — See the charity fee work with your own eyes.
 *
 * We send 1,000 $PHOCA to a fresh test wallet and watch the network hold back
 * the fee automatically. This is the moment the whole project clicks: the
 * charity cut is not a promise in a tweet — it's arithmetic the blockchain
 * performs on every single transfer.
 *
 * Note the special function: transferCheckedWithFee. Token-2022 tokens with a
 * fee REQUIRE it (or transferChecked) — a plain transfer would be rejected.
 * We must also state the fee we expect; if it doesn't match the on-chain
 * config exactly, the transfer fails. That protects users from silent fee
 * changes mid-transaction.
 */
import { Keypair, PublicKey } from "@solana/web3.js";
import {
  TOKEN_2022_PROGRAM_ID,
  getOrCreateAssociatedTokenAccount,
  transferCheckedWithFee,
  getMint,
  getTransferFeeConfig,
  calculateEpochFee,
  getAccount,
  getTransferFeeAmount,
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
import { DECIMALS, ONE_PHOCA } from "./config";

const SEND_AMOUNT = 1_000n * ONE_PHOCA; // 1,000 PHOCA

async function main() {
  const connection = getConnection();
  // Verify the chain's fingerprint, not just its URL (see utils.ts)
  await assertDevnet(connection);
  const payer = loadWallet();

  if (!fs.existsSync(MINT_PATH)) throw new Error("No mint found. Run `npm run create-token` first.");
  const mint = new PublicKey(fs.readFileSync(MINT_PATH, "utf-8").trim());

  // A throwaway recipient — imagine this is a seal fan buying their first PHOCA
  const recipient = Keypair.generate();
  console.log("Test recipient:", recipient.publicKey.toBase58());

  const sourceAta = await getOrCreateAssociatedTokenAccount(
    connection, payer, mint, payer.publicKey, false, undefined, undefined, TOKEN_2022_PROGRAM_ID
  );
  const destAta = await getOrCreateAssociatedTokenAccount(
    connection, payer, mint, recipient.publicKey, false, undefined, undefined, TOKEN_2022_PROGRAM_ID
  );

  // Remember both accounts so `npm run collect-fees` can find the withheld
  // fees WITHOUT expensive RPC scan calls (see the registry note in utils.ts).
  recordTokenAccount(sourceAta.address.toBase58());
  recordTokenAccount(destAta.address.toBase58());

  // Read the fee rule straight from the blockchain (never trust hardcoded values)
  const mintInfo = await getMint(connection, mint, undefined, TOKEN_2022_PROGRAM_ID);
  const feeConfig = getTransferFeeConfig(mintInfo);
  if (!feeConfig) throw new Error("This mint has no transfer fee config?!");

  const epoch = BigInt((await connection.getEpochInfo()).epoch);
  const expectedFee = calculateEpochFee(feeConfig, epoch, SEND_AMOUNT);

  console.log(`Sending ${formatPhoca(SEND_AMOUNT)} PHOCA...`);
  console.log(`Expected charity fee: ${formatPhoca(expectedFee)} PHOCA`);

  const sig = await transferCheckedWithFee(
    connection,
    payer,
    sourceAta.address,
    mint,
    destAta.address,
    payer, // owner of the source account
    SEND_AMOUNT,
    DECIMALS,
    expectedFee,
    [],
    undefined,
    TOKEN_2022_PROGRAM_ID
  );

  // Now inspect the recipient's account: the fee sits there as "withheld",
  // untouchable by the recipient — only the withdraw authority can collect it.
  const destAccount = await getAccount(connection, destAta.address, undefined, TOKEN_2022_PROGRAM_ID);
  const withheld = getTransferFeeAmount(destAccount)?.withheldAmount ?? BigInt(0);

  console.log("✅ Transfer done!");
  console.log(`Recipient received: ${formatPhoca(destAccount.amount)} PHOCA`);
  console.log(`Withheld for charity on this account: ${formatPhoca(withheld)} PHOCA`);
  console.log("Tx:", `https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  console.log("\nNext: `npm run collect-fees` to sweep withheld fees into the charity treasury.");
}

main().catch(console.error);
