/**
 * STEP 2 — Create the $PHOCA token itself (the "mint").
 *
 * Fun fact baked into this project: the ancient city of Phocaea minted some of
 * the world's first coins (~600 BC) with a seal as its badge. This script mints
 * the next seal coin — this time the fee rule protects real seals.
 *
 * We use Token-2022 (also called "Token Extensions"), the newer Solana token standard.
 * Its killer feature for us: the TRANSFER FEE extension.
 *
 * Plain-language version: we bake a rule into the token that says
 * "every time someone transfers this token, X% is held back on-chain".
 * Later, the designated authority (your charity treasury) withdraws those
 * held-back tokens. The charity cut is enforced by code, not by a promise.
 *
 * Order matters below: on Solana you (1) create the empty account,
 * (2) configure extensions, (3) THEN initialize the mint. Extensions must
 * be configured before the mint is initialized — like installing wiring
 * before closing the walls.
 */
import {
  Keypair,
  SystemProgram,
  Transaction,
  sendAndConfirmTransaction,
} from "@solana/web3.js";
import {
  ExtensionType,
  TOKEN_2022_PROGRAM_ID,
  createInitializeMintInstruction,
  createInitializeTransferFeeConfigInstruction,
  getMintLen,
} from "@solana/spl-token";
import * as fs from "fs";
import { getConnection, loadWallet, MINT_PATH } from "./utils";

// ------- TOKEN SETTINGS — tweak these -------
const DECIMALS = 9;                 // 1 token = 1_000_000_000 base units (like cents, but 10^9)
const FEE_BASIS_POINTS = 200;       // 200 basis points = 2.00% fee per transfer
const MAX_FEE = BigInt(5_000 * 10 ** DECIMALS); // fee is capped at 5,000 tokens per transfer
// ---------------------------------------------

async function main() {
  const connection = getConnection();
  const payer = loadWallet();

  // The mint gets its own address (a fresh keypair used once, at creation)
  const mint = Keypair.generate();

  // For now, one wallet holds all the "admin powers". Before mainnet these
  // should be split up / moved to a multisig — see docs/SECURITY-CHECKLIST.md
  const mintAuthority = payer.publicKey;          // who may create new tokens
  const transferFeeAuthority = payer.publicKey;   // who may change the fee %
  const withdrawWithheldAuthority = payer.publicKey; // who may collect the charity fees

  // How much space (and rent) does a mint with our extension need?
  const mintLen = getMintLen([ExtensionType.TransferFeeConfig]);
  const lamports = await connection.getMinimumBalanceForRentExemption(mintLen);

  const tx = new Transaction().add(
    // 1) create the empty account owned by the Token-2022 program
    SystemProgram.createAccount({
      fromPubkey: payer.publicKey,
      newAccountPubkey: mint.publicKey,
      space: mintLen,
      lamports,
      programId: TOKEN_2022_PROGRAM_ID,
    }),
    // 2) configure the transfer-fee rule (BEFORE initializing the mint)
    createInitializeTransferFeeConfigInstruction(
      mint.publicKey,
      transferFeeAuthority,
      withdrawWithheldAuthority,
      FEE_BASIS_POINTS,
      MAX_FEE,
      TOKEN_2022_PROGRAM_ID
    ),
    // 3) initialize the mint itself (freezeAuthority = null → nobody can freeze holders)
    createInitializeMintInstruction(
      mint.publicKey,
      DECIMALS,
      mintAuthority,
      null,
      TOKEN_2022_PROGRAM_ID
    )
  );

  const sig = await sendAndConfirmTransaction(connection, tx, [payer, mint]);

  fs.writeFileSync(MINT_PATH, mint.publicKey.toBase58());
  console.log("✅ Token created!");
  console.log("Mint address:", mint.publicKey.toBase58());
  console.log("Transfer fee:", FEE_BASIS_POINTS / 100, "% (charity fee, enforced on-chain)");
  console.log("Tx:", `https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  console.log("\nNext: `npm run mint-supply` — then look up your mint on the explorer link above.");
  console.log("Note: on-chain metadata (name PHOCA, symbol PHOCA, seal logo) is a separate step — great first task for Claude Code!");
}

main().catch(console.error);
