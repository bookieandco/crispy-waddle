# Homebase Capability Gate

The Homebase exposes capabilities through a registry instead of allowing an LLM to invoke arbitrary services directly.

## Capability flow

Model request -> Capability Registry -> Policy Engine -> approval if required -> Adapter -> audit event

Examples:

- GitHub MCP: read-only by default; writes require explicit policy/approval.
- Files: scoped to approved roots.
- Cloud: only configured providers/buckets.
- iCloud: only authorized account/session adapters.
- LocalSend: only authenticated/verified transfers.
- Homebase administration: never directly exposed to an untrusted model.

## Workload governance

`jhadina-core` and safety/security workloads have priority over optional compute. Image generation, media processing, indexing, backups, and future mining are subordinate workloads.

Mining is intentionally modeled as a separate workload class. It must never be permitted to starve core inference, memory, connectivity, security, or synchronization services.

The registry is descriptive; actual authorization remains enforced by the deterministic policy boundary and adapter layer.
