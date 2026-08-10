# Jhadina Wav2Lip Runtime

GPU-backed inference service for the Studio Voice Sync provider.

## Runtime contract

- `GET /health` — reports `ready` only when the Wav2Lip inference script and checkpoint are present.
- `POST /v1/lipsync` — accepts multipart `video`, `audio`, and `project_id` plus optional inference settings.
- Successful jobs return an `outputId`, output path, runtime metadata, and a QC-pending state.

The service intentionally returns `syncOffsetMs` and `confidence` as `null` because Wav2Lip inference itself does not establish those quality metrics. Jhadina QC must calculate them from the generated media with an independent analyzer. This prevents runtime execution from being confused with measured quality.

## Configuration

- `WAV2LIP_CHECKPOINT=/models/wav2lip.pth`
- `WAV2LIP_ROOT=/opt/wav2lip/Wav2Lip`
- `WAV2LIP_INPUT_DIR=/data/inputs`
- `WAV2LIP_OUTPUT_DIR=/data/outputs`
- `WAV2LIP_JOB_TIMEOUT_SECONDS=1800`
- `WAV2LIP_MAX_UPLOAD_BYTES=524288000`

Mount `/models` with the appropriate checkpoint and persist `/data/outputs` to durable object storage in production. Put authentication, authorization, rate limiting, and signed media URLs in front of the service; do not expose the inference endpoint directly to browsers.

## Build note

Provide a licensed Wav2Lip checkout as the Docker build context under `Wav2Lip/`. Review the upstream repository's license and any model/checkpoint terms before commercial deployment.
