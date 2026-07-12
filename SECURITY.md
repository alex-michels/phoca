# Security policy

## What this project is (and is not)

PHOCA is a **devnet-only learning project** at this stage. There is no mainnet
deployment, no token sale, and no real funds at risk in this repository.
Anything claiming otherwise — a "PHOCA presale", a "PHOCA mainnet token", a DM
from "the team" — is a scam. We will never DM you first.

Security-relevant design decisions (see docs/SECURITY-CHECKLIST.md for the
full posture):

- **No custom on-chain code.** PHOCA uses the standard, audited Token-2022
  program with standard extensions. There is deliberately no smart contract
  of our own to exploit.
- Scripts refuse non-devnet RPCs twice: by hostname allowlist AND by
  verifying the cluster's genesis hash before signing anything.
- No private keys, wallets, or `.env` files exist in this repository or its
  history. `keys/` is git-ignored and holds devnet-only throwaway keys.
- Dependencies are exact-pinned official Solana Labs / Anza packages with a
  committed lockfile; known transitive advisories are triaged in
  docs/SECURITY-CHECKLIST.md §8.

## Reporting a vulnerability

If you find a security issue — in the scripts, the CI setup, or something we
leaked by accident — please report it **privately** via GitHub's private
vulnerability reporting: **Security → Report a vulnerability** on this
repository. Please do not open a public issue for security reports.

What to expect: this is a small learning project, not a company — but reports
are taken seriously. You'll get an acknowledgment within a few days, an
honest assessment, and credit in the changelog if you want it. There is no
bug bounty at this stage; that changes before anything touches mainnet.

## Scope notes for researchers

- Devnet addresses and transaction links published in docs/ are intentional
  (transparency practice) — they hold no value.
- The `I_UNDERSTAND_THIS_IS_NOT_DEVNET` override is a documented, deliberate
  escape hatch, not a vulnerability.
- Findings about the EU-compliance docs being incomplete are appreciated but
  are not security issues — that workstream is tracked in docs/ROADMAP.md.
