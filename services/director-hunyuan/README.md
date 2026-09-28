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
- 1x NVIDIA GeForce RTX 4090 (24 GB) or a 24+ GB alternative;
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
RUNPOD_GPU_ID="NVIDIA GeForce RTX 4090"
RUNPOD_CLOUD_TYPE=SECURE
RUNPOD_STOP_AFTER=4h
RUNPOD_TERMINATE_AFTER=8h
RUNPOD_MIN_CUDA_VERSION=12.4
```

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
export HF_TOKEN='...'
export DIRECTOR_HUNYUAN_LICENSE_ACKNOWLEDGED=true
export DIRECTOR_HUNYUAN_TERRITORY_ACKNOWLEDGED=true

bash scripts/director-hunyuan-runpod-bootstrap.sh
```

The bootstrap script verifies GPU memory, checks out the Director/Hunyuan source,
installs dependencies, downloads the model tree and starts the worker on port
8091.

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

The Runpod API key and Hugging Face token do not belong in the Jhadina web app.

## Runtime environment on the GPU worker

```bash
DIRECTOR_HUNYUAN_WORKER_TOKEN=
DIRECTOR_HUNYUAN_OUTPUT_DIR=/workspace/jhadina/hunyuan-output

HUNYUAN_VIDEO_REPO_DIR=/workspace/jhadina/HunyuanVideo-1.5
HUNYUAN_VIDEO_MODEL_PATH=/workspace/jhadina/models/HunyuanVideo-1.5
HUNYUAN_VIDEO_MODEL_VERSION=HunyuanVideo-1.5

DIRECTOR_HUNYUAN_LICENSE_ACKNOWLEDGED=true
DIRECTOR_HUNYUAN_TERRITORY_ACKNOWLEDGED=true
```

The acknowledgement flags are mandatory. HunyuanVideo-1.5 uses the Tencent
Hunyuan Community License, which has territory/use restrictions. The worker will
not report `productionReady=true` unless acknowledgements, the checkpoint tree,
and a CUDA GPU meeting the 14 GB minimum are all present.

## Health contract

- `GET /health/live`: process liveness only.
- `GET /health`: production readiness, GPU memory inventory, model tree and
  license/territory acknowledgement.
- `POST /v1/jobs`: submit an already-authorized Director generation request.
- `GET /v1/jobs/:id`: status.
- `GET /v1/jobs/:id/artifact`: MP4 bytes.
- `DELETE /v1/jobs/:id`: cancel.

Inference success still returns `qualityClaim=false`. Director downstream QC
must independently admit the take.

## Lambda Cloud alternative

The existing Lambda launch/bootstrap helpers remain available as a secondary
cloud-burst target:

- `scripts/director-hunyuan-lambda-launch.sh`
- `scripts/director-hunyuan-lambda-bootstrap.sh`

That does not change provider authority: Runpod/Lambda are interchangeable
compute hosts behind the same Director Hunyuan worker contract.
