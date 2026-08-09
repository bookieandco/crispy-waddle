# JhadinaOS Mainframe

## Purpose

Jhadina is the shared control plane for the user's domain operating systems. Domain OSes remain modular applications; they do not duplicate identity, memory, policy, knowledge, audit, or authorization.

## Domain OS placement

```text
JhadinaOS Mainframe
├── Core
│   ├── Identity / JANET
│   ├── Memory Core
│   ├── Pattern Engine
│   ├── Context Builder
│   ├── Knowledge Constitution
│   ├── Values Core
│   ├── Policy Engine
│   ├── Action Executor
│   ├── Capability Registry
│   ├── Event Bus
│   └── Audit Ledger
│
├── Domain OS
│   ├── OverageOS
│   │   ├── County Intelligence
│   │   ├── Surplus Discovery
│   │   ├── FOIA / Public Records
│   │   ├── Property Intelligence
│   │   ├── Verification
│   │   ├── Entity Resolution
│   │   └── Opportunity Pipeline
│   ├── MusicOS
│   │   ├── Catalog
│   │   ├── Restoration
│   │   ├── Production
│   │   ├── Mixing / Mastering
│   │   └── Release Operations
│   ├── TVOS
│   │   ├── Content Discovery
│   │   ├── Research
│   │   ├── Production
│   │   ├── Project Tracking
│   │   └── Distribution
│   └── CampaignOS
│       ├── Geography
│       ├── Election Data
│       ├── Voter / Public Data
│       ├── Campaign Operations
│       ├── Field / Organizing
│       └── Communications
│
└── Shared Capabilities
    ├── Browser Automation
    ├── Computer Use
    ├── Voice / Realtime
    ├── Messaging / Email
    ├── Maps / Geography
    ├── Document Intelligence
    ├── External APIs
    └── Data Connectors
```

## Integration contract

Every domain OS communicates with the mainframe through typed capabilities and events:

1. Domain requests a capability.
2. Policy Engine evaluates authorization and risk.
3. Context Builder supplies only the required context.
4. Action Executor invokes the adapter.
5. Result is recorded in the Audit Ledger.
6. Evidence is stored separately from derived conclusions.
7. Memory is proposed/saved according to the Memory Core approval rules.

## Domain isolation

A domain OS must not directly bypass the mainframe to:

- modify authoritative knowledge;
- make irreversible financial/legal actions;
- change user identity or permissions;
- silently create persistent memory;
- send consequential outreach without policy authorization.

## Shared event examples

- `OVERAGE_OPPORTUNITY_CREATED`
- `OVERAGE_VERIFICATION_REQUIRED`
- `FOIA_REQUEST_DUE`
- `FOIA_RESPONSE_RECEIVED`
- `MUSIC_TRACK_CREATED`
- `MUSIC_RESTORATION_COMPLETED`
- `TV_CONTENT_DISCOVERED`
- `TV_PROJECT_UPDATED`
- `CAMPAIGN_DATA_UPDATED`
- `CAMPAIGN_TASK_CREATED`
- `APPROVAL_REQUIRED`
- `ACTION_COMPLETED`
- `POLICY_DENIED`

## External repository strategy

External projects are connected through adapters/capabilities rather than copied wholesale into the mainframe. This keeps Jhadina's governance layer authoritative and lets implementations be replaced without changing domain contracts.

## Security boundary

Treat external automation, browser control, communications, financial APIs, and computer-use agents as untrusted executors. They receive scoped credentials and narrowly defined actions. Jhadina remains responsible for authorization, auditability, and user approval.
