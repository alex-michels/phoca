# 💰 Fee-split design: one on-chain pot → three treasuries

**Status: IMPLEMENTED (2026-07-18) — `npm run collect-fees` sweeps, splits
and distributes in one run, and logs every step to the transparency log.
Verified live on devnet.**

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
| Devnet (live) | dev wallet's ATA (unchanged) | auto-generated wallet (`keys/treasury-community.json`) | auto-generated wallet (`keys/treasury-liquidity.json`) |
| Mainnet (Phase 5) | multisig | multisig | multisig |

Treasury wallets are created on first sweep by `loadOrCreateTreasury()`
(tested) and live in `keys/` — git-ignored like every key. Their ATAs are
recorded in the sweep registry, so their own future withheld crumbs get
swept too.

Separate wallets on devnet practice checklist §1 ("separate wallets")
before it matters. All three mainnet treasuries are Squads multisigs with
published addresses (§2), and the whole flow — sweep → split → three
balances — must be readable by anyone from the transparency log plus an
explorer.

## First live run (2026-07-18, devnet)

Pot of 20 PHOCA → charity kept 10 (no transfer, no fee); community and
liquidity were each sent 5 and received **4.9** — the fee-on-fee effect
from the worked example, observed on-chain exactly as predicted. The 0.2
withheld on those transfers returns at the next sweep. Tx links in
docs/TRANSPARENCY-LOG.md (the sweep wrote its own entry).

## What's next

- Mainnet (Phase 5): the three treasuries become Squads multisigs with
  published addresses; this mechanism is otherwise unchanged.
- The scheduled-sweep cadence (ROADMAP Phase 2) makes this fully
  zero-touch: timer → sweep → split → log.
