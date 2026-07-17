/**
 * Tests for the charity-fee arithmetic.
 *
 * We use calculateEpochFee from @solana/spl-token — the SAME function our
 * transfer script uses to predict the fee before sending. These tests pin
 * down, with plain numbers, what the on-chain program will charge:
 *
 *   fee = ceil(amount × basis_points / 10_000), capped at maximumFee
 *
 * Pure math, no network. The constants come from scripts/config.ts — the
 * SAME values the scripts feed to the chain, so config and tests can never
 * drift apart. The expected numbers below are written out by hand on
 * purpose: if someone changes the fee in config, these tests fail loudly
 * and force a conscious update (and a TOKENOMICS.md update — rule 8).
 */
import { test, describe } from "node:test";
import assert from "node:assert/strict";
import { PublicKey } from "@solana/web3.js";
import { calculateEpochFee, TransferFeeConfig } from "@solana/spl-token";
import {
  FEE_BASIS_POINTS,
  FEE_SPLIT_BPS,
  MAX_FEE,
  ONE_PHOCA as ONE,
} from "../scripts/config";
import { splitFee } from "../scripts/utils";

/** Build a synthetic on-chain fee config like the one our mint carries. */
function feeConfig(
  bps: number = FEE_BASIS_POINTS,
  maxFee: bigint = MAX_FEE
): TransferFeeConfig {
  const fee = { epoch: 0n, maximumFee: maxFee, transferFeeBasisPoints: bps };
  return {
    transferFeeConfigAuthority: PublicKey.default,
    withdrawWithheldAuthority: PublicKey.default,
    withheldAmount: 0n,
    olderTransferFee: fee,
    newerTransferFee: fee,
  };
}

describe("charity fee arithmetic (2% / 200 bps, capped at 5,000 PHOCA)", () => {
  test("2% of 1,000 PHOCA is exactly 20 PHOCA", () => {
    const fee = calculateEpochFee(feeConfig(), 0n, 1_000n * ONE);
    assert.equal(fee, 20n * ONE);
  });

  test("a whale transfer hits the cap: 1,000,000 PHOCA pays 5,000, not 20,000", () => {
    const fee = calculateEpochFee(feeConfig(), 0n, 1_000_000n * ONE);
    assert.equal(fee, MAX_FEE);
  });

  test("the cap boundary: 250,000 PHOCA × 2% lands exactly ON the 5,000 cap", () => {
    const fee = calculateEpochFee(feeConfig(), 0n, 250_000n * ONE);
    assert.equal(fee, MAX_FEE);
  });

  test("just below the boundary is NOT capped", () => {
    const amount = 250_000n * ONE - ONE; // 249,999 PHOCA
    const fee = calculateEpochFee(feeConfig(), 0n, amount);
    assert.ok(fee < MAX_FEE);
    assert.equal(fee, (amount * 200n + 9_999n) / 10_000n); // ceil(amount × 2%)
  });

  test("zero amount pays zero fee", () => {
    assert.equal(calculateEpochFee(feeConfig(), 0n, 0n), 0n);
  });

  test("rounding goes UP (in the charity's favor): 1 base unit still pays 1", () => {
    // ceil(1 × 200 / 10_000) = ceil(0.02) = 1 base unit
    assert.equal(calculateEpochFee(feeConfig(), 0n, 1n), 1n);
  });

  test("0 basis points means no fee at all", () => {
    assert.equal(calculateEpochFee(feeConfig(0), 0n, 1_000n * ONE), 0n);
  });

  test("fee changes are epoch-aware: old rate before, new rate after", () => {
    // On-chain, a fee change only takes effect at a later epoch — users can
    // never be surprised mid-transaction. Model a 1% → 2% change at epoch 5:
    const config: TransferFeeConfig = {
      transferFeeConfigAuthority: PublicKey.default,
      withdrawWithheldAuthority: PublicKey.default,
      withheldAmount: 0n,
      olderTransferFee: { epoch: 0n, maximumFee: MAX_FEE, transferFeeBasisPoints: 100 },
      newerTransferFee: { epoch: 5n, maximumFee: MAX_FEE, transferFeeBasisPoints: 200 },
    };
    assert.equal(calculateEpochFee(config, 3n, 1_000n * ONE), 10n * ONE); // still 1%
    assert.equal(calculateEpochFee(config, 7n, 1_000n * ONE), 20n * ONE); // now 2%
  });
});

describe("fee-pot split (50% charity / 25% community / 25% liquidity of the pot)", () => {
  test("the split config itself must sum to exactly 100%", () => {
    // Guards config edits: a split that doesn't total 10_000 bps would
    // silently mint or vaporize treasury money in the math below.
    assert.equal(
      FEE_SPLIT_BPS.charity + FEE_SPLIT_BPS.community + FEE_SPLIT_BPS.liquidity,
      10_000
    );
  });

  test("a clean pot splits exactly: 100 -> 50 / 25 / 25", () => {
    const s = splitFee(100n * ONE);
    assert.equal(s.charity, 50n * ONE);
    assert.equal(s.community, 25n * ONE);
    assert.equal(s.liquidity, 25n * ONE);
  });

  test("rounding crumbs go to charity: 101 base units -> 51 / 25 / 25", () => {
    const s = splitFee(101n);
    assert.equal(s.community, 25n);
    assert.equal(s.liquidity, 25n);
    assert.equal(s.charity, 51n); // 50 + the 1-unit crumb
  });

  test("tiny pots never vanish: 1 base unit goes entirely to charity", () => {
    const s = splitFee(1n);
    assert.deepEqual(s, { charity: 1n, community: 0n, liquidity: 0n });
  });

  test("zero pot, zero everywhere", () => {
    assert.deepEqual(splitFee(0n), { charity: 0n, community: 0n, liquidity: 0n });
  });

  test("negative pots are rejected loudly", () => {
    assert.throws(() => splitFee(-1n), /negative/);
  });

  test("INVARIANT: parts always sum to the exact input, for awkward values too", () => {
    const awkward = [1n, 2n, 3n, 7n, 99n, 101n, 9_999n, 10_001n,
      123_456_789n, 987_654_321_987n, 1_000_000_000n * ONE];
    for (const total of awkward) {
      const s = splitFee(total);
      assert.equal(
        s.charity + s.community + s.liquidity,
        total,
        `sum must equal input for ${total}`
      );
    }
  });

  test("charity never gets LESS than its exact 50% share (crumbs only add)", () => {
    for (const total of [1n, 3n, 101n, 999n, 12_345_678_901n]) {
      const s = splitFee(total);
      assert.ok(s.charity * 2n >= total, `charity share must be >= half of ${total}`);
    }
  });
});
