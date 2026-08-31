# B&W-6 Home Automation Import Manifest

Status: audit/repair checkpoint.

Source implementation branch: `feat/bw-1-capability-registry`
Target reconciliation line: `main`

## Home Automation foundation identified

### Capability registry

- `packages/jhadina-capability-registry/src/home-assistant-adapter.ts`
- `packages/jhadina-capability-registry/src/home-assistant-canonical-adapter.ts`
- `packages/jhadina-capability-registry/src/home-automation-model.ts`
- `packages/jhadina-capability-registry/src/home-assistant-device-registry.ts`
- `packages/jhadina-capability-registry/src/home-assistant-transport-registry.ts`
- `packages/jhadina-capability-registry/src/home-assistant-registration.ts`
- `packages/jhadina-capability-registry/src/home-assistant-service-mapper.ts`
- `packages/jhadina-capability-registry/src/home-assistant-capability-executor.ts`

### Core governance dependency

- `packages/jhadina-core-spine/src/action-gateway.ts`
- `packages/jhadina-core-spine/src/action-gateway.test.ts`

## Intentionally excluded from this B&W-6 import checkpoint

- UI-only quick actions
- remote-control API routes
- unrelated remote-control implementation files
- unrelated scene/recovery work
- deployment-specific changes

Those may require separate reconciliation against current `main`.

## Acceptance invariant

The imported Home Automation fabric must preserve:

`DecisionProposal → PolicyPort → PolicyDecision → ActionGateway → CapabilityExecutor → Home Assistant transport`

Canonical entities/devices must remain independent of transport configuration.
