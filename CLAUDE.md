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
- Standard: Token-2022 (Token Extensions) with the TransferFee extension
- Freeze authority: none, by design. Mint authority: to be revoked after supply mint.

## Tech stack
- TypeScript + Node.js, @solana/web3.js + @solana/spl-token (exact-pinned versions)
- Network: **devnet only**; utils.ts enforces a hard interlock on non-devnet RPCs

## Commands
- `npm run wallet` — create devnet wallet + airdrop test SOL
- `npm run create-token` — create the mint with transfer-fee extension
- `npm run mint-supply` — mint total supply to the treasury
- `npm run transfer-test` — demo transfer showing the charity fee being withheld
- `npm run collect-fees` — sweep withheld fees into the charity treasury
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
6. After any code change, run `npm run typecheck` and fix errors before finishing.
7. Public-facing text (README, site copy, posts) must stay consistent with
   docs/COMPLIANCE-EU.md: no profit promises, risk-aware wording, charity
   claims only as implemented on-chain.

## Style
- Small, numbered, single-purpose scripts in `scripts/`
- Heavy comments in plain language
