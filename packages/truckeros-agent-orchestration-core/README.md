# @jhadina/truckeros-agent-orchestration-core

Provider-neutral orchestration boundary for TruckeroOS.

## Boundary

```text
Agent reasoner
    ↓
ActionProposal
    ↓
PolicyRule
    ├── ALLOW ─────────────→ ToolExecutor
    ├── PENDING_APPROVAL ─→ ApprovalGateway
    └── DENY
             ↓
        AgentEventLog
```

The model is never given direct credentials or domain-service references. It produces proposals. The boundary decides whether a proposal can execute.

## Hard rules in v1

- Agents must be explicitly registered and active.
- Tools must be explicitly allow-listed for the agent.
- Money movement is always denied by this boundary.
- Consequential/irreversible actions require approval and are never executed by `AgentOrchestrator`.
- Read-only and reversible actions may execute when policy allows them.
- Every lifecycle transition is appended to a tamper-evident hash chain.
- Marketplace, Dispatcher Economics, Route/Stop Intelligence, booking, and money remain separate domains; this package only orchestrates through contracts.

## Intended TruckeroOS flow

```text
FreightSourceRegistry
  → Dispatcher evaluation
  → Route & Stop Intelligence
  → Agent proposal
  → Policy
  → Approval (when required)
  → existing domain execution boundary
```

The v1 package intentionally does not implement external provider credentials, autonomous booking, rideshare execution, ELD mutation, or money movement.

## Verification

```bash
pnpm --filter @jhadina/truckeros-agent-orchestration-core type-check
pnpm --filter @jhadina/truckeros-agent-orchestration-core test
```
