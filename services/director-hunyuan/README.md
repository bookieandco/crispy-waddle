# Director HunyuanVideo-1.5 GPU worker

This service is the private GPU execution boundary for Director's HunyuanVideo-1.5 provider.

## Recommended Lambda Cloud shape

For the current Director workload, use a single NVIDIA A6000 48 GB instance as the default production node. HunyuanVideo-1.5's upstream minimum is 14 GB VRAM with offloading enabled; 48 GB provides materially more headroom for 720p I2V/T2V, model residency, super-resolution, and future Phantom co-location.

Lambda Cloud remains an execution provider only. Director retains job intent, continuity, provenance, QC, storage admission, spend policy, and final approval.

## Runtime environment

```bash
DIRECTOR_HUNYUAN_WORKER_TOKEN=
DIRECTOR_HUNYUAN_OUTPUT_DIR=/opt/jhadina/hunyuan-output

HUNYUAN_VIDEO_REPO_DIR=/opt/jhadina/HunyuanVideo-1.5
HUNYUAN_VIDEO_MODEL_PATH=/opt/jhadina/models/HunyuanVideo-1.5
HUNYUAN_VIDEO_MODEL_VERSION=HunyuanVideo-1.5

DIRECTOR_HUNYUAN_LICENSE_ACKNOWLEDGED=true
DIRECTOR_HUNYUAN_TERRITORY_ACKNOWLEDGED=true
```

The two acknowledgement flags are mandatory. HunyuanVideo-1.5 uses the Tencent Hunyuan Community License, which has territory and use restrictions. The worker will not report `productionReady=true` unless the acknowledgements, checkpoint tree, and a CUDA GPU meeting the 14 GB minimum are all present.

## Health contract

- `GET /health/live`: process liveness only.
- `GET /health`: production readiness, GPU memory inventory, model tree, and license/territory acknowledgement.
- `POST /v1/jobs`: submit an already-authorized Director generation request.
- `GET /v1/jobs/:id`: status.
- `GET /v1/jobs/:id/artifact`: MP4 bytes.
- `DELETE /v1/jobs/:id`: cancel.

Inference success still returns `qualityClaim=false`. Director's downstream QC must independently admit the take.

## Lambda launch

Use `scripts/director-hunyuan-lambda-launch.sh` from a trusted local shell or CI runner. It creates the GPU VM through Lambda's API but does not transmit model/provider secrets in cloud-init.

After the VM is reachable over SSH, run `scripts/director-hunyuan-lambda-bootstrap.sh` on the VM with the required environment exported in the SSH session.

The launch helper defaults to:

```
LAMBDA_INSTANCE_TYPE=gpu_1x_a6000
```

You may deliberately override that with another currently available Lambda instance type.

## Cost control

The helper requires `DIRECTOR_GPU_MAX_HOURLY_USD` and refuses to launch without it. That is a local commissioning guard, not a substitute for account-level billing controls. Terminate idle instances explicitly after the production batch completes.
