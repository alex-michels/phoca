/**
 * Tests for scripts/utils.ts — above all, the NON-DEVNET INTERLOCK.
 *
 * That interlock is the single most important safety line in this repo:
 * it's what stops a learning script from ever touching real money by
 * accident. So we test it from every angle. If any of these tests fail,
 * do NOT run the scripts until you understand why.
 *
 * These tests run entirely offline — creating a Connection object only
 * stores the URL, it doesn't talk to the network.
 */
import { test, describe, beforeEach, afterEach } from "node:test";
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { Keypair } from "@solana/web3.js";
import { getConnection, loadWallet } from "../scripts/utils";

describe("getConnection — the non-devnet interlock", () => {
  // Each test gets a clean environment; whatever was set before is restored
  // after, so tests can't leak settings into each other (or into your shell).
  let savedRpcUrl: string | undefined;
  let savedOverride: string | undefined;

  beforeEach(() => {
    savedRpcUrl = process.env.RPC_URL;
    savedOverride = process.env.I_UNDERSTAND_THIS_IS_NOT_DEVNET;
    delete process.env.RPC_URL;
    delete process.env.I_UNDERSTAND_THIS_IS_NOT_DEVNET;
  });

  afterEach(() => {
    if (savedRpcUrl === undefined) delete process.env.RPC_URL;
    else process.env.RPC_URL = savedRpcUrl;
    if (savedOverride === undefined) delete process.env.I_UNDERSTAND_THIS_IS_NOT_DEVNET;
    else process.env.I_UNDERSTAND_THIS_IS_NOT_DEVNET = savedOverride;
  });

  test("defaults to devnet when RPC_URL is unset", () => {
    const conn = getConnection();
    assert.match(conn.rpcEndpoint, /devnet/);
  });

  test("accepts an explicit devnet RPC", () => {
    process.env.RPC_URL = "https://api.devnet.solana.com";
    assert.match(getConnection().rpcEndpoint, /devnet/);
  });

  test("accepts localhost (solana-test-validator)", () => {
    process.env.RPC_URL = "http://localhost:8899";
    assert.match(getConnection().rpcEndpoint, /localhost/);
  });

  test("accepts 127.0.0.1", () => {
    process.env.RPC_URL = "http://127.0.0.1:8899";
    assert.match(getConnection().rpcEndpoint, /127\.0\.0\.1/);
  });

  test("REFUSES a mainnet RPC", () => {
    process.env.RPC_URL = "https://api.mainnet-beta.solana.com";
    assert.throws(() => getConnection(), /Refusing to run against a non-devnet RPC/);
  });

  test("refuses testnet too — only devnet/localnet count as safe", () => {
    process.env.RPC_URL = "https://api.testnet.solana.com";
    assert.throws(() => getConnection(), /Refusing to run against a non-devnet RPC/);
  });

  test("refuses a third-party mainnet RPC (not just the official URL)", () => {
    process.env.RPC_URL = "https://solana-mainnet.example-rpc-provider.com";
    assert.throws(() => getConnection(), /Refusing to run against a non-devnet RPC/);
  });

  test("the override must be EXACTLY the string 'true' — anything else stays locked", () => {
    process.env.RPC_URL = "https://api.mainnet-beta.solana.com";
    for (const notQuiteTrue of ["1", "TRUE", "True", "yes", ""]) {
      process.env.I_UNDERSTAND_THIS_IS_NOT_DEVNET = notQuiteTrue;
      assert.throws(
        () => getConnection(),
        /Refusing to run against a non-devnet RPC/,
        `override value ${JSON.stringify(notQuiteTrue)} should NOT unlock the interlock`
      );
    }
  });

  test("the explicit, exact override opens the interlock (by design)", () => {
    process.env.RPC_URL = "https://api.mainnet-beta.solana.com";
    process.env.I_UNDERSTAND_THIS_IS_NOT_DEVNET = "true";
    // No throw expected: the human has explicitly accepted responsibility.
    assert.match(getConnection().rpcEndpoint, /mainnet/);
  });
});

describe("loadWallet", () => {
  test("throws a friendly error when the wallet file doesn't exist", () => {
    const missing = path.join(os.tmpdir(), "phoca-definitely-not-here.json");
    assert.throws(() => loadWallet(missing), /No wallet found/);
  });

  test("round-trips a keypair saved in the standard format", () => {
    // We write a throwaway keypair to the OS temp dir — NEVER to keys/.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "phoca-test-"));
    const walletPath = path.join(dir, "wallet.json");
    try {
      const original = Keypair.generate();
      fs.writeFileSync(walletPath, JSON.stringify(Array.from(original.secretKey)));
      const loaded = loadWallet(walletPath);
      assert.equal(loaded.publicKey.toBase58(), original.publicKey.toBase58());
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
