# Jhadina Physics Service

Provider-neutral runtime for cloth, hair, and rigid/soft-body simulation.

## Flow

Rig + appearance bindings + behavior/animation + environment constraints
→ physics provider
→ cached simulation artifact
→ physics QC
→ renderer.

## Endpoints

- `GET /health`
- `POST /v1/simulations`
- `POST /v1/qc`

A provider must return a deterministic artifact reference, frame range, collision diagnostics, and simulation metadata. The service never reports a successful simulation without a provider artifact.
