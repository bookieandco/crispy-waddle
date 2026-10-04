# Director Watch Worker

RunPod-compatible frame-sampling worker for Jhadina Director Watch jobs.

The worker does **observation only**:

- `creative`: samples authorized media and asks a local/OpenAI-compatible vision model for evidence-bound creative observations and cinematic notes;
- `sports`: samples authorized game footage and asks the same provider for bounded Director sports observations.

It never writes directly to Supabase, never publishes media, and never authorizes bets or financial actions. Results return only through the authenticated Jhadina Web callback.

## Runtime

Required:

```bash
DIRECTOR_WATCH_VLM_URL=http://127.0.0.1:8000/v1/chat/completions
DIRECTOR_WATCH_VLM_MODEL=<vision-model-id>
```

Optional:

```bash
DIRECTOR_WATCH_VLM_TOKEN=
DIRECTOR_WATCH_REQUEST_TIMEOUT_SECONDS=120
```

The VLM endpoint should be reachable from the worker container. A local OpenAI-compatible vision server on the same RunPod is the intended low-cost path.

The Jhadina Web dispatcher supplies the authorized source locator, job identity, callback URL and callback token per job. The token is used only for the callback and is never written to job output.

## RunPod

Build this directory as the worker image and configure it as a RunPod Serverless endpoint or run it beside a local VLM on a pod. The handler accepts RunPod's standard `{"input": ...}` payload.

The container includes FFmpeg. Frame extraction uses an argument vector rather than a shell command.


## Homebase TV / game capture

Homebase uses a separate service entrypoint so the cloud worker never gains
private-network or local-device access:

```bash
docker build -f Dockerfile.homebase -t jhadina/director-watch-homebase .
```

Required server settings:

```bash
JHADINA_DIRECTOR_WATCH_HOMEBASE_TOKEN=<random server-only token>
DIRECTOR_WATCH_HOMEBASE_PRODUCTION_READY=true
DIRECTOR_WATCH_HOMEBASE_BIND=0.0.0.0
DIRECTOR_WATCH_HOMEBASE_PORT=8097
```

Expose the service to Jhadina Web through an authenticated HTTPS private
ingress/reverse proxy and set the web-side
`JHADINA_DIRECTOR_WATCH_HOMEBASE_URL` to that HTTPS origin. The app refuses
plain HTTP.

Local files are restricted to configured roots:

```bash
DIRECTOR_WATCH_HOMEBASE_MEDIA_ROOTS=/media,/mnt/media,/srv/media
```

RTSP is deny-by-default and requires explicit host allowlisting:

```bash
DIRECTOR_WATCH_HOMEBASE_RTSP_ALLOWLIST=192.168.1.50,camera.lan
```

HDMI/tuner/capture devices are configured by alias; incoming jobs can name only
the alias and cannot supply arbitrary FFmpeg arguments:

```bash
DIRECTOR_WATCH_HOMEBASE_CAPTURE_SOURCES='{
  "living-room-hdmi":{"kind":"v4l2","device":"/dev/video0"},
  "tv-tuner":{"kind":"decklink","device":"DeckLink Mini Recorder 4K"}
}'
DIRECTOR_WATCH_HOMEBASE_DECKLINK_ALLOWLIST="DeckLink Mini Recorder 4K"
```

Supported capture kinds are `v4l2`, `avfoundation`, and `decklink`.
The Homebase service exposes authenticated `GET /health`,
`POST /v1/jobs`, and `GET /v1/jobs/:id`. Jobs are queued locally with a
bounded queue and send observations back through the same authenticated
Jhadina Web callback as cloud Watch. It remains observation-only and grants no
publication, wagering, or financial authority.


## Edge CPU prefilter

Background `creative` and `sports` Watch jobs can reduce VLM cost by selecting informative frames before multimodal analysis. Motion scoring is built into the Watch image. Optional object detection is supplied by a separate HTTP detector and remains observation-only.

For the provider-neutral Homebase CPU detector in this repository:

```bash
cd services/director-watch-worker
docker compose -f docker-compose.homebase.yml up -d --build
```

Supply the detector model separately:

```bash
DIRECTOR_EDGE_VISION_MODEL_HOST_PATH=/srv/jhadina/models/detector.onnx
DIRECTOR_EDGE_VISION_MODEL_ID=<model-id>
DIRECTOR_EDGE_VISION_MODEL_LICENSE=<license-or-commercial-license-id>
DIRECTOR_EDGE_VISION_MODEL_LICENSE_APPROVED=true
DIRECTOR_EDGE_VISION_PRODUCTION_READY=true
DIRECTOR_EDGE_VISION_TOKEN=<random server-only token>
```

The detector service does not vendor Ultralytics code or weights. If the supplied model was produced or distributed under Ultralytics terms, confirm the license appropriate to the deployment before setting `DIRECTOR_EDGE_VISION_MODEL_LICENSE_APPROVED=true`.

The default Homebase topology keeps the detector on an internal-only Docker network. Watch has a second egress network so authenticated callbacks to Jhadina Web still work.

The edge stage can select frames based on:

- motion;
- interesting object classes such as person or sports ball;
- periodic baselines;
- a strict maximum number of VLM-escalated frames.

Its result is `EDGE_PREFILTER_ONLY`: it cannot identify a person, establish an official sports state, publish, wager, or replace the VLM/final-QC layers.

## CVAT ground-truth review

Jhadina can optionally connect to a self-hosted CVAT instance using:

```bash
JHADINA_CVAT_BASE_URL=https://<your-cvat-host>
JHADINA_CVAT_ACCESS_TOKEN=<access-token>
```

Director can create a CVAT task from an authorized HTTPS or signed Director media source, refresh provider status, import reviewed shapes/tracks/tags, and show them in the Workstation.

Imported CVAT annotations are always `GROUND_TRUTH_CANDIDATE_ONLY` and `accepted=false` until an authorized user explicitly accepts the import. Sports annotations remain context/training evidence and cannot establish official score, clock, possession, result, or wager authority.
