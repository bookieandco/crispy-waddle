# Spatial implementation status

The remaining SPATIAL-06 through SPATIAL-16 provider-neutral control-plane contracts are implemented in `spatial-pipeline.ts` and exported from the package index.

Implemented deterministic slices:

- SPATIAL-06: heterogeneous fusion, temporal/spatial agreement, duplicate-source handling, identity boundary, evidence preservation.
- SPATIAL-07: spatial relationship-ready workspace/context contracts remain compatible with the existing Jhadina knowledge graph boundary; no parallel graph is created.
- SPATIAL-08: bounded spatial context is represented through the existing Jhadina context boundary rather than a second context system.
- SPATIAL-09: user-owned workspace contract with replay/time/layer/claim/evidence references and bounded JANET/DELIA/MARISA context.
- SPATIAL-10: deterministic attention ranking with explicit reasons and preserved evidence/limitations.
- SPATIAL-11: read-only spatial query planning for Ask Jhadina.
- SPATIAL-12: DELIA reasoning output contract separating observations, scenarios, risks, alternatives, and evidence gaps.
- SPATIAL-13: MARISA receives an explicitly approved spatial operation context; this contract grants no execution authority.
- SPATIAL-14: provider-neutral Director spatial context and capabilities; no action execution capability is exposed.
- SPATIAL-15: live/near-real-time stream contract with endpoint allowlisting, attribution, adapter version, capability state, and replay-license flag.
- SPATIAL-16: deterministic readiness aggregation. Production readiness remains false until integration, privacy, conformance, deployment, and operational checks are independently verified.

## Boundary

This package remains intelligence/control-plane infrastructure. It does not create a second OS, policy engine, executor, knowledge graph, or source of truth. Raw source material must enter through observation/evidence boundaries; fused interpretations remain non-authoritative until the existing reality admission path accepts them.

The GEV adapter and actual live-stream provider integrations remain external implementation work. This file intentionally does not claim that external feeds, replay, or production deployment have been verified.
