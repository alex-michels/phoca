# 🦭 PHOCA ($PHOCA) Tokenomics (DRAFT — everything here is a starting point to discuss)

## Purpose
A fun community token for seal lovers that channels real, verifiable support to
seal rescue centers, marine mammal research and ocean protection.

## Draft parameters
| Parameter | Draft value | Notes |
|---|---|---|
| Total supply | 1,000,000,000 | Fixed. Mint authority revoked after minting. |
| Decimals | 9 | Solana standard |
| Transfer fee | 2% (200 bps) | Enforced on-chain via Token-2022 Transfer Fee extension |
| Fee cap | 5,000 tokens/transfer | Protects whales from absurd absolute fees |

## Where the 2% goes (draft split)
- 1.0% → Charity treasury (seal rescue orgs — named publicly, receipts published)
- 0.5% → Community/marketing treasury
- 0.5% → Liquidity support

Mechanics, rounding policy and the fee-on-fee effect: **docs/FEE-SPLIT.md**
(the split happens at sweep time — the chain collects the 2% as one pot).
Split constants live in `scripts/config.ts` (`FEE_SPLIT_BPS`), tested.

## Draft allocation
- 60% Liquidity pool (locked — publish the lock link)
- 15% Community: airdrops to seal communities, contests, artists
- 15% Charity reserve (vested, published wallet)
- 10% Team (vested 12–24 months — never a big unlocked team bag)

## Trust rules (what makes people believe you)
1. Charity wallet address is public from day one.
2. Every donation gets an on-chain tx link + (where possible) confirmation from the org.
3. Ask charities FIRST if they accept crypto (or use a converter like The Giving Block).
   Never name an organization as a "partner" without written permission.
4. Mint authority revoked, freeze authority null, fee authority in a multisig.
5. Monthly transparency post: fees collected, donated, remaining.
