# MONEY-FUND.3 — External funding provider certification and admission binding

## Outcome

MONEY-FUND.3 defines the evidence boundary that must be crossed before the Money funding rail can leave `UNCOMMISSIONED`.

It does **not** fabricate or simulate production acceptance.

The promotion sequence is now:

```
UNCOMMISSIONED
  ↓ real provider/account/credential/KYC/capability evidence
CONTROLLED_CANARY_CERTIFIED
  ↓ operations persists certificate + bounded admission
CONTROLLED_CANARY
  ↓ real Add Funds + Cash Out canaries settle and reconcile
LIVE_CERTIFIED
  ↓ operations persists certificate + bounded admission
LIVE
```

Synthetic fixtures can validate software shape only.

## Evidence classes

Every commissioning receipt is explicitly:

- `REAL_LIVE`; or
- `SYNTHETIC_TEST`.

A synthetic receipt or canary can never produce operational certification.

## Controlled-canary certification

Before a funding provider can receive `CONTROLLED_CANARY_CERTIFIED`, the system requires passed receipts for:

- provider configuration;
- verified owner/provider account;
- credential verification;
- KYC/eligibility;
- capability probe;
- webhook/status evidence path;
- kill-switch drill.

The capability probe must prove all required:

- movement kinds;
- currencies;
- source endpoint kinds;
- destination endpoint kinds.

Controlled-canary limits are capped at the configured canary amount.

The certificate has:

- `authority: CERTIFICATION_ONLY`;
- `canExecute: false`.

## LIVE certification

LIVE promotion additionally requires:

- durable LIVE_CANARY receipt;
- durable SETTLEMENT_RECONCILIATION receipt;
- UNKNOWN-execution drill;
- duplicate-submission drill;
- cancellation drill;
- a real settled canary for every required movement direction.

The current default criteria are intended to require both:

- `DEPOSIT` — Add Funds;
- `WITHDRAWAL` — Cash Out.

Each real canary must carry:

- owner approval receipt ID;
- Money execution permit ID;
- provider reference;
- ACKNOWLEDGED state;
- SETTLED state;
- successful settlement reconciliation ID;
- non-empty evidence.

A deposit canary cannot be reused as a withdrawal canary.

Duplicate canary IDs and duplicate movement IDs fail certification.

## No evidence reuse

Commissioning rejects:

- duplicate receipt kinds;
- duplicate canary IDs;
- duplicate canary movement IDs;
- mixed provider/account bindings;
- synthetic live-canary evidence;
- missing recovery drills;
- missing directional canaries.

## Admission binding

Every executable funding admission now carries:

`commissioningCertificateId`

Any `CONTROLLED_CANARY` or `LIVE` admission without a certificate ID fails both:

- database constraint; and
- runtime execution validation.

The certificate must match:

- rail ID;
- provider;
- REAL_LIVE evidence class;
- admission level;
- maximum movement limit;
- maximum daily limit;
- allowed movement kinds;
- allowed currencies;
- source kinds;
- destination kinds.

An admission may be more restrictive than its certificate. It may never be broader.

## Low-level execution protection

Certificate verification is not only in the UI or Action Core wrapper.

`executeGovernedMoneyMovement()` itself requires the certificate proof and validates it before provider submission.

Therefore an internal caller cannot bypass FUND.3 merely by fabricating a non-empty certificate ID.

## Database guarantees

Migration 021 adds:

- `money_funding_commissioning_receipts`;
- `money_funding_commissioning_certificates`;
- `money_funding_rail_admissions.commissioning_certificate_id`.

Executable admissions must have a certificate ID.

The certificate ID is a foreign key to a persisted commissioning certificate.

Commissioning receipt/certificate tables are:

- service-role only;
- forced RLS;
- immutable through the provided store;
- non-executing.

## Internal operations store

`PostgresFundingRailCommissioningStore` provides backend-only operations to:

- append immutable evidence receipts;
- append immutable certificates;
- read receipts;
- read latest/specific certificate;
- promote a rail from a **persisted** real certificate;
- demote a rail to READ_ONLY with zero movement limits.

Promotion accepts a certificate ID, not a caller-provided certificate object.

The store reloads persisted certificate truth and derives the admission from that row.

There is intentionally no browser/client route that can submit `REAL_LIVE` evidence or promote admission.

## Funding Desk

Funding readiness now reads the latest certificate for each rail.

A rail displays:

- admission;
- certification status;
- evidence class;
- limits;
- allowed movement kinds/currencies.

A rail is shown executable only when:

1. environment is LIVE;
2. admission is CONTROLLED_CANARY or LIVE;
3. admission certificate ID matches the latest certificate;
4. certificate evidence class is REAL_LIVE;
5. certificate level matches admission;
6. limits are positive;
7. no unresolved/in-flight movement blocks execution.

Additional blockers include:

- funding provider certification not recorded;
- only synthetic/software evidence exists;
- admission/certificate binding invalid;
- no certified live rail;
- provider outcome unresolved;
- movement in flight;
- approved movement missing Money permit.

## What is complete in software

After MONEY-FUND.3:

- proposal governance — complete;
- owner approval receipt — complete;
- Action Core policy integration — complete;
- single-use Money permit — complete;
- exact-once provider attempt — complete;
- UNKNOWN recovery blocking — complete;
- settlement/fee reconciliation — complete;
- provider commissioning evidence contract — complete;
- controlled-canary certification — complete;
- live certification — complete;
- certificate-bound admission — complete;
- Funding Desk certification visibility — complete.

## What remains external

Real funding remains fail-closed until operations supplies actual external evidence for a real provider:

1. choose/approve the transfer or cash provider;
2. establish the live provider account/origination relationship;
3. finish provider KYC/eligibility;
4. install credentials in the secret manager and record only an opaque credential reference;
5. verify provider capabilities and callback/status path;
6. commission CONTROLLED_CANARY with a tiny cap;
7. run an owner-approved real Add Funds canary;
8. reconcile source, destination and provider fee;
9. run an owner-approved real Cash Out canary;
10. reconcile source, destination and provider fee;
11. execute UNKNOWN, duplicate, cancel and kill-switch drills;
12. issue LIVE certificate;
13. promote the rail using the persisted certificate ID.

Until that external evidence exists, `funding:open` remains non-executable.
