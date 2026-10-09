# DIRECTOR-COLAB-AI-PLUS.1 — 50-unit interactive GPU training lane

Owner confirmed the connected Google AI Plus subscription displays **50 monthly Colab compute units**. This is an entitlement/starting monthly allotment; **not** evidence of 50 units presently unused, a particular GPU being available, or permission to execute a training job.

## Existing machinery reused

- Canonical Director character pipeline: `packages/director-core/src/character-training-pipeline.ts` (dataset plans, LoRA request/QC, approval boundary).
- Actual worker boundary: `services/director-character-training/worker.py` (governed executor; existing certificate-only backend does not train real weights).
- Canonical Compute Core stays the only orchestrator for *production* GPU jobs.
- Existing Google Homebase `COLAB-MYDRIVE-SYNTHETIC.ipynb` proves only an owner-operated synthetic DVC Drive roundtrip. It is independent of Director and does not establish model training or automatic runtime access.

## Added in this source slice

- `packages/director-core/src/colab-training-budget.ts`: admission of **manual owner-launched experiment candidates only**. The owner must enter the **observed remaining** compute units, approve this exact trial, review the notebook and establish data/model rights. Default reserve is 10 units; the maximum *planned* experiment cap is 10 units. The plan never executes or spends automatically.
- `infrastructure/homebase/google-drive/DIRECTOR-COLAB-AI-PLUS-PREFLIGHT.ipynb`: an **owner-reviewed, owner-run** notebook. Defaults to no approval, no quota value, and synthetic training disabled. After manual approval and a GPU runtime connection, it can perform a tiny synthetic Torch optimizer step, emitting a non-production receipt.
- `packages/director-core/src/colab-training-budget.test.ts` and `infrastructure/homebase/google-drive/test_director_colab_ai_plus.py`: regressions and notebook static safety checks, wired into existing Director CI.

## Critical limitations

1. The consumer Colab subscription **is not Colab Enterprise** and is not a durable, documented service-to-service Director queue. Google's standard Colab API is beta and allowlist-controlled; Colab Enterprise has a separate cloud billing model. **Do not silently bind GitHub Actions, Vercel or phone to a consumer GPU session.**
2. A 2–10 unit experiment is only a **planning budget**, not an enforceable charge ceiling. Unit rates depend on chosen hardware, and GPU allocation can consume units while idle. Watch the Colab balance and **disconnect the runtime** when the experiment ends.
3. A synthetic optimization step shows a GPU Tensor operation, *not* Director LoRA training, model provenance, image/video output, checkpoint continuity, commercial rights or production QC.
4. Do not automatically mount Google Drive. A Colab account can mount personal My Drive only after user authorization, potentially broad folder access. Review every notebook; transfer approved datasets/receipts to scoped private folders only, ideally encrypted.
5. Existing `JHADINA-HOMEBASE/02-DIRECTOR-ASSETS` can hold approved dataset/LoRA candidates, hashes, manifest, license records and evaluation samples. An uploaded file is not a Director-certified output or recoverable backup.
6. **No automatic GPU launches. No continuous Watch/video service. No inference production promotion, paid spend, or publication authorization.**

## Owner-executed preflight

1. Open the checked-in notebook in Google Colab from GitHub, inspect every cell, and confirm your remaining balance/rate in Colab before connecting GPU.
2. Choose a suitable available GPU runtime manually. Edit `REPORTED_REMAINING_UNITS` to the *observed current balance* and approve this exact trial with `OWNER_APPROVES_THIS_TRIAL=True`. The first cell will otherwise refuse.
3. Optionally set `RUN_SYNTHETIC_TRAINING=True` to run one small synthetic gradient step (no external data/model). If it stays false, only the live GPU availability/metadata are probed.
4. Save the result to your chosen secure Drive folder only after reviewing for metadata sensitivity. Include the notebook revision/commit ID and readback SHA-256 if the receipt is ever used as audit evidence.
5. Disconnect Colab; compare units consumed in the Colab UI before planning a real *rights-clean* character LoRA evaluation.

## Next integration gate

After a genuine GPU preflight and balance check, adapt the **existing character LoRA backend**, not a new training service, to accept reviewed datasets, immutable model revision/licensing metadata, checkpoint SHA-256 and QC evidence. This needs actual dataset/license approvals and an explicit per-job owner approval. Restore SWLC durable storage separately; the notebook cannot fix a stalled database or serve as an always-on runtime.

Official provider source (retrieved October 2026):
- https://support.google.com/googleone/answer/16882689?hl=en — AI Plus Colab 50 CCUs.
- https://research.google.com/colaboratory/faq.html — variable accelerators, non-guaranteed runtime, usage caveats.
- https://developers.google.com/colab/api/reference/rest — consumer Colab API beta, allowlist.
