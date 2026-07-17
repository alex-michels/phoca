/**
 * INTEGRATION TEST — the real scripts, end to end, on a throwaway chain.
 *
 * Unit tests check the logic; THIS test checks the truth: it runs the actual
 * numbered scripts (01 → 05) as child processes against a LOCAL test
 * validator (`solana-test-validator`) — a fresh, disposable blockchain on
 * 127.0.0.1 — and asserts both the script output and the on-chain state.
 *
 * Isolation: the scripts get PHOCA_KEYS_DIR / PHOCA_TRANSPARENCY_LOG pointed
 * at a temp directory, so this test can never touch the real devnet wallet,
 * mint file, registry, or transparency log.
 *
 * If no validator is running, the test SKIPS (green, not red) — so `npm run
 * test:integration` is always safe to run. CI installs the Solana CLI,
 * starts a validator and runs this on every PR. To run locally:
 *   solana-test-validator --reset   (in another terminal, needs Solana CLI)
 *   npm run test:integration
 */
import { test } from "node:test";
import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { createSolanaRpc, address } from "@solana/kit";
import { fetchMint } from "@solana-program/token-2022";
import { FEE_BASIS_POINTS, MAX_FEE } from "../../scripts/config";
import { findExtension } from "../../scripts/utils";

const LOCALNET = "http://127.0.0.1:8899";
const REPO_ROOT = path.join(__dirname, "..", "..");

async function localnetUp(): Promise<boolean> {
  try {
    const res = await fetch(LOCALNET, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ jsonrpc: "2.0", id: 1, method: "getHealth" }),
      signal: AbortSignal.timeout(1500),
    });
    const body = (await res.json()) as { result?: string };
    return body.result === "ok";
  } catch {
    return false;
  }
}

/** Run one numbered script exactly like `npm run …` does; fail loudly with its output. */
function runScript(file: string, env: Record<string, string>): string {
  const result = spawnSync(
    process.execPath,
    ["--import=tsx", path.join("scripts", file)],
    {
      cwd: REPO_ROOT,
      encoding: "utf-8",
      timeout: 120_000,
      env: { ...process.env, ...env },
    }
  );
  assert.equal(
    result.status,
    0,
    `scripts/${file} exited with ${result.status}:\n${result.stdout}\n${result.stderr}`
  );
  return result.stdout;
}

test(
  "full PHOCA lifecycle on a local validator (skips when none is running)",
  { timeout: 300_000 },
  async (t) => {
    if (!(await localnetUp())) {
      t.skip("no local validator at 127.0.0.1:8899 — run `solana-test-validator` to enable");
      return;
    }

    const sandbox = fs.mkdtempSync(path.join(os.tmpdir(), "phoca-localnet-"));
    const env = {
      RPC_URL: LOCALNET,
      PHOCA_KEYS_DIR: path.join(sandbox, "keys"),
      PHOCA_TRANSPARENCY_LOG: path.join(sandbox, "TRANSPARENCY-LOG.md"),
    };
    try {
      // 01 — wallet + airdrop (the local faucet grants instantly)
      const out1 = runScript("01-create-wallet.ts", env);
      assert.match(out1, /New devnet wallet created/);
      assert.doesNotMatch(out1, /Airdrop failed/);

      // 02 — mint with fee + metadata extensions
      const out2 = runScript("02-create-token.ts", env);
      assert.match(out2, /Token created/);
      const mintAddress = fs
        .readFileSync(path.join(env.PHOCA_KEYS_DIR, "mint-address.txt"), "utf-8")
        .trim();

      // Don't trust the script's stdout — ask the CHAIN what rule it enforces
      const rpc = createSolanaRpc(LOCALNET);
      const mintAccount = await fetchMint(rpc, address(mintAddress));
      const feeConfig = findExtension(mintAccount.data.extensions, "TransferFeeConfig");
      assert.ok(feeConfig, "mint must carry a transfer fee config");
      assert.equal(feeConfig.newerTransferFee.transferFeeBasisPoints, FEE_BASIS_POINTS);
      assert.equal(feeConfig.newerTransferFee.maximumFee, MAX_FEE);
      assert.equal(
        mintAccount.data.freezeAuthority.__option,
        "None",
        "freeze authority must be null by design"
      );

      // 03 — full supply
      const out3 = runScript("03-mint-supply.ts", env);
      assert.match(out3, /Minted 1000000000 PHOCA to treasury/);

      // 04 — fee-visible transfer: 1,000 sent → 980 received, 20 withheld
      const out4 = runScript("04-transfer-test.ts", env);
      assert.match(out4, /Recipient received: 980 PHOCA/);
      assert.match(out4, /Withheld for charity on this account: 20 PHOCA/);

      // 05 — sweep + split + distribution + self-written log
      const out5 = runScript("05-collect-fees.ts", env);
      assert.match(out5, /Total to collect: 20 PHOCA/);
      assert.match(out5, /charity keeps 10/);
      assert.match(out5, /receives 4\.9 after the on-chain fee/);

      const log = fs.readFileSync(env.PHOCA_TRANSPARENCY_LOG, "utf-8");
      assert.match(log, /swept 20 PHOCA/);
      assert.match(log, /charity keeps 10 · community 5 · liquidity 5/);
      assert.match(log, /community: \[/);
      assert.match(log, /liquidity: \[/);

      // Isolation proof: the throwaway run produced its own wallet + treasuries
      assert.ok(fs.existsSync(path.join(env.PHOCA_KEYS_DIR, "treasury-community.json")));
      assert.ok(fs.existsSync(path.join(env.PHOCA_KEYS_DIR, "treasury-liquidity.json")));
    } finally {
      fs.rmSync(sandbox, { recursive: true, force: true });
    }
  }
);
