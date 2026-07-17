# 🦭 PHOCA Master Roadmap — devnet to a compliant EU launch

**The one document that ties everything together.** Each phase has explicit
exit criteria — a phase is DONE when every box is checked, and later phases
must not start on wishful thinking. Detail lives in the linked docs; this file
is the map, not the territory.

**Reading order for newcomers**: README → this file → the linked doc for
whatever phase is active.

> ⚠️ Ground rules that never change, in every phase: devnet interlock stays on
> until Phase 5 says otherwise (CLAUDE.md rule 2) · every change documented in
> CHANGELOG.md · public wording per docs/COMPLIANCE-EU.md Phase C — no profit
> promises, ever.

---

## Phase 0 — Devnet foundation ✅ (current phase, nearly complete)

**Goal:** a fully working, tested, reproducible PHOCA on devnet.

| Item | Status |
|---|---|
| Scripts 01–05: wallet, mint w/ 2% transfer fee, supply, fee-visible transfer, fee sweep | ✅ |
| On-chain metadata (MetadataPointer + TokenMetadata: name/symbol/URI in the mint) | ✅ code |
| Test suite: non-devnet interlock + fee math (`npm test`) | ✅ |
| CI on every push: `npm ci` → typecheck → tests → audit report | ✅ |
| Docs governance: CHANGELOG + same-commit doc updates (CLAUDE.md rule 8) | ✅ |
| End-to-end devnet run recorded in docs/DEVNET-LOG.md | ✅ 2026-07-06 |

**Exit criteria:** fresh clone → `npm ci` → all scripts run end-to-end on
devnet → explorer shows PHOCA with fee + metadata extensions → CI green →
every artifact logged in DEVNET-LOG.md.

## Phase 1 — Identity & content

**Goal:** PHOCA looks and reads like a real project (still devnet).

- [ ] Final logo: gold engraved seal-coin chosen as PRIMARY after small-size
      UX review (2026-07-12, `assets/phoca-logo.svg`; blue variant kept as
      `assets/phoca-logo-blue.svg` secondary). Metadata points to it — repo
      is public, URI resolves. Remaining: owner final sign-off + a 512×512
      PNG export for wallets that don't render SVG
- [x] Brand story page copy → docs/BRAND-STORY.md (2026-07-12): the Phocaea
      hook, wording pre-checked against COMPLIANCE-EU Phase C rules; final
      legal review before publication stays a Phase 4 gate
- [x] Name-collision re-check (2026-07-12): DEX Screener + CoinGecko APIs
      returned zero PHOCA results; LEGAL-NOTES.md refreshed. EUIPO/TMview
      manual query stays on the Phase 4 counsel agenda 🔎
- [ ] Decide charity focus list (seal rescue centers, research orgs) — NO
      public naming yet, that needs written agreements (TOKENOMICS trust rule 3)

**Exit criteria:** metadata renders correctly in a devnet wallet + explorer;
story copy exists and passes the compliance wording rules; naming file updated.

## Phase 2 — Automation & hardening

**Goal:** the machine does the routine work; the code gets sturdier.

- [ ] Scheduled fee sweep: the sweep now auto-appends every collection to
      docs/TRANSPARENCY-LOG.md (done 2026-07-17) — remaining: put
      `npm run collect-fees` on an actual timer (Task Scheduler/cron) and
      commit the log entries on a cadence
- [x] Sweep batching (2026-07-17): the sweep chunks the registry into ≤20
      accounts per transaction (`chunk()` in utils, tested) — the ~25/tx
      ceiling can no longer break a sweep at scale
- [x] Localnet integration tests (2026-07-18): the REAL scripts 01→05 run
      end to end on `solana-test-validator` in CI on every PR — script
      output AND on-chain state asserted (fee rule, freeze=null, 980/20,
      split 10/5/5, log entry). Isolated via PHOCA_KEYS_DIR; skips politely
      without a validator
- [ ] `@solana/kit` (web3.js v2) migration spike — the tracked §8 backlog
      item; the modern stack drops the vulnerable transitive deps 🔎
- [x] Fee split — design, math AND wiring (2026-07-18): docs/FEE-SPLIT.md.
      The sweep now splits the pot 50/25/25 and distributes to separate
      auto-generated devnet treasuries; fee-on-fee observed live exactly
      as designed (sent 5 → received 4.9); every step in the transparency
      log. Mainnet change: treasuries become multisigs (Phase 5)

**Exit criteria:** zero-touch weekly sweep on devnet with auto-updated log;
integration tests green in CI; kit-migration decision written down (go/no-go + when).

## Phase 3 — Community & web presence

**Goal:** real seal lovers, not bots; a portal that proves rather than promises.
(Planned in this phase, built when Phase 1–2 are done.)

Web portal, in three steps:
1. **Official-links page** (single static page, GitHub Pages): the canonical
   list of every official channel + "we will NEVER DM you first" — this
   page exists BEFORE any social channel does (SECURITY-CHECKLIST §5)
2. **Landing site**: story, tokenomics table, devnet status disclaimer,
   compliance-safe wording only
3. **Transparency dashboard**: reads on-chain data live — withheld fees,
   sweeps, treasury balances; the "don't trust, verify" page

Community:
- [ ] Discord/Telegram with §5 op-sec: least-privilege admins, read-only
      announcements, verified bots only, 2FA everywhere
- [ ] Content cadence: seal facts, rescue-center features, build-in-public
      dev updates — community first, token second (LEARNING-ROADMAP Phase 5)
- [ ] Domain: registrar lock, DNSSEC, SPF/DKIM/DMARC before first newsletter

