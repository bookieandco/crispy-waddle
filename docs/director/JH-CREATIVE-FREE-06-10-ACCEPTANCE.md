# JH-CREATIVE.FREE.06 → .10 — exact-head coding and operational acceptance

## Execution receipts (source vs reality)
- **.06 (PR/CI):** PR #1467 retains canonical main-based source for Compute/Director/Pupson. PR #1427 is independent visual/3D draft; #1441 is stacked on #1427. Do not merge either 3D branch implicitly or cherry-pick its entire tree. CI must be evaluated at the *final* #1467 SHA. Cloudflare failure at prior #1467 SHA `26dce37` came from OpenNext refusing Next.js `15.5.25` (unsupported by current adapter), not image inference. #1441 latest inspected SHA `9058c97` passed independent Next16 Cloudflare/Mobile/Launch gates; preserve existing migration instead of rebuilding it here.
- **.07 (ComfyUI model):** Real-only private canary CLI at `services/pupson-image-worker/canary.py`; validates localhost, actual original source media, model/checkpoint+workflow SHA-256, output dimensions, alpha and elapsed wall time. It deliberately never measures commercial likeness automatically. The canary requires an installed authorized worker and a real original pet image, and an operator's explicit execute/license flags. **NO GPU or checkpoint evidence available in this GitHub source-only session.** Do not issue a PASS until executed on operator-owned hardware and human-inspected.
- **.08 (PupsonStuff pet/print):** `creative-production-acceptance.ts` requires actual runtime evidence, hash-linked sources/output and explicit separate reviewer/customer likeness and variant approval. This contract is not a complete automated pet-segmentation or color calibration system. Existing PrintMaster still needs a release gate wired to real approval state before commerce is enabled; no fulfillment approval is inferred.
- **.09 (JLLM/POD):** JLLM video uses existing `createAndSubmitAskVideoJob` and existing Director authority. JLLM still-image intent now routes to a clear deferred Director submission plan, without provider/paid call. `planLocalCreativeDelegation` maps JLLM to Director, Pupson to the Pupson job, and generalized POD to the POD job. `prepareLocalPodImageWork` returns zero-burst Compute workload in the canonical `pod.image.default` profile, **without submitting or publishing**. Real POD store workflow/UI wiring and persistence remain release gates.
- **.10 (OpenMontage):** The upstream is agent-first and exposes no single universally supported REST production job contract. `OpenMontageLocalProductionProvider` accepts a separately implemented, trusted operator-owned `OpenMontageOperatorBridge` and rights-verified footage manifest. Submission, polling, video download and cancellation are owned by the existing Director WholeVideoProductionProvider protocol; the injected operator bridge must run documented OpenMontage pipeline stages and perform ffprobe/output QC before marking ready. No remote paid calls in this manifest, no synthetic quality claims. **Without that configured operator runner, it is intentionally not enabled**.

## Exact operator canary invocation
```sh
cd services/pupson-image-worker
python -m unittest discover -s tests -v
# Install/start ComfyUI privately; pin commercially permitted model, nodes, and API workflow;
# configure PUPSON_LOCAL_IMAGE_WORKER_TOKEN and PUPSON_LOCAL_IMAGE_MODEL in the host secret store.
# Place an original pet source photo on the host; never check it into GitHub.
python canary.py \
  --reference /private/pet-reference.png \
  --checkpoint /private/models/approved.safetensors \
  --workflow /private/workflows/pupson-api.json \
  --commercial-license-attested --execute \
  --receipt-file /private/receipts/local-comfyui-canary.json
```
This invokes only `http://127.0.0.1:8789/v1/pupson/image/edit`, which invokes configured loopback ComfyUI. Never use an unsecured public ComfyUI URL. Human comparison of fur, eyes, nose, ears, edges and print placement is still required.

## Production blocker list
1. **Actual real GPU:** verify host GPU, VRAM, RAM, storage and model bundles/digests. This session's container has ffmpeg but no visible NVIDIA GPU or ComfyUI runtime; it is not the user's Homebase host.
2. **Commercial weights:** verify model, custom nodes, LoRAs, source assets and third-party footage rights. AGPL (OpenMontage/AUTOMATIC1111) code obligations remain separate from model licensing.
3. **3D branch integration:** selectively merge certified #1441 lineage to main when approved and coordinate the Next16 Cloudflare repair; do not assume its runtime deploy is live.
4. **Real-media QA:** private pet 1-reference/3-reference runs, identity and edge check, 2D versus 3D versus final Printify variant. Approval-gated; no Printify orders.
5. **Video runtime:** operator-owned OpenMontage clone and agent runner with approved source media and an actual ffprobe-validated mp4. No invented local service entitlement. JLLM/Director preview on iPhone afterward.
6. **No spending, production deployment, publication, GPU rental, model-download or order** is authorized by this code PR.

## Acceptance meaning
- Unit tests: `source_contract_pass` only.
- Existing CI on exact commit: `source_ci_pass` only.
- Real operator canary with hashes, pixels, and runtime: `inference_runtime_pass`.
- Human approved pet likeness / print sample: `pupson_visual_print_pass`.
- OpenMontage rendered video with provenance, ffprobe and rights: `director_video_render_pass`.
- Authenticated private mobile UX with data deletion: `private_end_to_end_pass`.

All final four cannot be inferred from the first two.
