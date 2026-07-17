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
import { Connection, Keypair } from "@solana/web3.js";
import {
  getConnection,
  assertDevnet,
  isSafeRpcUrl,
  formatPhoca,
  loadWallet,
  readTokenAccounts,
  recordTokenAccount,
  chunk,
  formatSweepLogEntry,
  appendSweepLogEntry,
  loadOrCreateTreasury,
  splitFee,
  DEVNET_GENESIS_HASH,
} from "../scripts/utils";
import { ONE_PHOCA } from "../scripts/config";

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

describe("isSafeRpcUrl — adversarial inputs the old substring check missed", () => {
  test("honest devnet and local URLs pass", () => {
    assert.equal(isSafeRpcUrl("https://api.devnet.solana.com"), true);
    assert.equal(isSafeRpcUrl("http://localhost:8899"), true);
    assert.equal(isSafeRpcUrl("http://127.0.0.1:8899"), true);
  });

  test("third-party devnet providers pass (devnet inside a hostname label)", () => {
    assert.equal(isSafeRpcUrl("https://devnet.helius-rpc.com/?api-key=x"), true);
    assert.equal(isSafeRpcUrl("https://solana-devnet.g.alchemy.com/v2/key"), true);
  });

  test("'devnet' in the QUERY STRING does not fool the check", () => {
    assert.equal(isSafeRpcUrl("https://mainnet-rpc.example.com/?key=devnet"), false);
  });

  test("'devnet' in the PATH does not fool the check", () => {
    assert.equal(isSafeRpcUrl("https://rpc.example.com/devnet-lol"), false);
  });

  test("sound-alike hostnames do not fool the localhost rule", () => {
    assert.equal(isSafeRpcUrl("https://evil-localhost.com"), false);
    assert.equal(isSafeRpcUrl("https://127.0.0.1.evil.com"), false);
  });

  test("mainnet and testnet are refused", () => {
    assert.equal(isSafeRpcUrl("https://api.mainnet-beta.solana.com"), false);
    assert.equal(isSafeRpcUrl("https://api.testnet.solana.com"), false);
  });

  test("garbage that doesn't parse as a URL is refused, not crashed on", () => {
    assert.equal(isSafeRpcUrl("not a url at all"), false);
    assert.equal(isSafeRpcUrl(""), false);
  });
});

describe("assertDevnet — the chain-fingerprint check", () => {
  // We stub the RPC call: these tests need no network. What matters is the
  // DECISION the function makes for a given genesis hash.
  function fakeConnection(endpoint: string, genesisHash: string): Connection {
    return {
      rpcEndpoint: endpoint,
      getGenesisHash: async () => genesisHash,
    } as unknown as Connection;
  }

  let savedOverride: string | undefined;
  beforeEach(() => {
    savedOverride = process.env.I_UNDERSTAND_THIS_IS_NOT_DEVNET;
    delete process.env.I_UNDERSTAND_THIS_IS_NOT_DEVNET;
  });
  afterEach(() => {
    if (savedOverride === undefined) delete process.env.I_UNDERSTAND_THIS_IS_NOT_DEVNET;
    else process.env.I_UNDERSTAND_THIS_IS_NOT_DEVNET = savedOverride;
  });

  test("accepts a chain whose genesis hash IS devnet's", async () => {
    await assertDevnet(
      fakeConnection("https://api.devnet.solana.com", DEVNET_GENESIS_HASH)
    );
  });

  test("REFUSES a devnet-looking URL backed by a different chain", async () => {
    await assert.rejects(
      assertDevnet(fakeConnection("https://devnet.sneaky.example.com", "SomeOtherGenesisHash111")),
      /genesis hash does not match devnet/
    );
  });

  test("skips the check for a local validator (random genesis hash is fine)", async () => {
    await assertDevnet(fakeConnection("http://127.0.0.1:8899", "RandomLocalHash"));
  });

  test("the explicit override skips the check (same override as the URL interlock)", async () => {
    process.env.I_UNDERSTAND_THIS_IS_NOT_DEVNET = "true";
    await assertDevnet(fakeConnection("https://api.mainnet-beta.solana.com", "WrongHash"));
  });
});

