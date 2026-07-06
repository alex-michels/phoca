# 🗺️ Learning Roadmap: from seal fan to senior blockchain developer

Nobody becomes "senior" in a month — but you can ship a real, safe token while learning.
Work through the phases in order. Use Claude Code as your patient senior colleague:
ask it to explain every line it writes ("explain like I'm new to this").

## Phase 0 — Foundations (1–2 weeks)
- What a blockchain actually is: a shared database nobody can secretly edit
- Wallets, public/private keys, transactions, gas/fees
- Solana specifics: accounts model, SOL, lamports, rent, devnet vs mainnet
- Practice: run `npm run wallet`, look up your address on https://explorer.solana.com (devnet)
- Read: https://solana.com/docs/intro/quick-start

## Phase 1 — Tokens without writing a program (2–4 weeks) ← YOU ARE HERE
- SPL tokens vs Token-2022 ("Token Extensions")
- Mints, token accounts (ATAs), decimals, supply
- Transfer Fee extension = your on-chain charity fee
- Practice: run scripts 01–03, then transfer tokens between two devnet wallets
  and watch the fee get withheld (`npm run transfer-test` — done!)
- Add on-chain metadata (name PHOCA, symbol PHOCA, seal logo) via the Metadata extension — 
  another great Claude Code task

## Phase 2 — Reading & tooling (3–6 weeks)
- TypeScript fluency, @solana/web3.js in depth
- RPCs, explorers, Solscan; how DEXes (Raydium/Orca) and liquidity pools work
- Withdraw withheld fees to a charity wallet on a schedule (`npm run collect-fees` — done; next: automate it)
- Git + GitHub properly: branches, PRs, meaningful commits

## Phase 3 — Writing on-chain programs (2–4 months)
- Learn Rust basics, then the Anchor framework
- Build tiny programs: counter, vault, simple staking
- Understand PDAs (program-derived addresses) — the #1 Solana concept interviews test
- Read other people's audited code (Anchor examples, SPL source)

## Phase 4 — Security mindset (ongoing, forever)
- Common Solana exploits: missing signer checks, missing owner checks, 
  arithmetic overflow, account confusion
- Study real post-mortems (e.g. Wormhole, Cashio)
- Follow: Solana security workshops, Neodyme blog, sealevel-attacks repo
- Rule: every line that moves value gets a second pair of eyes

## Phase 5 — Launch readiness (only when 1–4 feel comfortable)
- Tokenomics finalized and published (docs/TOKENOMICS.md)
- Authorities revoked or moved to multisig (Squads)
- Liquidity plan + locking, transparent charity wallet, published charity partners
- Legal review done (docs/LEGAL-NOTES.md) — especially MiCA if you're in the EU
- Community first, token second: Discord/Telegram of real seal lovers beats hype bots

## Daily habit
30–60 min/day beats 8 hours on Sunday. Keep a `journal.md` — write down one thing
you learned each day. Ask Claude Code to quiz you on yesterday's topic.
