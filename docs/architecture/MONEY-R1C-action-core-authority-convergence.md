# MONEY-R1C — Action Core Authority Convergence

## Objective

Remove the remaining parallel Money-side authority model and make financial
execution follow one canonical chain:

```text
ActionRequest
    |
    v
Action Core Policy
    |
    v
Action Core Approval / Authority
    |
    v
Money ExecutionPermit
    |
    v
ExecutionAttempt
    |
    v
Provider Mutation
    |
    v
Reconciliation / Recovery
```

MONEY-R1C does not make Action Core understand financial economics. Money still
owns economic fingerprints, provider/account binding, permit consumption,
execution attempts, idempotency, and reconciliation. The change is specifically
about **who owns authority**.

## Removed parallel authority model

The previous `financial-action-governance.ts` defined its own:

- `ActionProposal`;
- `PolicyDecisionRecord`;
- `AuditReceipt`;
- `FinancialActionBinding`;
- `assertPolicyAllowsExecution()`.

That duplicated concepts already owned by Action Core.

Those types were isolated and had no external consumers on current main, so
R1C replaces them with one preparation function:

`createFinancialActionRequestFromAllocation()`

Its only job is to turn an already-approved Money opportunity/risk/allocation
decision into an Action Core `ActionRequest`.

It does **not** create policy authority, approval authority, or an execution
permit.

## Action Core authority proof

`MoneyActionCoreAuthority` is a downstream proof of an Action Core outcome,
not a second policy engine.

It records:

- authority ID;
- exact ActionRequest ID;
- canonical ActionRequest fingerprint;
- user;
- capability;
- Action Core decision: `allow` or `approval_required`;
- approval receipt ID when approval was required;
- policy version/hash;
- authorization time;
- expiry.

`createMoneyActionCoreAuthority()` cannot create an approval-required proof
without an Action Core receipt ID.

The authority proof cannot predate the request and must expire after it was
authorized.

## Exact ActionRequest fingerprint

The ActionRequest fingerprint now uses stable recursive key ordering.

This means equivalent action objects produce the same fingerprint even when
their JavaScript property insertion order differs.

Any material mutation to:

- request ID;
- user;
- capability;
- action economics;
- requested time;
- approval receipt ID

changes the fingerprint and invalidates the downstream permit chain.

## Permit convergence

Every newly issued `ExecutionPermit` now requires:

- `authorityId`;
- `actionRequestFingerprint`;
- economic action fingerprint;
- user/capability/provider;
- policy version/hash;
- approval receipt binding when present;
- optional opportunity/risk/allocation bindings.

`issueActionCoreBoundExecutionPermit()` is the high-level issuance path.

It verifies:

1. the authority belongs to the exact ActionRequest;
2. ActionRequest identity matches the economic `ExecutionAction`;
3. the authority is active;
4. the permit cannot outlive the authority.

The lower-level `issueExecutionPermit()` remains the deterministic storage
primitive, but it can no longer create an unbound permit because
`authorityId` and `actionRequestFingerprint` are mandatory.

## Final execution gate

`authorizeAndConsumeMoneyPermit()` now receives the exact ActionRequest.

Before consuming the permit it proves:

- caller request fingerprint matches the permit reference;
- stored permit authority ID matches;
- stored permit is bound to the same ActionRequest;
- approval receipt ID matches;
- economic action fingerprint matches;
- user/capability/provider match;
- policy version/hash match;
- opportunity/risk/allocation bindings match;
- permit is still ISSUED and unexpired.

Only then is the single-use permit consumed.

## Transaction handler

`MoneyTransactionWriteHandler` no longer depends on `ApprovalPort`.

That duplicate approval check was the central R1C authority split: Action Core
could approve a request, then Money's handler independently decided approval
again.

The handler now assumes the canonical Action Core ordering: it can only be
called by the Action Core handler stage after policy/approval succeeded, then it
performs Money-specific validation and permit enforcement.

The remaining handler checks are not authority duplication:

- Money capability classification;
- amount/currency validity;
- user/workspace ownership;
- account ownership;
- idempotency;
- exact permit binding;
- execution attempt creation;
- provider call;
- ambiguous-outcome recovery marking.

## Idempotent replay rule

A completed/replayed request does not create another financial side effect.

Therefore an idempotent replay may return the previously owned result without
consuming a second execution permit.

A newly claimed mutation must pass the permit gate before an execution attempt
or provider call.

## Durable migration

Migration:

`003_bind_permits_to_action_core_authority.sql`

adds:

- `action_request_fingerprint`;
- `authority_id`.

Legacy permits that are still `ISSUED` are revoked before the columns become
mandatory.

This is deliberate. A pre-R1C permit has no proof that it came from the new
Action Core authority chain, so it is safer to revoke it than silently
grandfather it.

## Attempt and reconciliation

R1C preserves the existing attempt/recovery architecture:

```text
consumed permit
  -> ExecutionAttempt STARTED
  -> provider idempotency/execution identity
  -> SUCCEEDED

or

  -> UNKNOWN + recoveryRequired
  -> reconciliation adapter
  -> atomic recovery resolution
```

The permit identifies authority; the attempt identifies what actually crossed
the provider boundary.

These remain different records by design.

## Research boundary

MONEY-STOCK-02 and MONEY-FOREX-02 remain unaffected:

```text
decisionCase.status = RESEARCH_ONLY
assessment.disposition = RESEARCH_ONLY
authorityStatus = MISSING
financialAuthority = NONE
```

Research intelligence cannot mint an Action Core authority proof or execution
permit merely because it contains a forecast, expected return, factor, regime,
or risk assessment.

## Acceptance criteria

MONEY-R1C is structurally complete when:

1. Money has no second proposal/policy/receipt authority stack;
2. allocation output becomes an ActionRequest, not a Money ActionProposal;
3. ActionRequest fingerprints are deterministic;
4. approval-required authority requires an Action Core receipt;
5. permits bind to exact ActionRequest + authority ID;
6. permits cannot outlive their authority;
7. request mutation invalidates permit binding;
8. transaction handler no longer owns a second approval port;
9. new side effects consume one bound permit before attempt/provider mutation;
10. idempotent replay does not require or consume a second permit;
11. provider ambiguity still produces UNKNOWN/recovery-required attempts;
12. durable permits persist Action Core authority bindings;
13. legacy ISSUED permits are revoked during migration;
14. integration coverage proves missing Action Core approval stops before
    permit, attempt, and provider execution.

## Next

**MONEY-R13B — Certification hardening**

R13B should turn the current partial `verify:r13` into the real production
certification gate:

`frozen install → type-check → tests → build → authority replay/adversarial tests → permit concurrency → recovery/reconciliation certification`.
