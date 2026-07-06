# 📓 Devnet run log

Every meaningful devnet action gets a row here: what ran, which addresses,
which transactions. Two reasons: (1) you can always retrace what exists
on-chain and why; (2) this is practice for the real transparency report
(docs/TRANSPARENCY.md) — same habit, play money.

Addresses here are DEVNET ONLY. They hold no real value, but we still never
paste private keys anywhere — only public addresses and tx signatures.

## Current state

| What | Value |
|---|---|
| Wallet / treasury (devnet) | `vTzQs4bv1q2SMaktFGAh2v4wTNnepeoE31Shdp4Kt5G` |
| Mint address | — not created yet |
| Token | PHOCA / PHOCA, 9 decimals, 2% fee (cap 5,000), metadata in-mint |

## Runs

### 2026-07-06 — wallet created
- `npm run wallet` → new devnet wallet `vTzQs4bv1q2SMaktFGAh2v4wTNnepeoE31Shdp4Kt5G`
- Airdrop: **pending** — public faucet rate-limited (429). Next: fund via
  https://faucet.solana.com, then run `create-token` → `mint-supply` →
  `transfer-test` ×2 → `collect-fees` and log every tx below.
