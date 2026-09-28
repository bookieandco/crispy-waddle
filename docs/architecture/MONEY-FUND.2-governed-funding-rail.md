# MONEY-FUND.2 — Governed funding rail and owner approval spine

## Outcome

MONEY-FUND.2 closes the software gap between a Funding Desk proposal and a future external funding-provider call.

The repository now has one governed chain for deposits, withdrawals, transfers and future profit sweeps:

1. verified owner endpoints;
2. immutable movement proposal;
3. fingerprint-bound Action Core-compatible approval receipt;
4. explicit owner approve/reject;
5. live funding-rail policy preflight;
6. Action Core receipt consumption;
7. Money Action Core authority proof;
8. single-use Money execution permit;
9. provider quote/instruction preparation;
10. permit consumption immediately before provider submission;
11. durable movement attempt;
12. provider evidence;
13. UNKNOWN/recovery blocking;
14. source/destination/fee settlement reconciliation.

A real bank or transfer provider is **not** commissioned by this phase.

## Owner approval

Each movement proposal receives an expiring approval receipt for:

`money.movement.execute`

The approval fingerprint binds:

- movement ID;
- user ID;
- movement kind;
- Coffer ID;
- exact minor-unit amount;
- currency;
- source endpoint;
- destination endpoint;
- idempotency key;
- original request timestamp.

Changing any of those economic facts invalidates the approval.

Provider and rail selection are downstream of owner economic approval and are separately bound by the Money execution permit.

Owner approval alone has no ability to move money.

## Approval Center

`/approvals` now surfaces Money movements as first-class governed work.

The user sees:

- Add funds / Cash out / Transfer;
- exact amount;
- source → destination;
- receipt ID;
- receipt expiry;
- Approve;
- Reject.

The UI states that approval still requires:

`Money permit → LIVE rail → provider attempt → reconciliation`

Expired approvals cannot be executed.

## Funding Desk readiness

`/money/funding` now reads:

`GET /api/money/funding-readiness`

and reports:

- pending approvals;
- approved movements missing execution permits;
- unresolved provider attempts;
- in-flight attempts;
- funding rail admissions;
- per-movement limits;
- daily limits;
- allowed kinds/currencies;
- explicit blockers.

The default repository state contains:

- rail: `funding:open`;
- provider: `unassigned-funding-provider`;
- environment: `LIVE`;
- admission: `UNCOMMISSIONED`;
- max movement: 0;
- max daily movement: 0.

Therefore production funding remains fail-closed until a real provider is commissioned.

## Funding rail execution policy

An execution-capable rail must be:

- `CONTROLLED_CANARY` or `LIVE`;
- environment `LIVE`;
- provider-bound to the selected adapter;
- permitted for the movement kind;
- permitted for the currency;
- permitted for source/destination endpoint kinds;
- below the per-movement cap;
- below the rolling daily cap;
- free of unresolved movement attempts;
- backed by admission/runtime evidence.

A sandbox, read-only or uncommissioned rail cannot consume owner approval.

## Action Core / Money authority

`MoneyMovementExecutionHandler` is an Action Core handler for:

`money.movement.execute`

The associated policy performs funding-rail preflight before Action Core consumes the approval receipt.

After Action Core accepts and consumes the receipt, the handler:

1. constructs a Money Action Core authority proof;
2. issues a short-lived single-use execution permit;
3. rechecks rail policy;
4. obtains a non-executing quote;
5. prepares a non-executing provider instruction;
6. consumes the Money permit;
7. submits the instruction exactly once.

If policy/quote/instruction preparation fails before submission, the unused permit is revoked.

## Attempt and provider truth

Movement attempts are deterministic over movement + permit + provider + instruction.

Provider states:

- ACKNOWLEDGED;
- PENDING;
- SETTLED;
- REJECTED;
- CANCELLED;
- UNKNOWN.

UNKNOWN is recovery-required.

The same permit/instruction attempt cannot be submitted again while its result is in-flight or unknown.

Provider evidence never becomes authority.

## Settlement reconciliation

Reconciliation supports explicit fee application:

- `SOURCE_ADDED`: source decreases by amount + fee; destination receives full amount;
- `DESTINATION_DEDUCTED`: source decreases by amount; destination receives amount - fee;
- `SEPARATE`: source and destination each tie to amount while fee is posted separately.

A mismatch produces reconciliation reason codes and cannot silently pass.

## Durable schema

MONEY-FUND.2 adds:

- `money_funding_rail_admissions`;
- `money_movement_approval_receipts`;
- `money_movement_attempts`;
- `money_movement_provider_events`;
- `money_movement_reconciliations`.

All are service-role-only and RLS forced.

The tables store no:

- bank access tokens;
- broker passwords;
- wallet seed phrases;
- wallet private keys;
- raw signer tokens;
- raw provider execution credentials.

`credential_ref` is only an opaque reference to an external secret manager.

## Certification cases

The MONEY-FUND.2 certification suite proves:

1. provider selection cannot mutate owner-approved economics;
2. uncommissioned rails deny before approval consumption;
3. the canonical approval → permit → provider chain submits exactly once;
4. replay cannot reuse the consumed approval;
5. UNKNOWN provider evidence blocks deterministic replay;
6. source-added and destination-deducted fee reconciliation both tie correctly;
7. mismatched settlement fails.

## External commissioning still required

Software completion does not claim live money movement.

Before Add Funds / Cash Out can execute real money, an external commissioning run still needs:

- a real funding/ACH/broker-cash provider;
- secret-manager credential reference;
- provider/KYC/account approval;
- endpoint capability mapping;
- tiny controlled-canary limits;
- real quote receipt;
- one real owner-approved canary movement;
- provider ACK/settlement evidence;
- source and destination balance reconciliation;
- fee reconciliation;
- UNKNOWN/cancel/retry drill;
- post-canary limit review.

Until those receipts exist, the Funding Desk must continue to show `FAIL CLOSED`.
