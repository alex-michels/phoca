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
