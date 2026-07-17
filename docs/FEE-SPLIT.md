# 💰 Fee-split design: one on-chain pot → three treasuries

**Status: design + tested math (this doc). On-chain distribution wiring is
the next step and needs a treasury-address decision — see "What's next".**

## The problem

docs/TOKENOMICS.md promises the 2% transfer fee divides as
**1% charity / 0.5% community / 0.5% liquidity**. But Token-2022's
TransferFee extension knows nothing about splits: it withholds the whole 2%
into ONE pot, collectable by ONE withdraw authority to ONE destination per
sweep. The split must therefore happen **at sweep time, off the fee
mechanism but on-chain** — as ordinary transfers out of the collection
treasury. This file is the design for exactly that.

## The split, precisely

Fractions of the POT (which is 2% of transfers), in basis points — the
single source of truth lives in `scripts/config.ts` as `FEE_SPLIT_BPS`:

| Treasury | Share of pot | = share of each transfer |
|---|---|---|
| Charity | 5,000 bps (50%) | 1.0% |
| Community | 2,500 bps (25%) | 0.5% |
| Liquidity | 2,500 bps (25%) | 0.5% |

**Rounding policy:** integer division can't always split exactly (101 units
× 25% = 25.25). Community and liquidity round DOWN; **charity takes the
remainder** — every rounding crumb goes to the seals. Implemented as
`splitFee()` in `scripts/utils.ts`.

**Invariants (all enforced by tests in tests/fee-math.test.ts):**
1. `charity + community + liquidity === pot`, exactly, always — "almost
   adds up" is how treasuries leak.
2. Charity never receives less than its exact 50% share.
3. `FEE_SPLIT_BPS` sums to exactly 10,000 — a config edit that breaks this
   fails the suite.
4. Tiny pots never vanish (1 base unit → charity), negatives are rejected.

## The fee-on-fee effect (important, counterintuitive)

The distribution transfers out of the collection treasury are **normal
PHOCA transfers — so the chain withholds 2% on them too.** There is no
fee-exemption mechanism in the TransferFee extension, for anyone, including
us. Worked example for a swept pot of 1,000 PHOCA:

- Charity keeps its 500 in the collection treasury (no transfer → no fee)
  — this is why the collection treasury IS the charity treasury.
- Community: sent 250, receives **245** (5 withheld).
- Liquidity: sent 250, receives **245** (5 withheld).
- The 10 withheld PHOCA are not lost: they sit in the withheld pot and come
  back in the NEXT sweep, where they get split again (50/25/25).

So the effective steady-state split converges to a hair above 50% charity
and a hair below 25/25 — the drift favors charity, is fully visible
on-chain, and every step of it appears in the transparency log. We
document it instead of hiding it: honest arithmetic is the brand.

## Treasury model

| Stage | Collection/charity | Community | Liquidity |
|---|---|---|---|
| Devnet (next PR) | current dev wallet's ATA (unchanged) | separate devnet wallet | separate devnet wallet |
| Mainnet (Phase 5) | multisig | multisig | multisig |

Separate wallets on devnet practice checklist §1 ("separate wallets")
before it matters. All three mainnet treasuries are Squads multisigs with
published addresses (§2), and the whole flow — sweep → split → three
balances — must be readable by anyone from the transparency log plus an
explorer.

## What's next (the wiring PR)

1. Owner decision: auto-generate two extra devnet wallets into `keys/`
   (recommended — zero setup), or use owner-provided addresses.
2. `05-collect-fees.ts` gains a distribution step after the sweep:
   `splitFee(total)` → `transferCheckedWithFee` of the community and
   liquidity shares; all three resulting amounts + tx links go into the
   transparency log entry (formatter extends).
3. The registry records the two new treasury ATAs (registry completeness
   rule), so their own future withheld crumbs are swept too.
