# Director HunyuanVideo-1.5 GPU worker

This service is the private GPU execution boundary for Director's HunyuanVideo-1.5 provider.

Director remains authoritative for creative intent, references, continuity, rights,
QC, storage admission, spend policy, timeline mutation and final approval. A GPU
provider only executes an already-authorized shot/take request.

## Primary live target: Runpod

Runpod is the preferred first production target because it supports prepaid card
billing, dedicated GPU Pods, SSH, HTTPS port proxying, persistent/network volumes,
automatic stop/terminate timers and an official agent/MCP control plane.

Recommended first canary:

- Secure Cloud;
- 1x currently available US GPU with at least 24 GB VRAM;
- default automatic-selection ceiling of $1.00/hour;
- CUDA 12.4+;
- port `8091/http` and `22/tcp`;
- automatic stop after 4 hours;
- network volume for reusable model weights when available.

HunyuanVideo-1.5 documents a 14 GB minimum with offloading; the 480p I2V
step-distilled model is the initial Director canary because upstream explicitly
optimizes it for 8/12-step generation.

### Official Runpod agent setup

Run the repo helper on the machine hosting your coding agent:

```bash
bash scripts/runpod-agent-setup.sh
```

It follows Runpod's official agent setup path:

1. installs/updates `runpod/runpod-plugins-official`;
2. installs `runpodctl` from Runpod if missing;
3. verifies `RUNPOD_API_KEY` authentication.

Runpod also exposes the hosted API MCP server at:

```
https://mcp.getrunpod.io/
```

and the documentation MCP server at:

```
https://docs.runpod.io/mcp
```

Never commit `RUNPOD_API_KEY` to this repository.

### Create the Director GPU Pod

After the Runpod account is funded and authenticated:

```bash
export RUNPOD_API_KEY=...
bash scripts/director-hunyuan-runpod-create.sh
```

Defaults:

```bash
RUNPOD_GPU_ID=AUTO
RUNPOD_MAX_HOURLY_USD=1.00
RUNPOD_MIN_GPU_MEMORY_GB=24
RUNPOD_CLOUD_TYPE=SECURE
RUNPOD_COUNTRY_CODE=US
RUNPOD_STOP_AFTER=4h
RUNPOD_TERMINATE_AFTER=8h
RUNPOD_MIN_CUDA_VERSION=12.4
```

`AUTO` queries current Runpod inventory at launch time, requires Secure Cloud
capacity in the selected country, enforces the VRAM and hourly-price ceilings,
and prefers 48 GB-class GPUs before smaller admitted fallbacks. Set
`RUNPOD_GPU_ID` explicitly to override automatic selection.

If `RUNPOD_NETWORK_VOLUME_ID` is present, the launcher attaches that volume and
does not set an automatic termination timer. Without a network volume, it uses a
disposable local volume and auto-terminates to reduce forgotten-idle spend.

Use:

```bash
runpodctl pod list
runpodctl pod get <pod-id>
```

to obtain SSH information.

### Bootstrap the Pod

SSH into the Pod. Set the required secrets only in the trusted runtime/session:

```bash
export DIRECTOR_HUNYUAN_WORKER_TOKEN='...'
export DIRECTOR_HUNYUAN_LICENSE_ACKNOWLEDGED=true
export DIRECTOR_HUNYUAN_TERRITORY_ACKNOWLEDGED=true

bash scripts/director-hunyuan-runpod-bootstrap.sh
```

The bootstrap script verifies GPU memory, checks out Director, and then builds an
immutable Hunyuan runtime bundle from the revisions in
`scripts/director-hunyuan-source-pins.sh`. The currently admitted bootstrap pins
the HunyuanVideo-1.5 code repository plus the Hunyuan weights, Qwen 2.5 VL,
ByT5, Glyph-SDXL-v2 and SigLIP source revisions. Glyph is pulled from the public
Hugging Face duplicate `Alptekinege/Glyph-SDXL-v2` at its single immutable
commit rather than from a moving ModelScope `master`.

For Hunyuan's SigLIP vision-encoder layout it uses
`google/siglip-so400m-patch14-384` (Apache-2.0), pinned to revision
`538da78b54e0d958422c4b1d5562a21595f4adce`. The bootstrap validates the
1152-dimensional, 27-layer, 384px, patch-14 vision configuration, saves only the
`SiglipVisionModel` and `SiglipImageProcessor` into Hunyuan's expected
`image_encoder` / `feature_extractor` subdirectories, and writes both the
SigLIP `SOURCE.json` and a complete `DIRECTOR_RUNTIME_SOURCES.json` manifest
covering every pinned source. Warm-cache reuse is admitted only when that source
manifest exactly matches the current pins. The gated FLUX.1-Redux-dev bundle and
its adapter weights are not used.

The Runpod HTTPS proxy URL is:

```
https://<pod-id>-8091.proxy.runpod.net
```

Director then receives only:

```bash
DIRECTOR_HUNYUAN_WORKER_URL=https://<pod-id>-8091.proxy.runpod.net
DIRECTOR_HUNYUAN_WORKER_TOKEN=...
DIRECTOR_HUNYUAN_CANONICAL_GENERATION_ENABLED=true
DIRECTOR_HUNYUAN_PROVIDER_ID=hunyuan-video-1.5
```

The Runpod API key does not belong in the Jhadina web app. Cold bootstrap does
not require a Hugging Face access token because every downloaded checkpoint is
from a public source.

## Runtime environment on the GPU worker

```bash
DIRECTOR_HUNYUAN_WORKER_TOKEN=
DIRECTOR_HUNYUAN_OUTPUT_DIR=/workspace/jhadina/hunyuan-output

HUNYUAN_VIDEO_REPO_DIR=/workspace/jhadina/HunyuanVideo-1.5
HUNYUAN_VIDEO_MODEL_PATH=/workspace/jhadina/models/HunyuanVideo-1.5
HUNYUAN_VIDEO_MODEL_VERSION=HunyuanVideo-1.5@<pinned-weight-revision>

DIRECTOR_HUNYUAN_LICENSE_ACKNOWLEDGED=true
DIRECTOR_HUNYUAN_TERRITORY_ACKNOWLEDGED=true
```

The acknowledgement flags are mandatory. HunyuanVideo-1.5 uses the Tencent
Hunyuan Community License, which has territory/use restrictions. The worker will
not report `productionReady=true` unless acknowledgements, the checkpoint tree,
and a CUDA GPU meeting the 14 GB minimum are all present.

## Health contract

- `GET /health/live`: process liveness only.
- `GET /health`: production readiness, GPU memory inventory, model tree,
  license/territory acknowledgement, and the validated booted source manifest
  plus its SHA-256.
- `POST /v1/jobs`: submit an already-authorized Director generation request.
- `GET /v1/jobs/:id`: status.
- `GET /v1/jobs/:id/artifact`: MP4 bytes.
- `DELETE /v1/jobs/:id`: cancel.

Inference success still returns `qualityClaim=false`. Completed runtime
receipts include the exact pinned weight version and
`sourceManifestSha256`; Director preserves that lineage in the admitted output
metadata. Director downstream QC must independently admit the take.

## Lambda Cloud alternative

The existing Lambda launch/bootstrap helpers remain available as a secondary
cloud-burst target:

- `scripts/director-hunyuan-lambda-launch.sh`
- `scripts/director-hunyuan-lambda-bootstrap.sh`

That does not change provider authority: Runpod/Lambda are interchangeable
compute hosts behind the same Director Hunyuan worker contract.
