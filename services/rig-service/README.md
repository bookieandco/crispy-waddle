# Jhadina Rig Service

Provider-facing runtime for RigNet/Pinocchio. The web app must call this service rather than importing provider runtimes into Next.js.

## Endpoints

- `GET /health` — liveness/readiness and loaded-provider state
- `POST /v1/rig` — validate mesh, select provider, generate rig artifact
- `POST /v1/qc` — inspect a rig artifact and return deterministic QC metrics

## Rig request

```json
{"meshUrl":"...","provider":"rignet","characterId":"..."}
```

The service returns a job ID and artifact IDs for the generated skeleton, weights and rig metadata.

## QC contract

QC must report:

- `bone_count`
- `weighted_vertex_ratio`
- `unweighted_vertex_count`
- `orphan_bone_count`
- `degenerate_bone_count`
- `max_influence_count`
- `root_bone_present`
- `hierarchy_valid`
- `skin_deformation_ready`
- `overall` (0..100 or null)
- `warnings`

The current service contract deliberately does not claim that RigNet or Pinocchio succeeded until a provider runtime returns a validated artifact. Provider containers can be deployed independently behind `JHADINA_RIGNET_URL` and `JHADINA_PINOCCHIO_URL`.
