# CLAUDE.md — project instructions for Claude Code

## What this project is
PHOCA ($PHOCA) — a seal-themed community/charity token on Solana, built by a
beginner learning blockchain development toward a compliant EU launch. Named
after the seal genus Phoca and the ancient Greek city of Phocaea, one of the
world's first coin minters (~600 BC), whose coins bore a seal as the civic
badge. Part of the on-chain transfer fee funds seal rescue and marine mammal
protection. Explain things in simple language when asked — this repo doubles
as the owner's textbook.

## Token identity (use these constants everywhere)
- Name: PHOCA · Symbol: PHOCA · Chain: Solana
- Standard: Token-2022 (Token Extensions) with the TransferFee extension and
  on-chain metadata (MetadataPointer + TokenMetadata, stored in the mint)
- Freeze authority: none, by design. Mint authority: to be revoked after supply mint.
- All token parameters (supply, decimals, fee, name, URI) live in
  scripts/config.ts — the single source of truth for scripts AND tests.

## Tech stack
- TypeScript + Node.js, @solana/web3.js + @solana/spl-token (exact-pinned versions)
- Network: **devnet only**; utils.ts enforces a hard interlock on non-devnet RPCs

## Commands
- `npm run wallet` — create devnet wallet + airdrop test SOL
- `npm run create-token` — create the mint with transfer-fee + metadata extensions
- `npm run mint-supply` — mint total supply to the treasury
- `npm run transfer-test` — demo transfer showing the charity fee being withheld
- `npm run collect-fees` — sweep withheld fees into the charity treasury
- `npm test` — interlock + fee-math test suite; must be green after every code edit
- `npm run test:integration` — real scripts 01→05 on a local validator; skips
  without one (CI runs it on every PR)
- `npm run typecheck` — must be clean after every code edit
- `npm run audit` — dependency check; NEVER `npm audit fix --force` (see SECURITY-CHECKLIST §8)

## Hard rules (never break these)
1. NEVER print, log, move or commit private keys. `keys/` is git-ignored — keep it that way.
2. NEVER weaken or bypass the non-devnet interlock in utils.ts, and never craft
   mainnet transactions, unless the user explicitly asks and confirms in the chat.
3. All transfers of Token-2022 tokens with fees must use `transferCheckedWithFee`
   (or `transferChecked`) — plain `transfer` will fail or behave wrong.
4. NEVER change token authorities (mint/freeze/fee/withdraw) or fee parameters
   in code without an explicit user request naming the change.
5. Dependencies: official Solana Labs / Anza / Metaplex packages only; exact
   versions; run `npm run audit` after any dependency change; keep
   package-lock.json committed; use `npm ci` in any automation.
6. After any code change, run `npm run typecheck` AND `npm test`; fix failures
   before finishing.
7. Public-facing text (README, site copy, posts) must stay consistent with
   docs/COMPLIANCE-EU.md: no profit promises, risk-aware wording, charity
   claims only as implemented on-chain.
8. Documentation stays true: every change or deletion gets a CHANGELOG.md
   entry, and any doc the change invalidates (README, docs/*) is updated in
   the SAME commit. No orphaned docs, no undocumented changes.
9. Every change goes through a pull request — work on a branch, open a PR
   (CHANGELOG entry included), let CI pass, merge only after the owner's
   review. No direct commits to main. ("Every line that moves value gets a
   second pair of eyes" — SECURITY-CHECKLIST §4 — starts as a habit here.)

## Style
- Small, numbered, single-purpose scripts in `scripts/`
- Heavy comments in plain language
