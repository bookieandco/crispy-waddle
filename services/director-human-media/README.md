# Director Human Media Runtime

This service is Director's local/RunPod human-media execution boundary. The first commissioned engine is **MuseTalk 1.5** for governed lip-sync jobs.

## Authority boundary

The worker accepts only the existing `director.human-media-job.v1` contract and returns `director.human-media-execution.v1` receipts. It does **not** own:

- Product Truth or UGC approvals;
- likeness/voice/reference rights;
- commercial artifact admission;
- Watch/QC acceptance;
- Social publication approval;
- spend authority.

Every runtime result carries `qualityClaim:false`.

## RunPod topology

The sidecar binds only to `127.0.0.1:8095` on the existing Director RunPod. The existing authenticated Hunyuan gateway exposes the allowlisted surface under `/human-media/*`. No additional public RunPod port or second GPU Pod is required.

The hourly Director one-shot distinguishes three states:

1. core Director runtime unavailable → existing guarded replacement workflow may be admitted;
2. core runtime healthy but MuseTalk missing and registered Pod identity available → reconcile the **existing** Pod in place;
3. core runtime healthy but SWLC has not yet exposed the Pod identity → wait; never create a replacement just to add MuseTalk.

## Provenance

`scripts/director-human-media-source-pins.sh` pins MuseTalk code and model/dependency snapshots. The RunPod bootstrap writes `DIRECTOR_RUNTIME_SOURCES.json` with exact downloaded artifact hashes and a shared-Pod runtime fingerprint.

This is runtime provenance, not a commercial-license waiver. Director's existing commercial readiness gate still requires exact dependency/model license evidence before a commercial canary is admitted.

## Commissioning truth

Source code being merged is not `DIRECTOR-LOCAL-UGC.FINAL`. FINAL still requires a real health receipt, real MuseTalk execution receipt, real Watch/QC evidence, accepted-output economics, and one Business Factory UGC canary reaching the governed Social handoff.