**Exit criteria:** official-links page live; channels active with op-sec
checklist done; landing site live with compliance-checked copy.

## Phase 4 — Compliance & entity (runs in PARALLEL with Phase 3)

**Goal:** the legal spine. Maps 1:1 to docs/COMPLIANCE-EU.md — that file is
the agenda, this is the sequence. **Nothing public about BUYING PHOCA before
Phase A of that doc is resolved with counsel.**

- [ ] Engage crypto-savvy counsel (BaFin experience) — budget line accepted
- [ ] Offer structure decided: exemption route (small offer < ~€1M/12mo 🔎,
      <150 persons/state, free airdrop) vs full Title II white paper
- [ ] Legal entity formed (UG/GmbH); holds trademark, domain, treasury
- [ ] EUIPO trademark application for PHOCA (word + figurative)
- [ ] If white-paper route: mandated template, XHTML/inline-XBRL format,
      BaFin notification, publication + archiving (COMPLIANCE-EU Phase B)
- [ ] Charity agreements in writing BEFORE any partner naming; The Giving
      Block or direct crypto acceptance confirmed per org 🔎
- [ ] German crypto-experienced Steuerberater retained

**Exit criteria:** counsel sign-off on the chosen offer structure, entity
registered, trademark filed, charity agreements signed — all documented.

## Phase 5 — Mainnet launch gates 🚨

**Goal:** the deliberate, reviewed, boring launch. Every gate is a hard NO-GO
if unchecked. Maps to SECURITY-CHECKLIST §2 (authority matrix) and §4.

- [ ] Full devnet dry-run of launch day: create → mint → revoke → LP → lock →
      sweep → transparency post, end to end, timed
- [ ] Dependencies re-audited; `@solana/kit` migration done or explicitly
      re-accepted 🔎; lockfile frozen for launch
- [ ] Squads multisig live (2-of-3 minimum, hardware keys): transfer-fee
      authority + withdraw authority + metadata update authority move there
- [ ] Supply minted on mainnet → **mint authority REVOKED**, tx published
- [ ] Freeze authority: null at creation (verify in explorer, publicly)
- [ ] Metadata URI on permanent hosting (Arweave/Irys), logo final
- [ ] Liquidity: pool created (Raydium/Orca 🔎), LP locked or burned,
      proof link published
- [ ] Fee % identical in code, white paper, site, pinned posts
- [ ] Incident-response plan written (§6): templates, spokesperson, contacts
- [ ] Interlock decision: scripts that must touch mainnet get a REVIEWED,
      explicit override procedure — documented, never casual (CLAUDE.md rule 2)

**Exit criteria:** every box above has a link (tx, lock proof, doc) — the
launch announcement IS the list of proofs.

## Phase 6 — Post-launch operations & integrations

**Goal:** keep every promise, visibly, on schedule.

- [ ] Monthly transparency report (docs/TRANSPARENCY.md): fees collected,
      donated (tx links + org confirmations), remaining — every month, no gaps
- [ ] Donation pipeline: sweep → split per TOKENOMICS → charity payout
      (The Giving Block / direct) → receipt published
- [ ] Listings & visibility: Jupiter token list 🔎, CoinGecko + CMC
      applications, explorer metadata verification (Solscan/Solana Explorer)
- [ ] Wallet display checks: Phantom/Solflare/Backpack show name, logo, and
      (where supported) the transfer-fee warning correctly
- [ ] White-paper update duty on material changes (COMPLIANCE-EU Phase E)
- [ ] Community programs: seal-community airdrops, artist contests — each
      checked against marketing rules before launch

**Exit criteria:** none — this phase is permanent. The measure of success:
every transparency report on time, every charity claim backed by a tx link.

---

## Tokenomics (DRAFT — working values, final only at Phase 5)

Single source of truth: docs/TOKENOMICS.md. Snapshot:

| Parameter | Value |
|---|---|
| Total supply | 1,000,000,000 PHOCA, fixed; mint authority revoked after mint |
| Decimals | 9 |
| Transfer fee | 2% (200 bps), enforced on-chain (Token-2022 TransferFee) |
| Fee cap | 5,000 PHOCA per transfer |
| Fee split (at sweep) | 1% charity · 0.5% community · 0.5% liquidity |
| Allocation | 60% LP (locked) · 15% community · 15% charity reserve (vested) · 10% team (vested 12–24mo) |

**Open decisions before mainnet** (tracked here, decided with counsel/community):
1. Sweep-time split mechanics (single pot → three treasuries): exact
   addresses, automation, rounding rules — designed in Phase 2
2. Vesting implementation for team + charity reserve (Squads? Streamflow? 🔎
   — audited tooling only, SECURITY-CHECKLIST §7)
3. LP lock provider and duration 🔎
4. Fee policy commitment: "fee may only go DOWN or stay" — formalize where
   (white paper + on-chain authority policy)

## Research checkpoints 🔎

Items marked 🔎 above must be re-verified with live sources (and counsel where
legal) AT THE TIME they're executed — figures and tools go stale:
MiCA small-offer threshold & exemption details · current DEX/LP-lock/vesting
tooling reputation · Jupiter/CoinGecko listing requirements · dependency
advisories & `@solana/kit` maturity · name collisions (relaunch the LEGAL-NOTES
search) · charity orgs' crypto-acceptance status.

## How this roadmap stays honest

Every phase transition = a CHANGELOG entry + a status update in this file's
Phase 0–6 checklists, in the same commit (CLAUDE.md rule 8). If reality and
roadmap disagree, the roadmap is wrong — fix it in writing.
