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
| Mint address | `BjEPXiw8jKMdRAxyhoVdcszHGCfWXaBSANqXhzzw6bux` |
| Treasury token account (ATA) | `7wiVJZcCeBVEF9FCNHoUmQin95Kvoe1QtHkYTvWB5nSj` |
| Token | PHOCA / PHOCA, 9 decimals, 2% fee (cap 5,000), metadata in-mint |
| Supply | 1,000,000,000 PHOCA minted to treasury |

Explorer (devnet): https://explorer.solana.com/address/BjEPXiw8jKMdRAxyhoVdcszHGCfWXaBSANqXhzzw6bux?cluster=devnet

## Runs

### 2026-07-06 — full initialization

1. **Wallet created** — `npm run wallet` →
   `vTzQs4bv1q2SMaktFGAh2v4wTNnepeoE31Shdp4Kt5G`. Public faucet rate-limited
   (429); funded manually with 2.5 SOL via https://faucet.solana.com.
2. **Token created** (transfer-fee + metadata extensions, one tx) —
   `npm run create-token` → mint `BjEPXiw8jKMdRAxyhoVdcszHGCfWXaBSANqXhzzw6bux`
   — [tx 34KYhYRw…](https://explorer.solana.com/tx/34KYhYRwUuYDwMeRJiNpECUZHTWRPBKxjqtBVW4w3vuk8dM92NRHBaHgWssZQbMxmVQK9ne13z1YpWPTCrPE6jza?cluster=devnet)
3. **Supply minted** — `npm run mint-supply` → 1,000,000,000 PHOCA to treasury ATA
   `7wiVJZcCeBVEF9FCNHoUmQin95Kvoe1QtHkYTvWB5nSj`
   — [tx y45iq7Wa…](https://explorer.solana.com/tx/y45iq7Wa7GkF7WD9sc8AQ2YdQ1nrbSnh6tmMWjBztsExitJBZyan2K6CcWcKEFUVqabHqbnZhBvktF9oh3Ap3ev?cluster=devnet)
4. **Transfer test #1** — 1,000 PHOCA → `4KHT6j3arkQDnVJajirrTj7S7yYpuo2yC3R9uMz6w5RJ`:
   recipient got 980, chain withheld 20 for charity
   — [tx 5J4D95PC…](https://explorer.solana.com/tx/5J4D95PC6AQnzoarG4zTAoYjhu16wMAsKEmHHBv4Qu882AAQPXMJJRHa5cyQp9puSXRfYnuZ9HJDJZS36wYcj4VV?cluster=devnet)
5. **Transfer test #2** — 1,000 PHOCA → `2TYSJ89h8UbaJoFyjjCHq85a5z4zsnN5Hp25qSDLW1Up`:
   980 received / 20 withheld
   — [tx 3hTnGSuH…](https://explorer.solana.com/tx/3hTnGSuHp6bEioAs5RkNYUeydvSn6oAiDaPQuM1XDc5eZ3PmYoFfQoJAHmwv8XvHgFiFbjMGhLWaERukA94xZ5jZ?cluster=devnet)
6. **Fee sweep** — hit a real-world wall first: the public devnet RPC has
   `getProgramAccounts` DISABLED for Token-2022, and even the "top holders"
   scan is heavily rate-limited (429). Proper fix: the transfer script now
   RECORDS every token account it touches in a local registry
   (`keys/token-accounts.json`, git-ignored, public addresses only), and the
   sweep reads the registry with cheap per-account lookups — RPC scans are
   only a fallback. Registry seeded for the two pre-fix recipients by
   deriving their ATAs offline. Then:
   **40 PHOCA collected into the treasury**
   — [tx 4p9W47U8…](https://explorer.solana.com/tx/4p9W47U8CY8fnwLcRHX9XrrTLKrpNCjVLCyAzyfAtzjSgSfADzXho6dGp2ChVNEuZZWUsoF8dFM52cvatdjqqyJH?cluster=devnet)

**Lessons of the day:** (1) public RPCs restrict expensive scan calls —
design for the RPC you'll actually have, keep your own account registry;
(2) the fee arithmetic worked exactly as the test suite predicted: 2% of
1,000 = 20 PHOCA per transfer, withheld by the chain itself, 40 swept.

### 2026-07-06 — verification run after the code-review fixes

Purpose: prove the hardened scripts (hostname interlock + genesis-hash
check + shared config + exact BigInt display + auto-recording registry)
work against the real chain, not just in unit tests.

1. **Transfer test** — 1,000 PHOCA → `2hT7jLFzanm8GE1nFta75hw5ucAFduXcvhS1MC83sTnH`:
   980 received / 20 withheld; recipient auto-recorded in the registry
   — [tx 3oKnq5UD…](https://explorer.solana.com/tx/3oKnq5UDBYhrSAAuyRCN2BquGwuPWvzUR5Q1MAsdmiAKUBWsJVSSoGs1g6QS8CVGQ2bCUKF1mYiKVApBDmkyTS1D?cluster=devnet)
2. **Fee sweep** — found exactly the 1 new account, collected **20 PHOCA**
   (lifetime total swept: 60 PHOCA)
   — [tx 63TRRyTF…](https://explorer.solana.com/tx/63TRRyTFnCEXMBGapkVkFrdteFv5k2A8h2k9sBVih79e3XUCQAjPHGcxCLovRKGpCKUw4YijYmivEDYHCakiHqMC?cluster=devnet)

Every script now verifies the cluster's genesis hash before signing anything —
the URL can sound like devnet, the chain's fingerprint can't.

### 2026-07-17 — sweep batching + auto transparency log verified

1. **Transfer test** — 1,000 PHOCA → `5Svw2BmtbxHAHRePkSVejQswSA2mrF2eJAJh3XSbAFV5`:
   980 received / 20 withheld
   — [tx 5s6jLXA7…](https://explorer.solana.com/tx/5s6jLXA7z1jaNEqsdL8V8LoDfVYhNX2ZpCYykr9SkHDE2AXfBrbLdeiVBLNigjseiS8UEgQ6ocYeSX5Vhx6KhzpU?cluster=devnet)
2. **Batched sweep** — 20 PHOCA collected in 1 batch, and the sweep wrote its
   own entry into docs/TRANSPARENCY-LOG.md (first auto-logged collection;
   lifetime total swept: 80 PHOCA)
   — [tx ino4xWEE…](https://explorer.solana.com/tx/ino4xWEECUZNshFTvSuGCKbyhJPzQ6KXDDuk95rUtec2Z1aAt67uGX2Cgknh3fdQURPrYBhsXhyDfhega5kMFqf?cluster=devnet)
