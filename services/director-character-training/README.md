# Jhadina Director Character Training Runtime

Authenticated runtime boundary for Director's governed character-dataset, LoRA-training, and chunked-video-upscale capabilities.

## Endpoints

- `GET /health/live` — container liveness only.
- `GET /health` — reports runtime mode and whether real production backends are configured.
- `POST /v1/character-dataset`
- `POST /v1/character-lora/train`
- `POST /v1/video-upscale`

All POST endpoints require `Authorization: Bearer <DIRECTOR_CHARACTER_TRAINING_TOKEN>`.

## Modes

### Production proxy

Default mode. Requires:

- `DIRECTOR_CHARACTER_DATASET_BACKEND_URL`
- `DIRECTOR_CHARACTER_LORA_BACKEND_URL`
- `DIRECTOR_VIDEO_UPSCALE_BACKEND_URL`
- optional `DIRECTOR_CHARACTER_TRAINING_BACKEND_TOKEN`

These URLs point at actual GPU/model executors. The runtime validates governed inputs and validates returned lineage/evidence.

### Contract certification

Set `DIRECTOR_CHARACTER_TRAINING_CERTIFICATION_MODE=true` only in a certification/staging deployment. It returns deterministic synthetic artifact references so the HTTP/auth/governance integration can be certified without claiming model inference or training.

Health explicitly returns `productionReady:false` in this mode, and receipts include `runtime-mode:contract-certification`.

## Authority boundary

This service never:

- approves assets;
- chooses policy;
- promotes candidate LoRAs to approved inference state;
- publishes media;
- changes governed project/reference/frame lineage.

Those remain Director/Jhadina responsibilities upstream.