describe("chunk — batching for the fee sweep", () => {
  test("splits with a remainder chunk at the end, order preserved", () => {
    assert.deepEqual(chunk([1, 2, 3, 4, 5], 2), [[1, 2], [3, 4], [5]]);
  });

  test("exact multiples produce equal chunks", () => {
    assert.deepEqual(chunk(["a", "b", "c", "d"], 2), [["a", "b"], ["c", "d"]]);
  });

  test("a list smaller than the chunk size stays whole", () => {
    assert.deepEqual(chunk([1, 2], 20), [[1, 2]]);
  });

  test("empty list → no batches (the sweep sends zero transactions)", () => {
    assert.deepEqual(chunk([], 20), []);
  });

  test("nonsense sizes are rejected loudly", () => {
    assert.throws(() => chunk([1], 0), /positive integer/);
    assert.throws(() => chunk([1], -3), /positive integer/);
    assert.throws(() => chunk([1], 2.5), /positive integer/);
  });
});

describe("transparency log", () => {
  test("a sweep entry carries date, exact amount, account count and one link per batch", () => {
    const entry = formatSweepLogEntry("2026-07-12", 60n * ONE_PHOCA, 3, ["SigOne111", "SigTwo222"]);
    assert.match(entry, /### 2026-07-12 — swept 60 PHOCA/);
    assert.match(entry, /Accounts holding fees: 3/);
    assert.match(entry, /Transactions \(2\):/);
    assert.match(entry, /batch 1: \[SigOne11…\]\(https:\/\/explorer\.solana\.com\/tx\/SigOne111\?cluster=devnet\)/);
    assert.match(entry, /batch 2: \[SigTwo22…\]/);
  });

  test("single-batch sweeps read grammatically ('Transaction (1)')", () => {
    const entry = formatSweepLogEntry("2026-07-12", 20n * ONE_PHOCA, 1, ["OnlySig"]);
    assert.match(entry, /Transaction \(1\):/);
  });

  test("an entry with split + distributions records the division and both transfers", () => {
    const split = splitFee(100n * ONE_PHOCA);
    const entry = formatSweepLogEntry("2026-07-18", 100n * ONE_PHOCA, 2, ["SweepSig1"], split, [
      { name: "community", signature: "CommSig11" },
      { name: "liquidity", signature: "LiqSig111" },
    ]);
    assert.match(entry, /Split of the pot: charity keeps 50 · community 25 · liquidity 25/);
    assert.match(entry, /Distribution transfers .*2% fee applies/);
    assert.match(entry, /community: \[CommSig1…\]\(https:\/\/explorer\.solana\.com\/tx\/CommSig11\?cluster=devnet\)/);
    assert.match(entry, /liquidity: \[LiqSig11…\]/);
  });

  test("entries without split stay exactly as before (backward compatible)", () => {
    const entry = formatSweepLogEntry("2026-07-18", 20n * ONE_PHOCA, 1, ["OnlySig"]);
    assert.doesNotMatch(entry, /Split of the pot/);
    assert.doesNotMatch(entry, /Distribution/);
  });

  test("appending creates the file with its header ONCE, then only appends", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "phoca-translog-"));
    const logPath = path.join(dir, "TRANSPARENCY-LOG.md");
    try {
      appendSweepLogEntry("\n### first entry\n", logPath);
      appendSweepLogEntry("\n### second entry\n", logPath);
      const content = fs.readFileSync(logPath, "utf-8");
      const headerCount = content.split("PHOCA transparency log").length - 1;
      assert.equal(headerCount, 1, "header must appear exactly once");
      assert.match(content, /first entry/);
      assert.match(content, /second entry/);
      assert.ok(content.indexOf("first entry") < content.indexOf("second entry"));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("loadOrCreateTreasury — separate wallets, created once", () => {
  test("creates a treasury on first use and loads the SAME key afterwards", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "phoca-treasury-"));
    try {
      const first = loadOrCreateTreasury("community", dir);
      const second = loadOrCreateTreasury("community", dir);
      assert.equal(second.publicKey.toBase58(), first.publicKey.toBase58());
      assert.ok(fs.existsSync(path.join(dir, "treasury-community.json")));
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("different treasury names get genuinely different keys", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "phoca-treasury-"));
    try {
      const community = loadOrCreateTreasury("community", dir);
      const liquidity = loadOrCreateTreasury("liquidity", dir);
      assert.notEqual(community.publicKey.toBase58(), liquidity.publicKey.toBase58());
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});

describe("formatPhoca — exact display at any size", () => {
  test("whole amounts", () => {
    assert.equal(formatPhoca(0n), "0");
    assert.equal(formatPhoca(20n * ONE_PHOCA), "20");
    assert.equal(formatPhoca(1_000_000_000n * ONE_PHOCA), "1000000000"); // full supply, exact
  });

  test("fractional amounts, trailing zeros trimmed", () => {
    assert.equal(formatPhoca(1n), "0.000000001"); // 1 base unit
    assert.equal(formatPhoca(ONE_PHOCA / 2n), "0.5");
    assert.equal(formatPhoca(980n * ONE_PHOCA + ONE_PHOCA / 4n), "980.25");
  });

  test("stays exact where Number() would silently lie", () => {
    // 123,456,789.123456789 PHOCA — beyond Number's 2^53 safe range in base units
    const tricky = 123_456_789n * ONE_PHOCA + 123_456_789n;
    assert.equal(formatPhoca(tricky), "123456789.123456789");
  });
});

describe("token account registry (feeds the fee sweep)", () => {
  test("no registry file yet → empty list, no crash", () => {
    const missing = path.join(os.tmpdir(), "phoca-no-registry-here.json");
    assert.deepEqual(readTokenAccounts(missing), []);
  });

  test("records addresses, reads them back, and never duplicates", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "phoca-registry-"));
    const registry = path.join(dir, "token-accounts.json");
    try {
      recordTokenAccount("SealAccountOne1111111111111111111111111111", registry);
      recordTokenAccount("SealAccountTwo2222222222222222222222222222", registry);
      // Recording the same account twice must NOT create a duplicate entry —
      // otherwise the sweep would query (and count) it twice.
      recordTokenAccount("SealAccountOne1111111111111111111111111111", registry);
      assert.deepEqual(readTokenAccounts(registry), [
        "SealAccountOne1111111111111111111111111111",
        "SealAccountTwo2222222222222222222222222222",
      ]);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("creates the parent directory if it doesn't exist yet", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "phoca-registry-"));
    const registry = path.join(dir, "deeper", "nested", "token-accounts.json");
    try {
      recordTokenAccount("SealAccountOne1111111111111111111111111111", registry);
      assert.equal(readTokenAccounts(registry).length, 1);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });

  test("a corrupted registry fails LOUDLY, never silently as an empty list", () => {
    // Silent [] would make the sweep quietly miss fees — that must not happen.
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "phoca-registry-"));
    const registry = path.join(dir, "token-accounts.json");
    try {
      fs.writeFileSync(registry, "{ this is not json");
      assert.throws(() => readTokenAccounts(registry), /not valid JSON/);
      fs.writeFileSync(registry, JSON.stringify({ nope: true }));
      assert.throws(() => readTokenAccounts(registry), /array of address strings/);
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
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

  test("a corrupted wallet file gives a friendly error that leaks nothing", () => {
    const dir = fs.mkdtempSync(path.join(os.tmpdir(), "phoca-test-"));
    const walletPath = path.join(dir, "wallet.json");
    try {
      fs.writeFileSync(walletPath, "definitely-not-json-secret-stuff");
      assert.throws(() => loadWallet(walletPath), (err: Error) => {
        assert.match(err.message, /corrupted/);
        // The error must never echo the file's CONTENT (could be key material).
        assert.doesNotMatch(err.message, /definitely-not-json-secret-stuff/);
        return true;
      });
    } finally {
      fs.rmSync(dir, { recursive: true, force: true });
    }
  });
});
