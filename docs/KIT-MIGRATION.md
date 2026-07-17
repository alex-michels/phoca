# 🧭 @solana/kit migration — spike result & decision

**Decision (2026-07-18): GO — migrate, as the next code-heavy milestone
after Phase 2, and in any case before the Phase 5 mainnet dry-run (which
already gates on it).** Recorded per ROADMAP Phase 2; researched against
live sources, links at the bottom.

## Why this exists

SECURITY-CHECKLIST §8: our only `npm audit` findings live in the transitive
tree of `@solana/web3.js` 1.x (`bigint-buffer` high, `uuid` moderate via
`jayson`). They're triaged as acceptable for devnet — but the real fix is
the modern stack, where that tree simply does not exist.

## What the modern stack is (verified)

- **`@solana/kit`** — the SDK formerly known as web3.js 2.0 (renamed;
  maintained by Anza). Zero-dependency by design, tree-shakable,
  functional API. The vulnerable transitive tree is gone by construction.
- **`@solana-program/token-2022`** — the Kit-native client for the
  Token-2022 program (replaces `@solana/spl-token` for our use). Covers
  the transfer-fee instruction set we use: initialize fee config,
  `transferCheckedWithFee`, `withdrawWithheldTokensFromAccounts`, and the
  metadata instructions.
- **`@solana/web3-compat`** — official bridge to run old-API code on the
  Kit runtime for incremental migrations.

All three are official (Anza / solana-program org) — hard rule 5 satisfied.

## Migration shape for THIS repo

Small blast radius: five numbered scripts + utils. Per-file impact:

| File | Change |
|---|---|
| `scripts/config.ts` | none (pure constants) |
| `scripts/utils.ts` | Connection/Keypair APIs → Kit equivalents (`createSolanaRpc`, keypair signers); interlock & registry logic unchanged |
| `01–05` | rewrite imports + call style; program calls move to `@solana-program/token-2022` |
| unit tests | fee-math/split/registry/format logic unchanged; interlock tests adapt to the new rpc object |
| integration test | **unchanged in spirit — this is our safety net**: the localnet CI gate must pass identically before AND after, proving the rewrite preserved behavior |

**Approach: clean per-script rewrite, not the compat bridge.** The compat
layer earns its keep in large apps; for five small teaching scripts, a
clean rewrite is less total work, and the repo doubles as a textbook — it
should teach the CURRENT API, not a shim. One PR per script (rule 9),
integration test green at every step.

Estimated effort: 2–3 focused sessions. Exact package versions to be
pinned at migration start (rule 5: exact pins + audit after).

## Why not now

Phase 1–2 momentum went to identity, transparency automation and the CI
gate — all shippable value. The migration changes no behavior, so its
right moment is a quiet window: after Phase 2 closes, before Phase 3
portal work begins. The Phase 5 gate ("kit migration done or explicitly
re-accepted") stays as the hard backstop.

## Risks & mitigations

- **API churn / fewer examples** for token-2022-on-Kit → mitigation: the
  generated `@solana-program/token-2022` docs + our integration test as
  executable spec.
- **Behavior drift during rewrite** → mitigation: the localnet CI gate
  (real scripts, on-chain assertions) must stay green per PR; fee math is
  already pinned by unit tests independent of the SDK.
- **Half-migrated limbo** → mitigation: per-script PRs land within one
  milestone; no mixing of stacks inside a single script.

Sources: [anza-xyz/kit](https://github.com/anza-xyz/kit) ·
[solanakit.com docs](https://www.solanakit.com/docs) ·
[web3-compat](https://solana.com/docs/frontend/web3-compat) ·
[Token-2022 extension guide](https://www.solana-program.com/docs/token-2022/extensions) ·
[Helius: building with the 2.0 SDK](https://www.helius.dev/blog/how-to-start-building-with-the-solana-web3-js-2-0-sdk)
