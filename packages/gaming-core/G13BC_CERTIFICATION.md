# G13BC Gaming Input Stack Certification

Status: FROZEN FOR G13 INPUT-STACK SCOPE

Certified parent commit: `8bc4f689a0bedcd4ea28e5b014359e166df8fd77`
Certification workflow: Gaming Core Certification
Workflow run: `35530043802` (run #53)
Certification job: `106128917457`
Result: SUCCESS

## Certified invariants

The G13 input path preserves these invariants:

1. Controller input is serialized in invocation order.
2. Invalid capability/input kinds are rejected before integrity mutation.
3. Queued input freshness is evaluated when the input dequeues.
4. Disconnect revocation is immediate and is not serialized behind the input queue.
5. The input pipeline owns transport teardown for its current single-session input path.
6. Disconnect during transport or runtime delivery never permits a terminal delivery state to transition again.
7. A sequence accepted by integrity is permanently marked consumed.
8. Disconnect before integrity acceptance remains replay-safe.
9. Disconnect after integrity acceptance is explicitly `cancelled-after-accept` and is not replayable.
10. Transport-started uncertainty is recorded as `delivery-unknown`, not false non-delivery.
11. Runtime acknowledgement mismatch is `delivery-unknown`, not a definitive failure and never an auto-replay signal.
12. Transport latency over budget remains confirmed delivery with an over-budget receipt.
13. Transport disconnect immediately stops new admissions; queue depth cannot underflow.
14. An in-flight connection cannot complete after revocation and resurrect transport state.
15. Reconnect sequence floors never move backward across consumed inputs.
16. Exact-once, disconnect generation, transport receipt, delivery uncertainty, reconnect sequence, and input-to-photon fields are available to session telemetry.

## G13AV-G13BB closure

- G13AV: input pipeline transport-disconnect ownership.
- G13AW: async send/runtime disconnect-race stabilization.
- G13AX: explicit sequence and transport disposition.
- G13AY: acknowledgement mismatch uncertainty semantics.
- G13AZ: adversarial transport, pipeline, delivery-state, and reconnect tests; connection-epoch hardening.
- G13BA: exact-once and reconnect telemetry.
- G13BB: real CI certification, strict-TypeScript repair, lockfile synchronization, public export reconciliation, stale fixture repair, and Moonlight URI parsing repair.
- G13BC: certification freeze and evidence receipt.

## Material G13AV-G13BB commits

- `d59512ca24fd33abc8bd080bbe009def10461b1b` pipeline owns transport disconnect.
- `bf964b5ef15ea9737df52f02f6ac5dfe287fa3a0` terminal-safe delivery transitions.
- `2a04c93adf7b8216a85406431908b2d374164ff2` async disconnect-boundary stabilization.
- `0671fe421068e2b3958f6d86d90da0d8d9ee688c` consumed sequence and transport disposition.
- `0fdb106773c3eedec78247300ccf7771ea458ddb` acknowledgement uncertainty.
- `61f56a2f505f615c9ef772d137236765cf71a046` input pipeline adversarial race coverage.
- `7b87050484dc5f352c88c0b682883a9fa7307b93` sequence-disposition coverage.
- `6d486b02580bed0f1b3f74770c706f7ed8642ed0` transport connection-epoch revocation.
- `b9a62adc58e929d9354615733e8716ba93c0fb5b` transport disconnect invariant tests.
- `a56b7b29e00b4732df678c1419a901507a0a2f38` reconnect sequence-continuity tests.
- `bf649b34b707237658e93ad8da40c2723a8f4898` exact-once/reconnect telemetry.
- `4f909b492ca30ec317db01b19067632e728b9dcc` integrity result aligned with consumed-input semantics.
- `d6164aac5717ba189aac6622637b304f9093b353` Gaming Core lockfile importer synchronized.
- `d3059c401ab3e0996797465d56cd23832f8cdba9` public barrel collisions repaired.
- `b6022acf61be9c84f7e1fc693104dc92166fa341` Moonlight runtime URI parser repaired.
- `d26df99b7447212413ae795d680f28d009ca736a` remote-play URI parser repaired.
- `8bc4f689a0bedcd4ea28e5b014359e166df8fd77` final stale remote-launch test expectation repaired before green certification.

## Certification evidence

The dedicated Gaming Core workflow completed all of the following successfully:

- frozen pnpm workspace install;
- `pnpm --filter @jhadina/gaming-core run certify`;
- strict TypeScript check;
- full Gaming Core Vitest suite;
- Turbo `build`, `test`, and `type-check` for `@jhadina/gaming-core`.

Observed results:

- Test files: **38 passed / 38**
- Tests: **96 passed / 96**
- Turbo tasks: **3 successful / 3**

The dedicated Gaming certification result is authoritative for this G13 scope. Repository-wide or third-party checks such as Vercel are separate from this package certification and must not be represented as Gaming Core failures unless their logs identify Gaming Core as the cause.

## Freeze rule

No G13 input-path behavior may be changed after this freeze without:
- adding or updating exact-once/race regression coverage;
- re-running Gaming Core Certification;
- preserving consumed-sequence and delivery-uncertainty semantics.

G13BC closes the G13 input-stack implementation and certification phase.
