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
import { generateKeyPairSigner, lamports } from "@solana/kit";
import { getCreateAccountInstruction } from "@solana-program/system";
import {
  TOKEN_2022_PROGRAM_ADDRESS,
  getMintSize,
  getInitializeTransferFeeConfigInstruction,
  getInitializeMetadataPointerInstruction,
  getInitializeMintInstruction,
  getInitializeTokenMetadataInstruction,
} from "@solana-program/token-2022";
import * as fs from "fs";
import { getRpc, assertDevnet, loadWallet, sendInstructions, MINT_PATH } from "./utils";
// All token settings live in ONE place — change them there, never here:
import {
  DECIMALS,
  FEE_BASIS_POINTS,
  MAX_FEE,
  TOKEN_NAME,
  TOKEN_SYMBOL,
  METADATA_URI,
} from "./config";

/**
 * Size of the metadata TLV entry the program will append to the mint:
 * 2 bytes type + 2 bytes length, then the borsh-packed content —
 * update authority (32) + mint (32) + three length-prefixed strings (4+len)
 * + the additionalMetadata vector length (4). We pre-fund rent for it;
 * the InitializeTokenMetadata instruction grows the account when it runs.
 * Heads-up for later: if the metadata ever GROWS (longer URI, extra fields),
 * the account needs a lamport top-up BEFORE the update instruction.
 */
function metadataTlvSize(name: string, symbol: string, uri: string): number {
  const utf8 = (s: string) => new TextEncoder().encode(s).length;
  return 4 + 32 + 32 + (4 + utf8(name)) + (4 + utf8(symbol)) + (4 + utf8(uri)) + 4;
}

async function main() {
  const ctx = getRpc();
  // Verify the chain's fingerprint, not just its URL (see utils.ts)
  await assertDevnet(ctx);
  const payer = await loadWallet();

  // The mint gets its own address (a fresh keypair used once, at creation).
  // Its secret is never saved — after initialization it has no power at all.
  const mint = await generateKeyPairSigner();

  // For now, one wallet holds all the "admin powers". Before mainnet these
  // should be split up / moved to a multisig — see docs/SECURITY-CHECKLIST.md
  const mintAuthority = payer.address;          // who may create new tokens
  const transferFeeAuthority = payer.address;   // who may change the fee %
  const withdrawWithheldAuthority = payer.address; // who may collect the charity fees
  const metadataUpdateAuthority = payer.address;   // who may edit name/symbol/URI later

  // How much space (and rent) do we need? getMintSize counts the fixed-size
  // extensions we configure below; the metadata TLV is variable-size, so the
  // account is CREATED at the fixed size but we pre-fund rent for the final
  // size (see metadataTlvSize above).
  const mintSpace = getMintSize([
    {
      __kind: "TransferFeeConfig",
      transferFeeConfigAuthority: transferFeeAuthority,
      withdrawWithheldAuthority,
      withheldAmount: 0n,
      olderTransferFee: { epoch: 0n, maximumFee: MAX_FEE, transferFeeBasisPoints: FEE_BASIS_POINTS },
      newerTransferFee: { epoch: 0n, maximumFee: MAX_FEE, transferFeeBasisPoints: FEE_BASIS_POINTS },
    },
    { __kind: "MetadataPointer", authority: metadataUpdateAuthority, metadataAddress: mint.address },
  ]);
  const totalSpace = mintSpace + metadataTlvSize(TOKEN_NAME, TOKEN_SYMBOL, METADATA_URI);
  const rent = await ctx.rpc.getMinimumBalanceForRentExemption(BigInt(totalSpace)).send();

  const signature = await sendInstructions(ctx, payer, [
    // 1) create the empty account owned by the Token-2022 program
    getCreateAccountInstruction({
      payer,
      newAccount: mint,
      lamports: lamports(rent),
      space: BigInt(mintSpace),
      programAddress: TOKEN_2022_PROGRAM_ADDRESS,
    }),
    // 2) configure the transfer-fee rule (BEFORE initializing the mint)
    getInitializeTransferFeeConfigInstruction({
      mint: mint.address,
      transferFeeConfigAuthority: transferFeeAuthority,
      withdrawWithheldAuthority,
      transferFeeBasisPoints: FEE_BASIS_POINTS,
      maximumFee: MAX_FEE,
    }),
    // 3) configure the metadata POINTER (also BEFORE init). It answers one
    //    question: "where does this token's metadata live?" Our answer:
    //    "in the mint account itself" — the simplest, most trustworthy setup.
    getInitializeMetadataPointerInstruction({
      mint: mint.address,
      authority: metadataUpdateAuthority,
      metadataAddress: mint.address,
    }),
    // 4) initialize the mint itself (no freezeAuthority → nobody can freeze holders)
    getInitializeMintInstruction({
      mint: mint.address,
      decimals: DECIMALS,
      mintAuthority,
    }),
    // 5) now write the actual metadata (name, symbol, URI) into the mint
    getInitializeTokenMetadataInstruction({
      metadata: mint.address,
      updateAuthority: metadataUpdateAuthority,
      mint: mint.address,
      mintAuthority: payer,
      name: TOKEN_NAME,
      symbol: TOKEN_SYMBOL,
      uri: METADATA_URI,
    }),
  ]);

  fs.writeFileSync(MINT_PATH, mint.address);
  console.log("✅ Token created!");
  console.log("Mint address:", mint.address);
  console.log("Name/Symbol:", `${TOKEN_NAME} / ${TOKEN_SYMBOL}`, "(stored on-chain in the mint)");
  console.log("Transfer fee:", FEE_BASIS_POINTS / 100, "% (charity fee, enforced on-chain)");
  console.log("Tx:", `https://explorer.solana.com/tx/${signature}?cluster=devnet`);
  console.log("\nNext: `npm run mint-supply` — then look up your mint on the explorer link above.");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
