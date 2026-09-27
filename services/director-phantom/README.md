# Jhadina Director Phantom Worker

Private execution boundary for `Phantom-video/Phantom`. Director owns creative intent, references, continuity, QC, approval, and final production certification. This worker only executes an already-authorized subject-to-video shot/take.

## Runtime requirements

- checkout of `Phantom-video/Phantom`
- its Python/GPU dependencies
- Wan2.1 T2V 1.3B checkpoint directory
- Phantom-Wan-1.3B checkpoint
- Phantom-Wan-14B checkpoint/directory
- writable output directory

Environment:

```
DIRECTOR_PHANTOM_WORKER_TOKEN=
DIRECTOR_PHANTOM_OUTPUT_DIR=
PHANTOM_REPO_DIR=
PHANTOM_WAN_CKPT_DIR=
PHANTOM_CHECKPOINT_1_3B=
PHANTOM_CHECKPOINT_14B=
PHANTOM_MODEL_VERSION_1_3B=
PHANTOM_MODEL_VERSION_14B=
```

The health endpoint reports `productionReady=true` only when the real repo and checkpoints exist.

## Endpoints

- `GET /health/live`
- `GET /health`
- `POST /v1/jobs`
- `GET /v1/jobs/:id`
- `GET /v1/jobs/:id/artifact`
- `DELETE /v1/jobs/:id`

## Truth boundary

A successful inference returns `qualityClaim=false`. That is intentional. Phantom producing bytes is not the same as Director certifying cinematic quality. The generated take must still pass Director identity, performance, wardrobe/product, spatial, audio, continuity, final-watch, editability, and four-production gates before `DIRECTOR-PRODUCTION.FINAL` can pass.
