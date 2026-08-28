# TruckeroOS Approval Boundary v1

The agent orchestration layer may propose marketplace actions, but proposal creation never grants execution authority.

## State machine

`PENDING_APPROVAL -> APPROVED -> CONSUMED`

Terminal non-execution states are `REJECTED` and `EXPIRED`.

## Rules

- Every approval is bound to the originating workflow run and proposal.
- Approval carries the original authorization context unchanged.
- Approval identity is explicit in `approvedBy` and `approvedAt`.
- Expiry is enforced both when approving and when authorizing execution.
- `authorizeExecution()` is one-shot and consumes the approval, preventing replay.
- Authorization returns a unique nonce for the downstream execution boundary.
- Approval transitions append to the existing hash-chained audit log.
- The approval layer does not execute marketplace tools.

## Execution contract

The future execution boundary should accept only an `ExecutionAuthorization` produced by `authorizeExecution()` and independently validate that authorization before invoking a tool. The agent orchestrator remains unable to bypass that gate.
