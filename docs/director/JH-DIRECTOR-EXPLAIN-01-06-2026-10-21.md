# JH-DIRECTOR.EXPLAIN.01–.06 — source implementation and acceptance gates

Date: 2026-10-21  
Repo: bookieandco/crispy-waddle  
Target: current-main DirectorOS Workstation and existing Director → Social approval path.  
Change class: **source-only, draft PR**. No deployed release, Supabase migration, metered render call, external publishing or spending.

## Implemented

1. **.01 / Existing Director integration.** Mount \`WorkstationExplainerStudio\` inside the owner-project Workstation. Reuse the canonical \`explainer\` profile in \`production-archetypes.ts\`, not a parallel project/account system.
2. **.02 / Narration → storyboard.** Deterministic bounded segmentation (up to 24 scenes) with calculated scene timings, hook/explanation/payoff, narration copied from the owner's script, placeholder motion direction and evidence references. Every scene remains \`SOURCE_REVIEW_REQUIRED\` regardless of user-entered source IDs. No research/fact-check or generative imagery is implied.
3. **.03 / Creative controls.** Minimal/chalkboard/cinematic visual treatments, narration *direction* (not a synthesized voice), aspect (9:16, 16:9, 1:1), timing, captions and audience. No automatic spend/provider call.
4. **.04 / Controlled conversational revision.** Narrow grammar: \`scene N narration: …\`, \`scene N visual: …\`, \`style NAME\`, \`voice NAME\`, \`pace NAME\`, \`format RATIO\`, \`duration SECONDS\`, \`captions on/off\`, \`audience: …\`. Unsupported free-form commands explicitly fail rather than silently claim AI work; revision preserves previous immutable snapshots.
5. **.05 / Mobile preview/export.** Browser canvas motion-graphic scene preview, live playback/scrubbing, SRT captions, JSON storyboard and **silent** browser-recorded video draft when the browser supports canvas capture and \`MediaRecorder\`. Unsupported iPhone/browser combinations fail with a visible message; no fake real video/voice/master receipt.
6. **.06 / Social bridge.** Strongly gated draft export requires nonempty approved Director asset ID, asset approval receipt, final-QC evidence IDs and source rights evidence. Explicit user action pre-fills title and a *selected only if eligible* asset in existing Workstation Social Scheduler. **Actual account ownership, eligible approved master, final QC and publication approval remain enforced by existing Social routes**; no autosharing, autoapproval or auto-publish.

## Existing canonical systems preserved

- \`packages/director-core/src/production-archetypes.ts\` explainer profile, storyboard/generation/lineage, Workstation editable timeline and production QC.
- \`apps/jhadina-web/src/app/api/workstation/social-proposal/route.ts\` (server-side asset+review checks, owner authority, optional final QC).
- \`components/workstation/WorkstationSocialScheduler.tsx\` (separate approval step).
- No server-side secrets in browser, no unapproved GPU or third-party provider calls, no schema write/migration.

## Explicit limitations

- This is a **locally held storyboard prototype**; it does not save a versioned storyboard into canonical Director Supabase persistence. Export JSON to preserve a draft. Revisit durable versioning only through project-authorized storage and schema-drift reconciliation.
- Narration voice option is a creative direction field, **not speech synthesis**. Local video recording is silent and comprised of text/geometric graphics; no generative video provider or expensive renderer is commissioned.
- The Social handoff package is a *pending local suggestion* with user-supplied receipt identifiers, not a verified or persisted publication draft. The canonical Social route performs real asset, owner and QC checks after the explicit operator action.
- Browser capture availability and codecs (especially iPhone Safari) need physical device testing. Source acceptance does not prove rendered output is playable or suitable for publication.
- Factual script statements are not verified; human/source review is required before approval, especially for the blocked-airspeed-sensor/wasp-nest example.

## Release/acceptance checklist

- Run \`pnpm --filter @jhadina/director-core test -- explainer-director.test.ts\` and \`pnpm --filter @jhadina/director-core type-check\`; run Web type-check and existing Social/Workstation regressions on the **exact PR head**.
- Test existing Director project/owner sign-in and unauthorized project boundaries on staging.
- iPhone Safari: portrait usable; can enter script, revise, preview/scrub, export JSON/SRT, check recorder capability message. Test browser codecs and playback if recording is available.
- Real media route: commission a rights-clean worker-generated/video + approved asset review with real evidence, then select only approved master through Social Scheduler.
- Separate owner confirmation before GPU, metered services, deployment/merge, Supabase migration, posting, scheduling, or ads.

## Suggested following implementation (requires separate approval for live actions)

Durable owner-scoped \`DirectorExplainerDraft\` persistence + timeline materialization from **real** approved assets; provider-bound voice/video rendering with capability, cost/license admission; physical iPhone acceptance; independently verified Social publication receipt. These are explicitly **not claimed** by this source PR.
