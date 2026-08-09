# JhadinaOS Integration Spine v1

## Purpose

The integration spine is the shared contract between Jhadina Core and every domain OS. It provides one path for capabilities, events, approvals, and audit records.

## Flow

```text
Domain OS
   |
   | CapabilityRequest
   v
PolicyBoundary
   |
   +---- denied ----> AuditSink
   |
   +---- approval --> ApprovalSink
   |
   v
CapabilityExecutor
   |
   v
AuditSink + EventBus
```

## Domain registry

The first registry includes:

- OverageOS
- MusicOS
- TVOS
- DirectorOS
- PodcastOS
- CampaignOS
- Commerce
- Creator Workstation

Domain implementations remain independent. They do not receive direct authority over identity, memory, policy, audit, or publication.

## Project contract

`JhadinaProject` is the common project identity. A project has a domain, version, approval state, timestamps, and extensible metadata. Future versions can add asset references, lineage, exports, and `.jhadina` package manifests without changing domain-specific records.

## Capability contract

A domain asks for a named capability through `CapabilityRequest`. The request passes through the policy boundary before execution. Consequential capabilities can require explicit user approval.

## Event contract

Cross-domain coordination uses typed event names rather than direct coupling. Initial examples include:

- `OVERAGE_OPPORTUNITY_CREATED`
- `OVERAGE_VERIFICATION_REQUIRED`
- `FOIA_REQUEST_DUE`
- `FOIA_RESPONSE_RECEIVED`
- `MUSIC_TRACK_CREATED`
- `MUSIC_RESTORATION_COMPLETED`
- `TV_CONTENT_DISCOVERED`
- `TV_PROJECT_UPDATED`
- `SCENE_UPDATED`
- `TAKE_CREATED`
- `PODCAST_EPISODE_UPDATED`
- `CAMPAIGN_DATA_UPDATED`
- `CAMPAIGN_TASK_CREATED`
- `PRODUCT_OPPORTUNITY_CREATED`
- `AD_DRAFT_CREATED`
- `PROJECT_READY_FOR_REVIEW`
- `ASSET_EXPORTED`
- `APPROVAL_REQUIRED`
- `ACTION_COMPLETED`
- `ACTION_FAILED`

## Approval boundary

Generation and preparation can be autonomous within policy. Public publication, paid advertising, consequential outreach, and other configured actions remain approval-gated.

## External integrations

Third-party repositories are adapters behind capabilities. Their implementation details must not become Jhadina Core contracts. This makes projects such as node_exporter, media tools, browser automation, messaging systems, and model runtimes replaceable.

## Next implementation steps

1. Add production adapters for the existing Memory Core, Policy Engine, Audit Ledger, and Action Executor.
2. Register the existing domain services against `DOMAIN_MANIFESTS`.
3. Add persistence for projects, approvals, events, and audit entries.
4. Add Creator Workstation project/asset APIs and `.jhadina` export/import.
5. Add System Health adapter and Prometheus/node_exporter metrics ingestion.
