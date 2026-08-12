# Jhadina Self-Repair & Self-Upgrade Agent

## Goal

Jhadina should let the user type a natural-language instruction such as:

- `Fix the Money Core bug.`
- `Upgrade the provider adapter.`
- `Find why this screen is broken and repair it.`
- `Audit yourself and fix anything safe to fix.`

Jhadina then plans, inspects the repository, makes changes in an isolated workspace, runs verification, reports what changed, and proposes or applies the resulting patch according to policy.

## Architecture

```text
Jhadina Chat
    |
    v
Intent / Change Classifier
    |
    v
Evolution Policy Gate  <---- immutable Security / Values / Audit boundary
    |
    +---- safe automatic repair ------------------+
    |                                             |
    v                                             v
Workspace Snapshot                         Approval Request
    |                                             |
    v                                             v
Coding Agent Harness ------------------> User Decision
    |
    +--> repository inspection
    +--> code edits
    +--> tests / typecheck / lint
    +--> security checks
    +--> diff review
    |
    v
Verification Gate
    |
    +---- fail --> Repair Loop (bounded)
    |
    v
Patch / Commit / Draft PR
    |
    v
Audit + Attention Center
```

## Coding Agent Harness

CopilotKit is the user-facing interaction layer. Its chat, tool calls, shared state, and human-in-the-loop capabilities are a good fit for the Jhadina Command Center. Claude Code is an execution backend for repository work: it can inspect a codebase, edit files, run tests, and handle git workflows.

Jhadina must own the authorization boundary. Neither CopilotKit nor Claude Code becomes the policy authority.

## Execution Modes

### SAFE_AUTO

May execute automatically when the change is confined to an isolated workspace and passes policy:

- formatting
- lint fixes
- type fixes
- failing unit-test repairs
- documentation corrections
- non-sensitive UI fixes
- dependency patch upgrades after compatibility checks

### APPROVAL_REQUIRED

Must show the user the plan/diff and obtain approval before applying:

- authentication or authorization changes
- database migrations
- provider credentials/configuration
- financial capabilities
- external API behavior
- memory deletion or durable memory changes
- production deployment
- changes to security controls
- changes affecting identity/privacy controls

### DENY

The evolution agent cannot directly change:

- Values Core invariants
- Policy Engine enforcement rules
- audit integrity rules
- secret storage or secret extraction boundaries
- identity ownership rules
- bank transfer/payment authorization
- military/security controls
- encryption primitives or key-management policy

It can propose changes to these areas, but the proposal must become an explicit approval/review artifact.

## Repair Loop

Each repair request receives a bounded execution budget:

1. Capture repository state.
2. Create an isolated workspace/branch.
3. Diagnose the requested problem.
4. Produce a change plan.
5. Apply the smallest safe patch.
6. Run targeted tests.
7. Run typecheck/lint/build as applicable.
8. Run security-sensitive checks when affected.
9. Review the resulting diff.
10. If verification fails, allow a bounded number of repair iterations.
11. Stop and surface an Attention item when the budget is exhausted.
12. Never silently broaden scope.

## Self-Upgrade

Self-upgrade means Jhadina may improve its implementation, skills, diagnostics, adapters, prompts, and test coverage through the same governed evolution pipeline.

It does **not** mean unrestricted recursive modification of its own authority.

The Evolution Plane may change:

- skills
- diagnostic rules
- repair strategies
- provider adapters
- UI components
- tests
- documentation
- non-security tooling

The Evolution Plane may only propose changes to:

- Policy Engine
- Values Core
- Identity Core
- secret boundaries
- audit guarantees
- high-risk financial actions
- military/security integrations

## Attention Events

Every evolution run emits safe metadata:

- `EVOLUTION_STARTED`
- `EVOLUTION_PLAN_READY`
- `EVOLUTION_APPROVAL_REQUIRED`
- `EVOLUTION_PATCH_CREATED`
- `EVOLUTION_VERIFIED`
- `EVOLUTION_FAILED`
- `EVOLUTION_ROLLBACK`
- `EVOLUTION_DENIED`
- `EVOLUTION_BUDGET_EXHAUSTED`

Never place API keys, bank credentials, military credentials, encryption keys, or raw secret-bearing tool output into these events.

## Required User Experience

The Command Center chat should support:

```text
You: Fix the bug in Money Core.

Jhadina:
I found 2 failing checks.

Plan:
1. Fix provider-read error handling.
2. Add regression test.
3. Run Money Core tests.
4. Run typecheck.

Risk: Low
Scope: Money Core read path

[Approve] [Review diff] [Cancel]
```

After execution:

```text
Jhadina:
Fixed and verified.

Changed: 2 files
Tests: 14/14 passed
Typecheck: passed
Security checks: passed

Commit: <sha>
Audit event: <id>
```

For a high-risk request:

```text
Jhadina:
I can diagnose this automatically, but applying the proposed change would modify a financial authorization boundary.

I stopped before making the change.

[Review proposal]
```

## Core Invariant

> Jhadina can be autonomous about implementation, but never autonomous about authority.

The coding agent can fix the machine. The deterministic Jhadina security/policy layer decides what the machine is allowed to change.
