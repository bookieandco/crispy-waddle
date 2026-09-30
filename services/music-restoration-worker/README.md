# Music Restoration Worker

Private compute runtime for `MUSIC-RESTORE.1` through `.4`.

This worker is deliberately narrower than Music Core. It does not choose a repair, approve a repair, mutate provenance, or decide that output quality is acceptable. Music Core owns those decisions. The worker only:

- probes an immutable source with FFprobe;
- separates a source into vocals / drums / bass / other with pinned Demucs;
- derives tempo, beat, conservative downbeat/section, transient, spectral and vocal observations with librosa;
- executes an allow-listed FFmpeg repair operation after an authorization id is supplied;
- returns hash-bound runtime receipts and named output artifacts.

## Security boundary

Set:

- `MUSIC_RESTORATION_WORKER_TOKEN` — optional static bearer fallback for local/manual deployments. Production Jhadina uses pinned Vercel OIDC instead.
- `MUSIC_RESTORATION_SOURCE_HOST_SUFFIXES` — comma-separated HTTPS host suffixes allowed for signed source URLs. Default: `.supabase.co`.
- `MUSIC_RESTORATION_OUTPUT_DIR` — persistent scratch/output directory. Default: `/data/music-restoration`.
- `MUSIC_RESTORATION_DEMUCS_MODEL` — admitted Demucs model. Default: `htdemucs`.
- `MUSIC_RESTORATION_DEMUCS_DEVICE` — `auto`, `cpu`, or `cuda`. RunPod commissioning uses `cuda` and health fails closed if CUDA is unavailable.

Source URLs are staged by a network-only module. The staged file must match the requested SHA-256 before it reaches FFmpeg, Demucs, or librosa. Compute code itself has no source-download logic.

## Endpoints

- `GET /health/live`
- `GET /health`
- `POST /v1/probe`
- `POST /v1/separate`
- `POST /v1/perceive`
- `POST /v1/execute`
- `GET /v1/jobs/{job-token}/artifact/{name}`

The artifact route only serves `vocals.wav`, `drums.wav`, `bass.wav`, `other.wav`, or `output.wav` from the worker-managed job directories.

## Restoration rules

- Demucs stems are derived evidence, never canonical source truth.
- The downbeat grid is a low-confidence 4-beat phase heuristic and must remain evidence, not authority.
- Vocal F0/activity is generated only when the artifact is explicitly identified as a vocal stem.
- The executor accepts only: `copy`, `gain`, `eq`, `declick`, `declip`, `denoise`.
- Arbitrary FFmpeg filter graphs are not accepted from callers.
- Output is PCM24 WAV and is independently re-hashed again by Music Core before durable registration.

## RunPod commissioning

Music restoration now runs as a **localhost-only sidecar** on the existing
Director GPU Pod. It is started automatically by
`scripts/director-hunyuan-runpod-bootstrap.sh`.

Runtime layout:

- public `8091` — Director Hunyuan plus the allow-listed
  `/music-restoration/*` proxy;
- public `8092` — Director speaker QC when enabled;
- private `127.0.0.1:8093` — Music restoration sidecar.

Production Jhadina calls:

```text
https://xn73vwwekavcc6-8091.proxy.runpod.net/music-restoration
```

and authenticates with the short-lived `VERCEL_OIDC_TOKEN` automatically
provided by Vercel. The worker verifies the exact production owner, team,
project id, project name, subject and environment against Vercel's public JWKS.
No long-lived Music bearer secret is required in Vercel.

A static `MUSIC_RESTORATION_WORKER_TOKEN` remains supported as a higher-priority
fallback for local/manual deployments.

The Music bootstrap reuses the RunPod CUDA/PyTorch base through a
`--system-site-packages` virtualenv, stores outputs under
`/workspace/jhadina/music-restoration-output`, stores the Torch/Demucs cache
under `/workspace/jhadina/models/torch`, verifies CUDA, warms the admitted
Demucs model, and binds only to localhost.
