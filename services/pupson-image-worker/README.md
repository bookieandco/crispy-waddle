# PupsonStuff private Qwen-Image-Edit worker

This service implements the actual `POST /v1/pupson/image/edit` contract introduced in `apps/pupsonstuff/lib/local-image-worker.ts`. It is **not** a hosted Unsloth inference service. It routes authenticated pet-reference edits into an operator-owned, **loopback-only** ComfyUI installation using a reviewed **API-format** workflow graph. It can use [Unsloth Qwen-Image-Edit GGUF](https://unsloth.ai/docs/models/tutorials/qwen-image-2512) checkpoints in ComfyUI after the model, text encoder, vision tower, VAE, and GGUF node extension are installed.

## Installation and test

Install Python 3.11+ in a private host environment:

```sh
python -m venv .venv
. .venv/bin/activate
pip install -r requirements.txt
python -m unittest discover -s tests -v
```

Connect a private ComfyUI worker with `PUPSON_COMFY_URL=http://127.0.0.1:8188` and a reviewed, **exported API workflow JSON**. Select the exact `LoadImage` input node IDs for 1–3 reference slots, the prompt input node containing `inputs.text`, and the `SaveImage` node. Do not use a text-to-image-only workflow: this is the pet identity preservation path.

Set these through the host secret/config manager (not committed to GitHub):

```sh
PUPSON_LOCAL_IMAGE_WORKER_TOKEN=<32+ character unique random secret>
PUPSON_LOCAL_IMAGE_MODEL=qwen-image-edit-2511-Q4_K_M
PUPSON_COMFY_WORKFLOW_PATH=/private/workflows/pupson-api.json
PUPSON_COMFY_PROMPT_NODE=<node id with inputs.text>
PUPSON_COMFY_INPUT_NODES=<LoadImage id>,<LoadImage id>
PUPSON_COMFY_OUTPUT_NODE=<SaveImage id>
PUPSON_COMFY_INPUT_DIR=/private/ComfyUI/input
PUPSON_COMFY_OUTPUT_DIR=/private/ComfyUI/output
PUPSON_COMFY_URL=http://127.0.0.1:8188
PUPSON_COMFY_TIMEOUT_SEC=75
```

Launch with `python server.py`. It binds only to `127.0.0.1:8789` by default. For a phone/control-plane gateway, use an authenticated, TLS-terminating private tunnel/proxy with allowed client identities and no public ComfyUI API exposure; a non-loopback bind additionally requires explicit `PUPSON_ALLOW_NONLOCAL_BIND=1`. Configure the Next.js server's `PUPSON_LOCAL_IMAGE_WORKER_URL` to the gateway's HTTPS `/v1/pupson/image/edit` route, matching token and pinned model. Select `PUPSON_OPENAI_STYLE_BACKEND=local_worker` only after a real canary succeeds.

## Known commissioning conditions

- The model and ComfyUI are installed and started by the operator. Nothing downloads weights or launches billable GPU infrastructure.
- **Latency must fit the 75-second backend deadline and Next.js 90-second request deadline**. CPU-only reference editing likely cannot meet this threshold; production may require a durable async job protocol later. Do not enable `local_worker` until this is measured.
- Uploads and completed outputs are deleted from the configured ComfyUI input/output folders after synchronous completion. An isolated five-minute cleanup loop removes stale `pupson-<UUID>` input/output files after 30 minutes, including late completions. Keep ComfyUI isolated and independently verify purge/volume encryption before production. Use an isolated, protected ComfyUI instance with no other tenants.
- No prompt, customer image, API secret, or debug trace is deliberately logged. All requests use an authenticated endpoint; upstream reverse proxy logs must also be redacted.
- All three product types still require actual pet likeness/print master quality review. Passing a unit test is not an art or commercial license certification. Confirm the Unsloth checkpoint's specific model license and commercial terms with the operator.
- Keep storefront `PUPSON_FULFILLMENT_MODE=dry_run`; running this worker does not authorize Printify orders.
