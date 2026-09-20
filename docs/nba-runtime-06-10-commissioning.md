# NBA-RUNTIME.06–10 commissioning closure

## Scope

This phase converts the existing NBA physical-identity architecture into an empirical commissioning path. It does **not** permit a production certification to be inferred from implementation completion.

## NBA-RUNTIME.06 — hidden benchmark

- Hidden truth and inference outputs are separate inputs.
- At least 50 truth tracks are required by the canonical benchmark.
- Truth must be revealed after inference.
- Metrics are computed for identity precision/recall, team accuracy, jersey accuracy, ReID link accuracy, false resolutions, ambiguity and unknowns.
- Manual help invalidates the benchmark.

## NBA-RUNTIME.07 — physical game trial

Canonical trial is NBA game `0022400408`, Lakers at Warriors, 2024-12-25.
The registered source video SHA-256 is `047b433bbe174f6968fa6b38475a6220e0e9d7ee5277fd5217d8968813421461`.
Official NBA evidence is quarantined from perception and may be used only after inference is frozen.

## NBA-RUNTIME.08 — measured repair

The weakest measured component is selected from detector recall, team accuracy, jersey accuracy, ReID accuracy, identity precision and identity recall. A repair must cite failure evidence, a repair commit and a same-hidden-corpus rerun. Manual identity edits are forbidden.

## NBA-RUNTIME.09 — blind full game

Ground truth and official data remain locked until the complete physical run finishes. Every track must partition into RESOLVED, AMBIGUOUS or UNKNOWN. UNKNOWN is preferable to a false resolution.

## NBA-RUNTIME.10 — empirical NBA-ID-PHYS certification

Certification requires all prior NBA-ID-PHYS gates plus genuine `basketball-ec2xx/1` network inference, a passing hidden benchmark, repair evidence, blind full-game evidence and immutable receipt roots.

### Current empirical state

An actual commissioning attempt was made against the mounted Lakers/Warriors source. FFmpeg/ffprobe succeeded and the source was independently hashed/probed. The runtime then attempted to install `inference-sdk`, but DNS/network access to the package host was unavailable. Consequently the Serverless inference call did not execute.

**Certification remains false.** No detector predictions, identity metrics, hidden-truth benchmark scores, repair improvements or full-game identity results have been fabricated.

The next execution environment must provide outbound access to install/use `inference-sdk` and reach the configured Roboflow Serverless endpoint while loading `ROBOFLOW_API_KEY` from the environment.
