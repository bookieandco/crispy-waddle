# PUPSONSTUFF-SOCIAL.VIDEO.01–.05 — reference-video catalog (source-only)

Date: 2026-10-21  
Canonical package: `packages/social-core`  
Branch: `feat/pupson-social-video-library-20261021`

## Scope and proof boundary

This feature extends existing Social Core with a **pure owner-scoped source metadata/catalog API** for external short-form reference clips. Its output is **text-only original creative planning**, not copied reference media, a publication proposal, or distribution.

No provider account, Google Drive token, raw clip, filename, real owner ID, Drive file ID, audio, creator metadata, or source link has been checked into this public repository. The repository remains public, and actual reference assets must remain in owner-controlled storage.

### Completed source-only targets

- **.01**: `validatePupsDriveVideo` records MP4 format, dimensions, duration, audio-presence metadata, inspection evidence, and rights state. Requires evidence for any claims from reviewed frames; a file's title alone is not visual evidence.
- **.02**: `indexPupsDriveVideos` builds an immutable owner-scoped in-memory catalog with duplicate-file checks. `searchPupsDriveVideos` searches filenames, tags, and verified visual notes only for the exact owner supplied by an already authenticated caller.
- **.03**: `proposePupsOriginalConcept` builds a **new original text-only canonical ContentProject**, retaining private source lineage while keeping mediaRefs empty. Source footage is marked **INSPIRATION_ONLY** even if rights are subsequently documented.
- **.04**: `reviewPupsOriginalConcept` permits exact-owner acceptance **for planning only** or rejection; neither grants publication authority.
- **.05**: `planPupsVideoWeek` places at most seven accepted concepts into date-only, unqueued, account-unbound platform slots. The result explicitly requires a separate canonical publication approval and original rendered/rights-cleared media.

Existing `reference-adaptation.ts` is the authority for creative-distance evaluation, while `relay-workbench.ts`, `content-projects.ts`, provider adapters, the Social approval workflow, and Director remain canonical. Do not reimplement those systems.

## Exact limits

1. No Drive account access or ingestion happens in these pure functions. A future Jhadina server adapter must read source files through authorized Drive OAuth, check the authenticated Supabase owner, and store owner-scoped metadata privately (RLS and exact-authority review required).
2. A caller-provided `ownerUserId` is **not authentication**. Do not expose these helpers directly as unauthenticated API actions.
3. Source file ownership of a Drive copy does not prove copyrights or reuse rights. Commercial reuse also needs audio/music clearance and a creator/license record. Unknown rights fail closed for reuse.
4. Source media must never be attached as publishable media merely because a concept references it.
5. Approved `accepted_for_planning` != accepted for public posting. Existing Director media QA, creative-distance review, identity/rights attestation, exact-target connected account, Social/Action approval, provider delivery readback, and analytics remain separate steps.
6. No Supabase writes or migrations, schedule jobs, platform posts, spend, Vercel deployments, owner device validation or connection commissioning are performed by this branch.

## Test command and certification

- `pnpm --filter @jhadina/social-core test -- pups-drive-video-library.test.ts`
- `pnpm --filter @jhadina/social-core type-check`
- Confirm existing Social Core/Action and app Social type checks still pass against exact PR head.
- Before merging: check branch freshness against current main, run security review, and prove no source IDs/filenames/privileged URLs enter public logs or client bundles.

This is a **reviewable source-code increment**, not a live working Jhadina UI, durable private catalog, published campaign or cleared-media pipeline.
