/**
 * config.ts — the single source of truth for PHOCA's parameters.
 *
 * Why this file exists: these values used to be declared separately in four
 * scripts (and again in the tests). Nothing enforced that they agreed — change
 * one and the others silently lie. The numbered scripts run main() the moment
 * they're imported, so constants can't live there; they live here, and
 * scripts AND tests import the very same values.
 *
 * If you change anything here, docs/TOKENOMICS.md changes in the same commit
 * (CLAUDE.md rule 8) — and fee/authority values need an explicit, named
 * decision first (rule 4). These are promises, not knobs.
 */

export const TOKEN_NAME = "PHOCA";
export const TOKEN_SYMBOL = "PHOCA";

// Where wallets/explorers fetch the rich metadata (description, logo, links).
// NOTE: the repo is private right now, so this URL won't resolve publicly yet —
// fine on devnet. The update authority can change the URI later; mainnet
// requires permanent hosting (Arweave/Irys) — see docs/ROADMAP.md Phase 5.
export const METADATA_URI =
  "https://raw.githubusercontent.com/alex-michels/phoca/main/assets/phoca-metadata.json";

export const DECIMALS = 9; // 1 PHOCA = 10^9 base units (like cents, but 10^9)

/** One whole PHOCA, in base units. */
export const ONE_PHOCA = 10n ** BigInt(DECIMALS);

export const FEE_BASIS_POINTS = 200; // 200 bps = 2.00% charity fee per transfer

/** The fee is capped at 5,000 PHOCA per transfer (protects whales). */
export const MAX_FEE = 5_000n * ONE_PHOCA;

/** Fixed total supply: 1 billion PHOCA. Mint authority revoked after minting. */
export const TOTAL_SUPPLY = 1_000_000_000n * ONE_PHOCA;

/**
 * How the collected fee pot is split, in basis points OF THE POT (not of the
 * transfer). TOKENOMICS.md promises 1% / 0.5% / 0.5% of every transfer;
 * the on-chain fee collects the whole 2% into ONE pot, so at sweep time the
 * pot divides 50% / 25% / 25%. Must sum to exactly 10_000 — tested.
 */
export const FEE_SPLIT_BPS = {
  charity: 5_000,   // 50% of the pot = 1.0% of each transfer
  community: 2_500, // 25% of the pot = 0.5% of each transfer
  liquidity: 2_500, // 25% of the pot = 0.5% of each transfer
} as const;
