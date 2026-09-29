# Director Speaker QC

Private speaker-identity evidence worker for Director.

It uses a pinned SpeechBrain ECAPA-TDNN VoxCeleb speaker-recognition model to produce provider-independent acoustic fingerprints and cosine-similarity measurements. It does **not** approve voices, create Director voice identities, or choose dialogue delivery.

## Runtime

- Model: `speechbrain/spkrec-ecapa-voxceleb`
- Pinned revision: `ff989f88e92ccc120569763824f8eedd5afc9039`
- Normalization: FFmpeg → mono 16 kHz PCM16 WAV
- Fingerprint: L2-normalized embedding → signed int16 quantization → SHA-256
- Raw speaker embeddings are not persisted by the worker contract.
- The audio-file SHA is separate from the speaker-embedding SHA.
- `qualityClaim` remains false until Director policy/QC consumes the receipt.

## Endpoints

- `GET /health` — loads the pinned model and returns real readiness.
- `POST /v1/fingerprint` — authenticated audio → acoustic fingerprint receipt.
- `POST /v1/verify` — authenticated reference/candidate audio → cosine similarity.

Set `DIRECTOR_SPEAKER_QC_TOKEN` for bearer authentication. Optional runtime overrides exist for model ID/revision/cache/device, but production should retain the pinned admitted model revision.
