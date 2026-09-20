# Director Final Autonomous Acceptance — DIR-17

## Canonical authority
Client intent never supplies approval, provenance, storyboard lineage, production run state, creative stage state, or review authority. Production and review resolvers reconstruct those values from server-side canonical persistence.

## Generation
GenerationPlanAdapter gates every take against canonical storyboard lineage, production run/gate/stage authority, registered models and immutable provenance. Stable take identity provides idempotency. Raw GenerationService/provider handles remain private to the composition root.

## Review
Generated assets are bound to generation provenance and quality evidence. Review decisions are append-only. MediaReviewGateAdapter verifies gate, stage versions, asset/job lineage, evidence provenance and checksum before an explicit decision can commit.

## Rejection and rerun
Rejected/changes-requested media is retained. CAS transition persistence stales the reviewed lineage and creates a deterministic successor generation version. buildDirectorRerunSeed derives a stable successor take identity from the immutable review decision while preserving continuity locks and parent lineage.

## Recovery
GenerationSubmissionReconciler recovers durable submission intents after crashes/expired leases. It checks provider-side idempotency before resubmission and refuses unsafe retry for non-idempotent providers.

## Canonical orchestration
determineDirectorNextAction derives the next legal production action from canonical storyboard/generation/review state. Stale storyboard authority halts execution; rejection routes to rerun; final completion requires explicit approval.

## Human gate
No merge is performed by this acceptance phase. Full-repository failures outside Director are recorded separately and do not get rewritten as Director success.
