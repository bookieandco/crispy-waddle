# DIRECTOR PROCESS REPLICATION + REHEARSAL RUNTIME

## Purpose

This runtime turns “study this process and do it better” into a governed Director workflow rather than a one-shot generation prompt.

Flow:

```
Ask Jhadina
  -> process-replication intent
  -> durable replication job
  -> Director Study worker
  -> durable Study observations
  -> reference process recipe
  -> Director-native improvement receipts
  -> CreativeStageGraph
  -> rehearsal stage
  -> canonical Director production/review authority
  -> editable project/timeline
```

The source tutorial remains evidence. Jhadina does not silently rewrite it, claim to understand it without observations, or grant a model/provider publication/spend/timeline authority.

## Study worker contract

Web dispatches:

```json
{
  "studyId": "study:replicate:...",
  "sourceUrl": "https://...",
  "callbackUrl": "https://<jhadina>/api/director/studies/observations",
  "replicationJobId": "replicate:...",
  "contract": "DIRECTOR_STUDY_WORKER_V1"
}
```

Authorization uses `Bearer $JHADINA_DIRECTOR_STUDY_WORKER_TOKEN`.

The worker may use FFmpeg, transcript extraction, vision, audio analysis, or other admitted observation providers, but it must return evidence rather than opaque conclusions.

Callback shape:

```json
{
  "studyId": "study:replicate:...",
  "replicationJobId": "replicate:...",
  "status": "completed",
  "observations": [
    {
      "id": "obs:...",
      "kind": "process-step",
      "time": { "startSeconds": 18.2, "endSeconds": 43.1 },
      "confidence": 0.92,
      "provenance": {
        "provider": "study-observer",
        "source": "reference-video",
        "sourceUrl": "https://..."
      },
      "payload": {
        "processStep": {
          "order": 2,
          "kind": "character",
          "purpose": "hold character identity",
          "operation": "generate multiple portraits and reroll until the face is close",
          "requiredCapabilities": ["image-generation"],
          "inputs": ["prompt"],
          "outputs": ["portrait"],
          "qcChecks": [],
          "failureModes": ["identity drift"]
        }
      }
    }
  ]
}
```

Only structured `payload.processStep` evidence is eligible for Process Recipe compilation. Other observations may still be persisted for audit/Study use.

## Director-native improvement pass

Known fragile patterns can be replaced only with an explicit receipt. Examples:

- prompt/reroll identity -> canonical references + certified visual adapter + held-out identity QC;
- weak garment consistency -> Production Asset Package + Wardrobe State + Garment Lock;
- spatial/object drift -> World State + spatial preflight;
- whole-scene retries -> localized repair + timeline versioning;
- “pick the best-looking take” -> multimodal take selection + Production Coherence Gate;
- performance/blocking/interaction steps -> Rehearsal Loop before expensive final generation.

The receipt records source operation, replacement operation, reason and evidence IDs.

## Rehearsal Loop

Rehearsal is now a first-class creative stage between previs and generation.

Modes can escalate from cheap to expensive:

1. table read — voice identity, dialogue timing, interruption/overlap;
2. blocking — positions, crosses, eyelines and camera axis;
3. performance — gesture, facial intent, timing and emotional beat;
4. interaction — props, garments, furniture and collision/affordance checks;
5. camera — framing, lens/movement timing and coverage;
6. full dress — final identity/wardrobe/world references at reduced quality before final generation.

Director observations become notes. The character retries until the take graduates, escalates to a higher-fidelity rehearsal, or blocks. An approved rehearsal can preserve a Performance Master for final generation.

This is not a claim that an AI character is conscious or literally practicing. “Rehearsal” is a production-control loop over simulated performances and evidence.

## Runtime status

Source/runtime orchestration is complete when:
- replication job persistence exists;
- Study observations are durable;
- callback/reconciliation is configured;
- recipe/improvement/stage compilation passes;
- rehearsal graduation gates final generation.

Live reference understanding still requires a deployed Study worker and real provider credentials. If those are absent, the job fails closed as `DIRECTOR_STUDY_WORKER_NOT_CONFIGURED` rather than pretending the reference was analyzed.
