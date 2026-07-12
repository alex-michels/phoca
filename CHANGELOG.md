# Changelog

All notable changes to PHOCA are documented in this file — every change or
deletion, kept up to date in the same commit that makes the change (see
CLAUDE.md hard rule 8). Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
The project is pre-release (devnet learning phase), so sections are dated
rather than versioned until the first tagged release.

## [Unreleased]

### Added (Phase 1 — identity & content)
- `docs/BRAND-STORY.md` — publication-ready brand copy (the Phocaea story,
  what PHOCA is / is not, charity mechanism as implemented, devnet status),
  written to COMPLIANCE-EU Phase C rules: no profit language, verifiable
  claims only, risk statement included. Final legal review remains a
  Phase 4 gate.
- LEGAL-NOTES §1 naming re-check (2026-07-12) with hard evidence: DEX
  Screener and CoinGecko public search APIs both return **zero** PHOCA
  results; the dead ETH micro-token from the earlier check no longer
  surfaces; phoca.cz confirmed active and unrelated (CMS software). EUIPO/
  TMview manual trademark query flagged for the Phase 4 counsel agenda.
- ROADMAP Phase 1: brand story + name re-check marked done (logo and
  charity focus list remain).

### Fixed (2026-07 code review)
- **Interlock hardened**: the safety check now parses the RPC URL and looks
  only at the hostname — `https://mainnet-rpc.example.com/?key=devnet` and
  `https://evil-localhost.com` no longer slip past it; unparseable URLs are
  refused. New pure `isSafeRpcUrl()` with adversarial tests.
- **Chain-fingerprint check**: every script now calls `assertDevnet()`,
  verifying the cluster's genesis hash against devnet's (fetched and pinned
  2026-07-06) — a URL can sound like devnet, the genesis hash can't lie.
  Local validators skipped; same single `.env` override as the URL interlock.
- `engines` raised `>=18` → `>=22`: the test runner uses `--import` and
  `--test` glob patterns that don't exist on Node 18/20. README updated.
- BigInt display bugs: supply printed as `1000000000n`; amounts converted
  via `Number()` lost precision above ~9M PHOCA. New exact `formatPhoca()`
  helper (tested) is now the only way amounts are displayed.
- Corrupted registry or wallet files now fail loudly with friendly errors
  (never silently as an empty list; never echoing file contents).

### Added
- `scripts/config.ts` — single source of truth for supply, decimals, fee,
  name, metadata URI. Previously DECIMALS was declared independently in four
  scripts and the fee constants again in tests; nothing enforced agreement.
  Scripts AND tests now import the same values. (16 new tests, 38 total.)
- Registry completeness rule (documented in utils.ts): every script that
  creates/uses a token account records it — 03-mint-supply and
  05-collect-fees now record the treasury ATA too.
- SECURITY-CHECKLIST §2: metadata-update authority added to the authority
  matrix (fourth power the dev wallet holds; multisig before mainnet).
- ROADMAP Phase 2: sweep batching item (~25 source accounts fit per
  withdraw transaction).
- CLAUDE.md hard rule 9: every change goes through a pull request — branch,
  PR with CHANGELOG entry, CI green, owner review before merge. No direct
  commits to main. (This rule itself arrived via the first PR.)

## 2026-07-06 — Devnet initialization + fee-sweep hardening

### Added
- **PHOCA initialized on devnet, end to end**: mint
  `BjEPXiw8jKMdRAxyhoVdcszHGCfWXaBSANqXhzzw6bux` created with fee + metadata
  extensions, 1B supply minted, two fee-visible transfers (2×20 PHOCA
  withheld), 40 PHOCA swept to treasury. Every tx logged in
  docs/DEVNET-LOG.md.
- **Token-account registry** (`scripts/utils.ts`): `recordTokenAccount` /
  `readTokenAccounts` — the transfer script records every account it
  touches (keys/token-accounts.json, git-ignored, public addresses only);
  the fee sweep reads the registry instead of scanning the chain. Three new
  registry tests (22 total).

### Fixed
- `scripts/05-collect-fees.ts` no longer relies on `getProgramAccounts`,
  which public RPCs disable for Token-2022 (and their holder-scan
  alternative is heavily rate-limited). Sweep now uses the local registry
  with cheap per-account lookups; RPC holder scan remains only as a
  fallback. Closed/nonexistent accounts are skipped gracefully.

## 2026-07-06 — Token identity, tests, governance, roadmap

### Added
- **On-chain token identity**: `scripts/02-create-token.ts` now initializes the
  MetadataPointer + TokenMetadata extensions — the mint itself carries name
  `PHOCA`, symbol `PHOCA`, and a metadata URI. One transaction, one mint,
  no separate metadata program.
- `assets/phoca-metadata.json` — rich metadata (description, logo link,
  Phocaea story) that the on-chain URI points to. Logo file
  (`assets/phoca-logo.png`) to be provided; URI is updatable by the update
  authority, permanent hosting (Arweave/Irys) is a mainnet-phase task.
- **Test suite** (Node built-in `node:test` runner via tsx — zero new runtime
  dependencies): `tests/utils.test.ts` (the non-devnet interlock, from every
  angle, + wallet loading) and `tests/fee-math.test.ts` (charity-fee
  arithmetic: 2%, cap, rounding, epoch-aware fee changes). `npm test`.
- **Documentation governance**: this CHANGELOG; CLAUDE.md hard rule 8 (every
  change documented in the same commit); `npm test` added to the
  after-every-change checklist.
- **CI**: `.github/workflows/ci.yml` — `npm ci`, typecheck, tests on every
  push/PR; dependency audit report-only (known advisories triaged in
  SECURITY-CHECKLIST §8).
- **Master roadmap**: `docs/ROADMAP.md` — phased plan with exit criteria from
  devnet foundation to mainnet launch gates and post-launch operations.
- `docs/DEVNET-LOG.md` — record of every devnet run artifact (addresses, tx
  links); doubles as transparency-report practice.
- Dependencies: `@solana/spl-token-metadata@0.1.6` promoted to a direct,
  exact-pinned dependency (was already present transitively via
  `@solana/spl-token` — same version, deduped, no new code).
  `@types/node@24.13.2` (dev-only, for `node:test` type definitions).

### Changed
- `scripts/utils.ts`: `loadWallet()` accepts an optional path parameter for
  tests; default behavior unchanged.
- `tsconfig.json`: typecheck now also covers `tests/**`.
- README: quickstart reflects metadata-at-creation, adds testing section and
  links to ROADMAP/CHANGELOG.

## 2026-07-06 — Initial commit

### Added
- Numbered devnet scripts: wallet creation + airdrop, Token-2022 mint with
  TransferFee extension (2% / 200 bps, cap 5,000 PHOCA), supply mint (1B),
  fee-visible transfer demo (`transferCheckedWithFee`), withheld-fee sweep.
- Hard non-devnet interlock in `scripts/utils.ts`.
- Docs: tokenomics draft, security checklist, EU/MiCA compliance workstream,
  legal notes, learning roadmap, transparency report template.
- Exact-pinned official dependencies with committed lockfile.
- `.gitattributes` line-ending normalization; `keys/` and `.env` git-ignored.
