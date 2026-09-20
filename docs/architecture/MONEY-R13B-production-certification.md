# MONEY-R13B — Production Certification Hardening

## Objective

Make Money Core independently certifiable even when unrelated Jhadina packages
break the repository-wide Launch Gate.

R13B is not another execution architecture phase. It is the gate that proves
the existing Money architecture still satisfies its production invariants.

## Dedicated CI

R13B adds:

`.github/workflows/money-r13b-certification.yml`

The workflow is path-scoped to Money Core and its workspace manifests and runs:

```text
frozen pnpm install
  -> Money type-check
  -> targeted R13/R1C/R13B certification tests
  -> full Money test suite
  -> Money production-surface build/runtime import
```

This does not replace the repository Launch Gate. It gives Money a second,
domain-specific signal so an unrelated package failure cannot hide Money
compiler or test results.

## Package certification command

`pnpm --filter @jhadina/money-core verify:r13b`

runs:

1. TypeScript type-check;
2. focused certification tests;
3. the complete Money unit-test suite;
4. package build/runtime-surface validation.

The historical `verify:r13` command is retained as an alias to R13B so old
automation gains the stronger gate rather than silently running the old partial
check.

Money Core is a private, source-first TypeScript package, so its build
certification is intentionally:

- full static compilation with no emit;
- runtime import of the public `src/index.ts` surface through `tsx`.

That verifies the package's actual deployment/import shape without pretending
there is a published artifact pipeline that does not exist.

## Authority adversarial certification

The R13B suite verifies that:

- 32 concurrent callers racing one permit produce exactly one successful
  consumption;
- all losing callers fail as permit replay/invalid nonce;
- mutating the ActionRequest after authority issuance invalidates the chain;
- forging the authority ID cannot consume the permit;
- forging the policy hash cannot consume the permit;
- changing the economic action invalidates its action fingerprint;
- failed adversarial checks leave the permit ISSUED rather than partially
  consuming it.

These tests certify the R1C chain rather than only unit-testing individual
helpers.

## Recovery / reconciliation certification

R13B creates a realistic ambiguous execution attempt and verifies:

- the recovery service acquires a lease;
- provider evidence must match execution ID and proposal hash;
- evidence hashes are recomputed and verified;
- successful provider evidence is recorded;
- resolved outcomes go through `AtomicRecoveryResolver`;
- successful recovery requires lease renewal through final resolution;
- leases are released;
- forged evidence never reaches the atomic resolver;
- the reconciliation registry fails closed when no provider adapter exists or
  the registered adapter refuses the attempt.

The certification mock intentionally throws if recovery tries to mutate the
attempt through the old non-atomic path.

## Migration sequencing repair

Audit found two different migrations with the `003_` prefix:

- atomic recovery resolution;
- Action Core permit binding.

R13B renumbers the Action Core permit migration to:

`005_bind_permits_to_action_core_authority.sql`

The SQL itself remains idempotent and fail-closed. Legacy ISSUED permits lacking
the new authority fields are revoked before those fields become NOT NULL.

The certification suite now scans the Money migration directory and fails when
numeric migration prefixes are duplicated.

Current intended sequence:

```text
001_create_money_transaction_requests.sql
002_create_money_execution_permits.sql
003_atomic_money_execution_recovery_resolution.sql
004_execution_action_snapshot.sql
005_bind_permits_to_action_core_authority.sql
```

## Certification boundary

A green Money R13B workflow means the Money package passed its own frozen
workspace install, compiler, targeted safety/adversarial tests, complete unit
suite, and public runtime-surface build.

It does **not** claim:

- external bank/broker credentials are live;
- a real provider mutation was executed;
- production database migrations were applied;
- repository-wide Jhadina CI is green.

Those remain separate deployment/live-verification concerns.

## Acceptance criteria

R13B is complete when:

1. Money has a dedicated path-scoped CI workflow;
2. CI uses `pnpm install --frozen-lockfile`;
3. Money type-check runs independently of unrelated packages;
4. targeted R13/R1C/R13B certification tests run;
5. the full Money test suite runs;
6. the public Money runtime surface loads successfully;
7. permit concurrency proves one-and-only-one consumption;
8. authority/request/economic tampering fails closed;
9. recovery resolves only through the atomic resolver;
10. forged reconciliation evidence fails closed;
11. reconciliation adapter lookup fails closed;
12. Money migration numbers are unique;
13. legacy `verify:r13` invokes the hardened R13B gate.

## MONEY-FINAL follow-through

The precious-metals gap recorded at R13B is now closed by **MONEY-METALS-01/02**.

XAU/XAG/XPT/XPD now have first-class spot/futures, venue, unit, purity, currency,
point-in-time reality and a separate research-intelligence layer. Metals remain
research-only and gain no autonomous execution authority. See
`MONEY-METALS-01-02-precious-metals.md`.
