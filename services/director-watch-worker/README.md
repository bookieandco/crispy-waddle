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
