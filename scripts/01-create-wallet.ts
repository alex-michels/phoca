/**
 * STEP 1 — Create a devnet wallet and get free test SOL.
 *
 * A "wallet" is just a keypair:
 *   - public key  = your address (safe to share, like an email address)
 *   - private key = the password that controls the money (NEVER share, NEVER commit)
 *
 * We save it into keys/ which is git-ignored. Devnet SOL is worthless play money,
 * but treat keys carefully anyway — build the right habits from day one.
 */
import { address, lamports } from "@solana/kit";
import * as fs from "fs";
import {
  getRpc,
  assertDevnet,
  loadWallet,
  generatePersistableSigner,
  confirmSignature,
  KEYS_DIR,
  WALLET_PATH,
} from "./utils";

const LAMPORTS_PER_SOL = 1_000_000_000n;

async function main() {
  const ctx = getRpc();
  // Verify the chain's fingerprint, not just its URL (see utils.ts)
  await assertDevnet(ctx);

  let walletAddress;
  if (fs.existsSync(WALLET_PATH)) {
    console.log("Wallet already exists, reusing it.");
    walletAddress = (await loadWallet()).address;
  } else {
    const { signer, secretBytes } = await generatePersistableSigner();
    fs.mkdirSync(KEYS_DIR, { recursive: true });
    fs.writeFileSync(WALLET_PATH, JSON.stringify(Array.from(secretBytes)));
    console.log("New devnet wallet created and saved to keys/devnet-wallet.json");
    walletAddress = signer.address;
  }

  console.log("Your address:", walletAddress);

  // Ask the devnet faucet for 2 free test SOL (sometimes rate-limited — just retry later,
  // or use the web faucet at https://faucet.solana.com)
  try {
    console.log("Requesting 2 devnet SOL from the faucet...");
    // requestAirdrop exists only on test clusters in kit's types — which is
    // exactly the world our interlock guarantees we're in, so the cast is safe.
    const faucet = ctx.rpc as unknown as {
      requestAirdrop: (
        addr: ReturnType<typeof address>,
        l: ReturnType<typeof lamports>
      ) => { send: () => Promise<string> };
    };
    const signature = await faucet
      .requestAirdrop(address(walletAddress), lamports(2n * LAMPORTS_PER_SOL))
      .send();
    await confirmSignature(ctx, signature);
  } catch {
    console.log("Airdrop failed (faucet is often busy). Try https://faucet.solana.com instead.");
  }

  const { value: balance } = await ctx.rpc.getBalance(address(walletAddress)).send();
  console.log("Balance:", Number(balance) / Number(LAMPORTS_PER_SOL), "SOL");
}

main().catch((e) => {
  console.error(e);
  process.exitCode = 1;
});
