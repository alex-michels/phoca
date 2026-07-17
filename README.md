# 🦭 PHOCA ($PHOCA) — the seal coin, 2600 years in the making

A community & charity token on Solana for seal lovers worldwide. Part of every
transfer fee is set aside — enforced by the blockchain itself — to support seal
rescue centers, marine mammal research and ocean protection.

**Status: learning / devnet only. Nothing here is deployed to mainnet. Not financial advice.**

## Why PHOCA

*Phṓkē* (φώκη) is the ancient Greek word for seal, and *Phoca* is the Latin genus
name of true seals (Phoca vitulina — the harbor seal of Europe's North Sea and
Baltic coasts). But the name carries something bigger:

The ancient Greek city of **Phocaea** — literally "seal city" — was among the
first places in the world to mint coins, around 600 BC. Its civic badge, stamped
on electrum (gold-silver) coins, was a **seal**. One of those coins, dated
600–550 BC, sits in the British Museum today. Phocaeans were legendary sailors:
they founded Marseille in 600 BC and, according to Herodotus, were the first
Greeks to reach the Atlantic coast of Spain.

**The first seal coin was minted 2600 years ago. We're minting the next one —
this time, for the seals themselves.** One of Phocaea's coins even depicts the
Mediterranean monk seal, today one of the most endangered marine mammals on
Earth — exactly the kind of animal this project exists to help.

> Name check (July 2026): no active crypto project named PHOCA found on
> CoinGecko/CMC/news; unrelated namesakes: phoca.cz (Joomla CMS extensions) and
> the biological genus itself. Re-verify on DEX Screener / CoinGecko / Birdeye
> on launch day and see docs/LEGAL-NOTES.md.

## How this repo is organized

| Path | What it is |
|---|---|
| `CLAUDE.md` | Instructions for Claude Code (your AI pair programmer reads this automatically) |
| `docs/ROADMAP.md` | **The master project roadmap**: phased plan with exit criteria, devnet → mainnet |
| `CHANGELOG.md` | Every change, documented in the same commit that makes it |
| `docs/LEARNING-ROADMAP.md` | Your step-by-step path from beginner to senior blockchain dev |
| `docs/TOKENOMICS.md` | Draft token design: supply, charity fee, wallets |
| `docs/FEE-SPLIT.md` | How the 2% pot divides into three treasuries: math, rounding, fee-on-fee |
| `docs/SECURITY-CHECKLIST.md` | The list that keeps you from getting rekt |
| `docs/LEGAL-NOTES.md` | Naming status + EU/MiCA notes (talk to a real lawyer!) |
| `docs/COMPLIANCE-EU.md` | MiCA workstream: entity, white paper, marketing rules — the EU launch agenda |
| `docs/TRANSPARENCY.md` | Monthly charity transparency report template |
| `docs/TRANSPARENCY-LOG.md` | **Auto-appended** by every fee sweep: date, amount, tx links |
| `docs/DEVNET-LOG.md` | Log of devnet runs: addresses + tx links (transparency-report practice) |
| `scripts/` | Small TypeScript scripts, numbered in the order you run them |
| `tests/` | Test suite: the non-devnet interlock and the charity-fee math |
| `keys/` | Local wallets for **devnet only** — git-ignored, never commit keys |

## Quickstart (devnet — free play money)

```bash
# 1. Install dependencies (needs Node.js 22+ — the test runner uses modern flags)
npm install

# 2. Create a devnet wallet and get free test SOL
npm run wallet

# 3. Create the $PHOCA token (Token-2022: built-in charity transfer fee AND
#    on-chain metadata — the mint itself carries name, symbol and logo link)
npm run create-token

# 4. Mint the total supply to your treasury wallet
npm run mint-supply

# 5. Watch the charity fee work: send tokens and see the fee withheld on-chain
npm run transfer-test

# 6. Sweep the withheld fees, split the pot (50% charity / 25% community /
#    25% liquidity — see docs/FEE-SPLIT.md) and log it all automatically
npm run collect-fees
```

Everything runs against **devnet** (Solana's free test network) by default.
Mainnet is a deliberate, later decision — see `docs/ROADMAP.md`.

## Tests

```bash
npm test                  # unit: interlock + fee math + helpers (no network)
npm run test:integration  # the REAL scripts 01→05 on a local validator
npm run typecheck         # TypeScript must be clean
```

The most important unit tests guard the **non-devnet interlock** — the code
that refuses to run these scripts against real money. The integration test
runs the actual numbered scripts end to end against a throwaway local chain
(`solana-test-validator`) in an isolated temp directory — it skips politely
if no validator is running, and CI runs it on every PR. If tests fail, stop
and find out why before running anything else.

## Security & compliance posture

Scripts hard-refuse any non-devnet RPC (see `scripts/utils.ts`). Dependencies are
exact-pinned with a committed lockfile; known advisories are triaged in
`docs/SECURITY-CHECKLIST.md` §8. The EU/MiCA launch agenda lives in
`docs/COMPLIANCE-EU.md` — devnet learning needs none of it, a public EU offer
needs all of it plus a lawyer.

## License

Code and documentation are released under the [MIT License](LICENSE) — learn
from it, fork it, build on it. **Exception:** the PHOCA name, logo and brand
assets (`assets/phoca-logo*.svg`, `assets/phoca-metadata.json` imagery) are
NOT MIT-licensed — all rights reserved, to prevent scam tokens wearing our
seal. Brand rights move to the project's legal entity in ROADMAP Phase 4.

## The core idea in one paragraph

We use Solana's **Token-2022** standard with the **Transfer Fee extension**. That means the
"X% of every trade goes to charity" rule is enforced *by the blockchain itself*, not by a
promise. The fee accumulates on-chain and can only be withdrawn by the designated
charity/treasury authority — which you can later put behind a multisig for transparency.
An honest coin with a seal on it — the Phocaeans would approve.
