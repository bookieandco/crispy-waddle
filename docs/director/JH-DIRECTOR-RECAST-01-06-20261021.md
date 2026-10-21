# JH-DIRECTOR.RECAST.01–.06 — source-only preparation
Date: 2026-10-21. Base: current main. Scope: character-only original-scene replacement, post-swap lip-sync, preview-only.

## Implemented
- Director Core `recast-preview.ts` wraps the canonical `planSourceDrivenCharacterSwap` (not a new executor).
- Locks environment `preserve-source`, source motion/orientation/lighting, original video as motion reference, `resync-after-swap` and preview intent.
- Caps preview clips at 30 seconds. Validates character consent, footage rights, approved character tracks, approved voice tracks and source audio before emitting a source-only proposed plan.
- Recast plan `executionAuthority=NONE`, `publicationAuthority=NONE`, `costAuthority=NONE`. Requiring an ActionRequest does not grant execution or worker capabilities.
- Regression tests check preserved parameters, explicit resync stage, missing rights/consent, bad durations and unapproved tracks.
- Workstation includes a **local intake form only** that exports an UNVERIFIED JSON manifest. It neither uploads footage nor grants approval. Operator-entered IDs are untrusted and do not become approved character/voice tracks.

## Still blocked / acceptance
1. **Verified intake**: server-side project owner identity, source asset existence and rights/consent receipts, media checksums and track approvals. Do not infer approved tracks from browser fields.
2. **Shot boundary / tracking**: true single- and multi-shot tracking, duration/quality verification, background/motion preservation measured against source. An input manifest is not tracking evidence.
3. **Lip-sync**: licensed backend, verified voice permission and separate governed adapter; preserve original source audio until an approved alternate exists.
4. **Preview worker**: metered or GPU compute requires fresh explicit approval, cost cap and durable model/artifact lineage; worker must not approve its own output.
5. **QC & export**: independent composite, face, hand, motion, scene and lip synchronization quality review, immutable receipts, approved media before timeline insertion.
6. **iPhone acceptance**: upload picker, owner sign-in, preview/progress/cancel/retry and playback on device. Not implemented/certified yet.

No production merge, deployment, Supabase migration, API spending, live render, video export, posting or scheduled work was authorized. The intake is a preparation utility, not a working replacement video generator.

## Commands
`pnpm --filter @jhadina/director-core exec vitest run src/recast-preview.test.ts src/source-driven-character-swap.test.ts src/studio-character-replacement-worker.test.ts`
`pnpm --filter @jhadina/director-core run type-check`
`pnpm --filter @jhadina/jhadina-web run type-check`


## LIVE.07–.10 continuation (October 21) — safe, read-only source work

