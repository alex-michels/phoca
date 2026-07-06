/**
 * STEP 2 — Create the $PHOCA token itself (the "mint").
 *
 * Fun fact baked into this project: the ancient city of Phocaea minted some of
 * the world's first coins (~600 BC) with a seal as its badge. This script mints
 * the next seal coin — this time the fee rule protects real seals.
 *
 * We use Token-2022 (also called "Token Extensions"), the newer Solana token standard.
 * TWO extensions do the work for us:
 *
 *   1. TRANSFER FEE — bakes a rule into the token: "every transfer holds back X%
 *      on-chain". The charity cut is enforced by code, not by a promise.
 *
 *   2. METADATA (MetadataPointer + TokenMetadata) — the token carries its own
 *      name, symbol and a link to its logo INSIDE the mint account. Explorers
 *      and wallets read it from there; no separate metadata program needed.
 *
 * Order matters below: on Solana you (1) create the empty account,
 * (2) configure extensions, (3) THEN initialize the mint, (4) then write the
 * metadata. Extensions must be configured before the mint is initialized —
 * like installing wiring before closing the walls. The metadata CONTENT is the
 * one exception: it's written right after, because it lives in a flexible
 * "TLV" area at the end of the account that can grow.
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
  TYPE_SIZE,
  LENGTH_SIZE,
  createInitializeMintInstruction,
  createInitializeTransferFeeConfigInstruction,
  createInitializeMetadataPointerInstruction,
  getMintLen,
} from "@solana/spl-token";
import {
  createInitializeInstruction,
  pack,
  TokenMetadata,
} from "@solana/spl-token-metadata";
import * as fs from "fs";
import { getConnection, loadWallet, MINT_PATH } from "./utils";

// ------- TOKEN SETTINGS — tweak these -------
const DECIMALS = 9;                 // 1 token = 1_000_000_000 base units (like cents, but 10^9)
const FEE_BASIS_POINTS = 200;       // 200 basis points = 2.00% fee per transfer
const MAX_FEE = BigInt(5_000 * 10 ** DECIMALS); // fee is capped at 5,000 tokens per transfer

const TOKEN_NAME = "PHOCA";
const TOKEN_SYMBOL = "PHOCA";
// Where wallets/explorers fetch the rich metadata (description, logo, links).
// NOTE: the repo is private right now, so this URL won't resolve publicly yet —
// that's fine on devnet. The update authority can change this URI any time;
// for mainnet it must move to permanent hosting (Arweave/Irys), see docs/ROADMAP.md.
const METADATA_URI =
  "https://raw.githubusercontent.com/alex-michels/phoca/main/assets/phoca-metadata.json";
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
  const metadataUpdateAuthority = payer.publicKey;   // who may edit name/symbol/URI later

  // The metadata we want the mint to carry on-chain:
  const metadata: TokenMetadata = {
    mint: mint.publicKey,
    name: TOKEN_NAME,
    symbol: TOKEN_SYMBOL,
    uri: METADATA_URI,
    additionalMetadata: [], // room for extra key/value pairs later (e.g. "charity")
  };

  // How much space (and rent) do we need?
  // - getMintLen counts the FIXED-size extensions (fee config + metadata pointer).
  // - The metadata CONTENT is variable-size, so the account is created at the
  //   fixed size, but we pre-fund enough lamports ("rent") for the final size —
  //   the InitializeTokenMetadata instruction grows the account when it runs.
  const mintLen = getMintLen([
    ExtensionType.TransferFeeConfig,
    ExtensionType.MetadataPointer,
  ]);
  const metadataLen = TYPE_SIZE + LENGTH_SIZE + pack(metadata).length;
  const lamports = await connection.getMinimumBalanceForRentExemption(
    mintLen + metadataLen
  );

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
    // 3) configure the metadata POINTER (also BEFORE init). It answers one
    //    question: "where does this token's metadata live?" Our answer:
    //    "in the mint account itself" — the simplest, most trustworthy setup.
    createInitializeMetadataPointerInstruction(
      mint.publicKey,
      metadataUpdateAuthority,
      mint.publicKey, // metadata lives IN the mint account
      TOKEN_2022_PROGRAM_ID
    ),
    // 4) initialize the mint itself (freezeAuthority = null → nobody can freeze holders)
    createInitializeMintInstruction(
      mint.publicKey,
      DECIMALS,
      mintAuthority,
      null,
      TOKEN_2022_PROGRAM_ID
    ),
    // 5) now write the actual metadata (name, symbol, URI) into the mint
    createInitializeInstruction({
      programId: TOKEN_2022_PROGRAM_ID,
      mint: mint.publicKey,
      metadata: mint.publicKey,
      name: metadata.name,
      symbol: metadata.symbol,
      uri: metadata.uri,
      mintAuthority,
      updateAuthority: metadataUpdateAuthority,
    })
  );

  const sig = await sendAndConfirmTransaction(connection, tx, [payer, mint]);

  fs.writeFileSync(MINT_PATH, mint.publicKey.toBase58());
  console.log("✅ Token created!");
  console.log("Mint address:", mint.publicKey.toBase58());
  console.log("Name/Symbol:", `${TOKEN_NAME} / ${TOKEN_SYMBOL}`, "(stored on-chain in the mint)");
  console.log("Transfer fee:", FEE_BASIS_POINTS / 100, "% (charity fee, enforced on-chain)");
  console.log("Tx:", `https://explorer.solana.com/tx/${sig}?cluster=devnet`);
  console.log("\nNext: `npm run mint-supply` — then look up your mint on the explorer link above.");
}

main().catch(console.error);
