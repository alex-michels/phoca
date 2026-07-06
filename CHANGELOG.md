# Changelog

All notable changes to PHOCA are documented in this file — every change or
deletion, kept up to date in the same commit that makes the change (see
CLAUDE.md hard rule 8). Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
The project is pre-release (devnet learning phase), so sections are dated
rather than versioned until the first tagged release.

## [Unreleased]

_Nothing yet._

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