- **LIVE.07:** Reuse canonical Workstation Project Inputs uploads for footage, character images and source audio; Recast now exposes a mobile-friendly project-media chooser and links to existing Artifact Core upload. No direct provider upload.
- **LIVE.08:** New GET and POST \`/api/director/recast/preflight\` call authenticated Supabase session plus Director edit membership before privileged reads; fetch owner/project-scoped \`director_project_inputs\` and clean \`jhadina_artifacts\`, verify role, MIME, size and SHA-256. Never send signed URLs, private blobs, privileged credentials or media hashes back to client.
- **LIVE.09:** Canonical VoiceSyncTrack has no \`approved\` boolean. Repair Recast type checks to use \`isVoiceSyncTrackUsable\` and **separate independently verified voice-sync evidence refs**. Client-entered evidence IDs do not count as verified source material.
- **LIVE.10:** Browser submits selected input references to a **read-only** preflight; it may return \`mediaVerified=true\`, but always returns \`readyForRender=false\` and explicit blockers for decoded duration, tracking approval, voice sync evidence, rights, likeness consent and uncommissioned preview worker. User can export a JSON request marked unverified but **cannot render**, schedule GPU, publish, approve or spend.
- Recast planner, media-readiness and route tests cover quality, no authority escalation, unauthorized request denial, owner scoping, missing/foreign/quarantined assets and worker absence.

**Live rendering blocked:** No vetted tracking persistence/immutable approval lookup has been wired; no verified voice-sync receipt resolver, decoded video duration, independent backup, staging/iPhone evidence, GPU worker admission or cost authorization. A source branch passing CI is not a released/live Recast renderer.

**Follow-up production gates:** owner-approved isolated DB and storage readiness; durable tracking-and-voice evidence model (never client-supplied booleans), verified consent provenance, media probe, safe preview worker cost admission, real source/output hash QC, user review and explicit per-render approval. Then iPhone portrait upload, preview, cancellation, playback and output verification. No production merge or deployment was authorized by this sequence.


## LIVE.11–.14 — reviewed evidence, preview worker contract and independent QC (October 21, source only)

- **LIVE.11 reviewed evidence:** \`recast-reviewed-evidence.ts\` requires privileged, independently reviewed source media SHA-256 + decoded duration, approved *human/hybrid* character tracks with source hash/project lineage, independently reviewed voice alignment with matching audio SHA, and owner/asset-bound media rights and likeness consent. Cross-project, worker-only, mismatched or unsupported records are rejected. These are *interfaces and validations*, not proof that live database records exist.
- **LIVE.12 preview worker handoff:** \`recast-preview-worker-handoff.ts\` builds ordered tracking-review → character replacement → lip-sync → preview rendering → independent QC → owner-review steps from the existing Director governed planner. The handoff has \`workerConnection='DISABLED'\`, \`executionPermit=null\`, \`costAuthority='NONE'\`, and can neither run GPU processing nor submit external model calls.
- **LIVE.13 independent QC:** quality decision requires identity, motion, environment, edge, lighting and voice-sync measurements, observed audio/video offset, SHA-256 for output, nonempty evidence refs, independent reviewer ≠ worker provider, original-media lineage. Even a passing synthetic QC result **cannot** approve a timeline asset or publish.
- **LIVE.14 regressions and acceptance:** tests prove coherent reviewed-source candidate planning, denied stale/foreign/worker-only tracks, missing consent/voice receipts, invalid lip timing, QC fail-closed behavior, explicit no-render/no-spend/no-publish. CI includes the new tests. Existing Workstation selection/preflight route is unchanged and keeps render blocked.

**Honest boundary:** No durable, server-owned per-track and per-voice review repository is yet integrated. No actual reviewed live record has been fetched or matched to a real uploaded file. No actual source video decode, segmentation, replacement inference, synchronized MP4, iPhone playback, independent human QC, GPU provision, expense, merge, deploy, or model call has occurred. The new reviewer record interfaces cannot be accepted from browsers as trusted evidence.

**Next runtime prerequisites:** establish authenticated, append-only project-scoped tracking, voice and rights review persistence using separate authorized human review; verify signed asset access & decoded duration; commission a license-checked backend only after separate owner approval and cost cap; run actual bounded preview; attach measured QC + approval evidence; test portrait iPhone and exports. Do not reinterpret passing code tests as runtime evidence.


## LIVE.15–.18 — authenticated Cast admission and direct mobile intake (2026-10-21, code only)

1. **LIVE.15**: Added \`recast-cast-admission.ts\` (pure, fail-closed) matching a selected reference image's server-stored SHA-256 to a single approved character appearance in the **same project**. Both the Cast identity and appearance must carry approved timestamps/user IDs; multiple matching variants remain ambiguous and blocked.
2. **LIVE.16**: Added \`recast-cast-admission-repository.ts\` to read existing service-role-only \`director_cast_characters\` and \`director_character_appearance_variants\` records *after* Director membership validation. No new table, RPC, or Supabase migration. The existing Recast POST preflight now distinguishes \`mediaVerified\` from \`castAppearanceMatched\`; both are informative, not render authorization. Cast store missing/stale gives a fail-closed unavailable response, not a fictitious approval.
3. **LIVE.17**: Recast mobile interface can upload source footage, photo and source audio directly via existing Artifact Core scanner and Director Project Inputs binding, then choose the admitted asset ID. Upload scanner must return \`clean\`. UI shows Cast admission status and persists no secrets. Exported JSON is deliberately marked as **untrusted client claims**; any future backend must re-fetch each server approval.
4. **LIVE.18**: Added Cast approval hash and API negative regressions to Director targeted CI, checking mismatched project/sha, missing approval and ambiguous appearances. No execution APIs or GPU workers activated.

**Remaining real-world blockers**: an *append-only, server-owned* review authority for scene-specific tracking and lip-sync tracks does not yet exist; Cast approval confirms only character appearance provenance, not the filmed performer's consent. Neither audio/video decoded duration nor actual preview output has been verified. No render will be admitted until independent receipts, per-job owner consent, cost ceiling, worker deployment, measured QC and iPhone acceptance are established.
