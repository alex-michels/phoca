# 🔐 Security checklist (July 2026 edition — read before every step forward)

## 1. Keys & wallets
- [ ] Private keys NEVER in git, chat, screenshots, or cloud notes. `keys/` stays git-ignored.
- [ ] Separate wallets: dev/devnet ≠ personal funds ≠ project treasury ≠ charity treasury.
- [ ] Mainnet authorities & treasuries → hardware wallet keys inside a Squads
      multisig (2-of-3 minimum; 3-of-5 once there's a team). No single laptop
      may ever be able to move charity money.
- [ ] Scripts contain a hard interlock: they refuse non-devnet RPCs unless
      I_UNDERSTAND_THIS_IS_NOT_DEVNET=true is set. Never set it casually.
- [ ] Assume every DM offering "help", "listing", or "marketing" is a scam. It almost always is.

## 2. Authority matrix (what buyers check with rug-check tools)
| Authority | Devnet (now) | Mainnet (required before launch) | Policy |
|---|---|---|---|
| Mint | dev wallet | **REVOKED** after supply mint | Nobody can ever print more |
| Freeze | none (null at creation) | none | We can never freeze holders |
| Transfer-fee config | dev wallet | Multisig | Fee may only go DOWN or stay; any change announced ≥7 days ahead in writing |
| Withdraw withheld (charity) | dev wallet | Multisig | Sweeps on a published schedule; every sweep in the transparency report |
| Metadata update (name/symbol/URI) | dev wallet | Multisig | URI on permanent hosting (Arweave/Irys) before launch; any change announced — a silent identity swap is a rug signal |

## 3. Code & supply chain
- [ ] `package-lock.json` is COMMITTED and shipped — reproducible installs, no
      silent dependency swaps. (`npm ci` in any pipeline, never bare `npm install`.)
- [ ] `npm audit` before adding/updating any dependency; read what you add —
      typosquatting (`@solana/web3js` vs `@solana/web3.js`) is a real attack.
- [ ] Only official Solana Labs / Anza / Metaplex packages for chain code.
- [ ] `npx tsc --noEmit` clean before running anything that signs transactions.
- [ ] 2FA (authenticator app, not SMS) on GitHub, npm, Discord, X, email, domain registrar.

## 4. Token & liquidity (mainnet launch gates)
- [ ] Supply minted → mint authority revoked, revocation tx linked publicly.
- [ ] Liquidity locked or burned, proof link published.
- [ ] Fee % matches every public document (white paper, site, pinned posts).
- [ ] Dry-run the full launch on devnet end-to-end, including fee sweep and a
      simulated transparency report, before touching mainnet.

## 5. Community & operational security
- [ ] Official-links page; pinned everywhere; "we will NEVER DM you first" stated everywhere.
- [ ] Discord/Telegram admin hygiene: least privilege, no admin bots you didn't verify.
- [ ] Domain: registrar lock + DNSSEC; email: SPF/DKIM/DMARC (phishing in your
      name is a matter of when, not if).
- [ ] Announcement channels are read-only; one designated signer style for official posts.

## 6. Incident response (write it BEFORE you need it)
- [ ] By design we cannot freeze tokens or reverse transfers — our response is
      communication speed: a pre-written incident template, a designated
      spokesperson, and a checklist (pause fee changes, pause treasury ops,
      publish what is known/unknown/next update time).
- [ ] Key compromise drill: which authority, which multisig rotation, who calls whom.
- [ ] Keep an off-platform contact list of team + charity partners.

## 7. Audit posture
- Standard Token-2022 with standard extensions = no custom on-chain code to
  audit (a deliberate design choice — keep it that way). If custom programs
  ever appear (staking, vesting), they get a professional audit before mainnet. 

## 8. Known dependency advisories & triage (checked July 2026)
`npm audit` reports transitive advisories inside the official Solana JS stack:
`bigint-buffer` (high, buffer overflow in toBigIntLE) and `uuid` (moderate) via
`@solana/web3.js 1.x` → `jayson`. Triage:
- npm's suggested "fix" downgrades to ancient broken versions — NEVER run
  `npm audit fix --force` blindly; that is how projects break.
- Practical exposure here: scripts run locally against devnet with throwaway
  keys and parse data from RPCs we choose. Risk accepted for the learning phase.
- Before ANY mainnet operational use: re-check advisories, and plan migration
  to the modern `@solana/kit` (web3.js v2) stack where this dependency tree
  is gone. Track this as a real backlog item, not a someday-wish.
Lesson: an audit finding is the START of a decision, not a command.

## 9. Public repository posture (repo went public 2026-07-12)
- [ ] **Secret scanning ON + push protection ON** (Settings → Advanced
      Security): free for public repos; push protection blocks a leaked
      token BEFORE it lands in history. This is the single most important
      switch for a public money-adjacent repo.
- [ ] **Dependabot alerts ON** (Settings → Advanced Security): we pin exact
      versions on purpose, so auto-update PRs stay OFF — but we want to be
      TOLD when a pinned version gets a CVE. Alerts, not auto-fixes.
- [ ] **Private vulnerability reporting ON** (Settings → Advanced Security)
      — SECURITY.md points researchers there.
- [ ] Branch protection on `main`: PRs required (done 2026-07-12), and add
      the CI check `checks` to required status checks so red CI physically
      cannot merge, even with the admin bypass.
- [ ] CI workflow runs with `permissions: contents: read` (explicit least
      privilege, done 2026-07-12); repo default workflow token is read-only
      with PR-approval disabled — keep it that way.
- [ ] History verified clean at go-public: `keys/`, `.env` and secret-like
      byte arrays never appeared in any commit (checked 2026-07-12). Re-run
      the same scan before any future visibility change of any repo.
- [ ] LICENSE decision pending — a public repo without a license is
      "all rights reserved", which contradicts build-in-public trust. Owner
      to choose (MIT recommended for the scripts; brand/logo can be excluded
      explicitly).
- [ ] Public repo = public recon: issues/PRs/discussions will attract
      scammers offering "listings" and "marketing" (§1 rule applies), and
      the devnet addresses in docs/ are intentionally public (worthless).
