# Changelog

All notable changes to PHOCA are documented in this file — every change or
deletion, kept up to date in the same commit that makes the change (see
CLAUDE.md hard rule 8). Format follows [Keep a Changelog](https://keepachangelog.com/en/1.1.0/).
The project is pre-release (devnet learning phase), so sections are dated
rather than versioned until the first tagged release.

## [Unreleased]

### Added (Phase 2 — localnet integration tests, 2026-07-18)
- `tests/integration/localnet.test.ts` + `npm run test:integration`: the
  REAL numbered scripts 01→05 run end to end as child processes against a
  throwaway `solana-test-validator` chain. Asserts script output AND
  on-chain truth (fee rule read from the mint = config, freeze authority
  null, 980/20 transfer arithmetic, 10/5/5 split with 4.9 received,
  self-written transparency-log entry, both treasuries created).
- Test isolation env overrides in utils (`PHOCA_KEYS_DIR`,
  `PHOCA_TRANSPARENCY_LOG`) — integration runs can never touch the real
  devnet wallet, registry, or transparency log. Normal runs never set them.
- CI now installs the Solana CLI (Agave), boots a local validator and runs
  the integration suite on every PR; without a validator the suite skips
  politely (green), so it's always safe to run locally.
- `npm test` narrowed to unit suites (tests/*.test.ts); ROADMAP Phase 2
  integration item closed; README/CLAUDE.md commands updated.

### Added (Phase 2 — fee-split wiring, 2026-07-18)
- **The sweep now splits and distributes**: after collecting the pot,
  `npm run collect-fees` keeps charity's 50% in the collection treasury
  (no transfer → no fee), and sends the 25% community and 25% liquidity
  shares to their own treasuries via `transferCheckedWithFee`. Verified
  live on devnet: pot of 20 → charity kept 10, each share sent 5 /
  received 4.9 — the documented fee-on-fee effect observed on-chain.
- `loadOrCreateTreasury()` in utils: community and liquidity treasuries
  are separate auto-generated wallets (`keys/treasury-*.json`, git-ignored,
  created on first sweep) — checklist §1 "separate wallets" in practice.
  Their ATAs are recorded in the sweep registry.
- Transparency log entries now include the split amounts and one link per
  distribution transfer (`formatSweepLogEntry` extended, backward
  compatible). 4 new tests (58 total).
- FEE-SPLIT.md updated to IMPLEMENTED with the first live run; ROADMAP
  Phase 2 fee-split item closed; README quickstart step 6 reflects
  sweep+split+log.

### Added (Phase 2 — fee-split design + math, 2026-07-18)
- `docs/FEE-SPLIT.md` — full design for turning the single on-chain fee pot
  into the promised 1% / 0.5% / 0.5% split at sweep time: rounding policy
  (crumbs to charity), the counterintuitive fee-on-fee effect on
  distribution transfers (documented with a worked example — it converges
  in charity's favor and stays fully visible on-chain), and the treasury
  model per stage (separate devnet wallets → three multisigs on mainnet).
- `FEE_SPLIT_BPS` in scripts/config.ts (single source of truth, must sum
  to 10,000 — tested) and pure `splitFee()` in utils with hard invariants:
  parts always sum exactly to the pot; charity never below its 50%; tiny
  pots go to charity; negatives rejected. 8 new tests (54 total).
- TOKENOMICS.md and README point to the design doc. On-chain distribution
  wiring is the next PR (needs the treasury-address decision).

### Added (Phase 2 — sweep batching + transparency log, 2026-07-17)
- **Sweep batching**: `npm run collect-fees` now chunks the account registry
  into ≤20 sources per transaction (Solana fits only ~25 withdraw sources
  per tx) — one transaction per batch, all signatures reported. New pure
  `chunk()` helper in utils.
- **Self-documenting sweep**: every sweep auto-appends date, exact amount,
  account count and per-batch explorer links to `docs/TRANSPARENCY-LOG.md`
  (file self-creates with header on first sweep) — the raw feed for the
  monthly transparency report. New `formatSweepLogEntry()` /
  `appendSweepLogEntry()` in utils.
- 8 new tests (46 total): chunk edge cases (remainder, empty, bad sizes),
  log entry format, header-written-once append behavior.
- First real log entry committed: 20 PHOCA swept 2026-07-17 on devnet.
- Scheduling note in 05-collect-fees.ts header (Task Scheduler / cron);
  actual timer cadence remains open in ROADMAP Phase 2.

### Added (license)
- MIT LICENSE for code and documentation (`license: "MIT"` in package.json);
  README "License" section carves out the PHOCA name, logo and brand assets
  (all rights reserved — anti-scam measure, rights move to the legal entity
  in Phase 4). SECURITY-CHECKLIST §9 license item checked off.

### Added (public-repo security hardening, 2026-07-12)
- `SECURITY.md` — security policy for the now-public repo: scope (devnet
  only, no custom on-chain code, keys never in history), private
  vulnerability reporting as the disclosure channel, scam warning.
- SECURITY-CHECKLIST §9 — public repository posture: secret scanning +
  push protection, Dependabot alerts (alerts-only, pins stay manual),
  private vulnerability reporting, CI check as required status check,
  history-scan-before-visibility-change rule, LICENSE decision (pending,
  owner's call).
- CI workflow now declares `permissions: contents: read` explicitly —
  least privilege survives any future repo-default drift.
- Git history audit at go-public: `keys/`, `.env`, and secret-like byte
  arrays confirmed absent from every commit ever pushed.

### Added (Phase 1 — identity & content)
- `assets/phoca-logo.svg` — PRIMARY icon, chosen after a small-size UX
  review: a flat electrum-gold coin (Phocaea minted electrum ~600 BC) with
  a beaded rim and the seal face engraved in near-black bronze. Solid eyes
  with gold "punched" highlights carry recognizability at 32px; three
  whiskers per side sized to survive 48px wallet lists, plus two thinner
  supraorbital (eyebrow) vibrissae per side — anatomically true to real
  seals. `assets/phoca-metadata.json` image points to it. The earlier
  blue-disc variant is kept as `assets/phoca-logo-blue.svg` (secondary
  brand asset for web/stickers). Repo made public by the owner
  (2026-07-12) — the on-chain metadata URI now resolves for
  explorers/wallets. Remaining: owner final sign-off + 512×512 PNG export
  for SVG-less wallets (tracked in ROADMAP Phase 1).
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
