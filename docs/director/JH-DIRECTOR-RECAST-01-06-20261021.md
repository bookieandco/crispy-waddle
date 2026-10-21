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
