# DIRECTOR-CONVERGE.01–.03 — transcript/reference reconciliation and production-boundary recovery
Date: 2026-10-22
Status: SOURCE-ONLY BRANCH / acceptance pending exact-head CI, PR review and downstream live proof

## Frozen evidence / ownership
- Canonical repository: `bookieandco/crispy-waddle`; source base `main` at `04e96506f78ad16d7cd2d4a5fdb98c5c437c0a61`.
- Existing donor PRs: #1390 (exact UGC asset identity and finite costs), #1432 (Recast; disabled live worker), #1431 (Explainer; earlier browser import build failure), #1446 (Music Moments), #1467 (free Creative source-only), #1430 (Social provider security). Do not merge stale stacks wholesale.
- Preserve main's corrected local-UGC FINAL receipt comparison and its local-UGC migration fixes. Do not import another Director runtime, cast store, publisher, executor or ledger.
- This sequence contains no database DDL, deployment, new account connection, provider execution, wallet signing, publication, paid render or GPU action.
- A browser preview, timing-smoke MP4 or CI green build is NOT proof of a production-quality final render.

## Director conversation/transcript requirements recovered
The user-provided Director chats and filmmaking/tutorial transcripts establish the following target contracts. These are requirements, NOT assertions that every workflow is live.

| Department / format | Preserved requirement | Existing canonical source surface | Missing acceptance proof |
|---|---|---|---|
| Story bible / screenplay | Premise, thesis, cause/effect beats, motivations, location, timeline, relationships, dialogue tone; Celtx-like linked scene→shot→take | `cinematic-story-bible`, `screenplay-blueprint`, `cast-bible`, `production-story-compass` | Durable owner-scoped revision → generation → source shot readback |
| Character visual DNA | Same face, body, silhouette, costume, props, age/damage variants and 2D/3D/video identity; reference close-up plus differentiated full-body/silhouette views | `cast-bible`, `continuity-reference-strategy`, `character-reference-bootstrap`, `character-training-pipeline` | Actual frame-by-frame multi-angle character identity checks on real rendered takes |
| Voice DNA | Character accent, emotional tone, performance, pronunciation and speaker consistency; owned/consented reference samples, dialog/ADR and lip-sync; reversible voice replacement | `voice-identity`, `movie-audio-bible`, `voice-replacement-edit`, `transcript-assisted-lip-sync` | Recorded speaker fingerprint + verified consent + render-level sync/listening test |
| Lighting department | Key/fill/back/edge; practical/motivated sources; direction, softness, contrast ratio, modifiers/grids/flags/bounce/diffusion; intensity, temperature, ambience, exposure, depth, mood and frame-to-frame continuity | `cinematic-lighting`, `cinematography-analysis`, `camera-language` | Controls demonstrably reach the selected provider and match in adjacent real shots |
| Blocking / staging | Actor marks and spacing, screen-side/eyeline continuity, sightlines, motivated movement, shapes/lines/subtext, unobstructed action, audience attention and geography; close-up for emotion, wide for action, lead room and reaction/counter shots | `previs-blockout`, `world-reference-workflow`, `camera-language`, `dialogue-coverage-workflow` | Actual shot diagrams/poses and continuity QC against rendered assets |
| Visual direction | Lens/focal length, dolly/track/pan/tilt, negative space/thirds/leading lines, motivated camera movement, 21:9 film / 16:9 faceless / vertical 9:16 formats and safe crops | `camera-language`, `previs-blockout`, `model-prompt-translation` | Aspect-safe playable output, per-shot framing QC and seamless project formats |
| Takes / regeneration | Reference prior video only when a scene directly continues; otherwise establish new environment. Lock unchanged character/wardrobe/lighting/camera; modify “same everything except X”; immutable takes and undo | `continuity-reference-strategy`, `generation-reference-manifest`, `generation-plan-adapter`, `playhead-generation-continuation` | Prospective source-to-output lineage, repeatable asset/hash, visual comparison |
| Cartoon and animation | Native 2D/3D cartoons, acting, squash/stretch, anticipation, staging, timing, secondary action, volume preservation, rigs and synchronized dialog | `animation-principles`, `cartoon-production-workflow`, `studio-rig-animation`, `hybrid-animation-production` | Animated delivered video, character consistency and performance QC |
| Ads / UGC / Reels | Product fidelity, human/synthetic disclosure, governed rights, original ad variations, vertical TikTok/IG/FB reels and Shorts, variant testing & Attribution | `ugc-production`, `commercial-creative-lab`, `production-archetypes`, Social/Growth/Ads canonical cores | One authentic rights-cleared pilot + separate publication/paid-ads approvals |
| Faceless / music videos | B-roll/environment-led storytelling, narration, original music video performances, exact vocal stems, room tone, Foley and consistent mix | `music-lipsync-package`, `movie-audio-bible`, `production-audio-capture`, `editorial-reduction-workflow` | Synchronized downloadable MP4/MOV, correct audio and iPhone playback |
| Edit/final | Non-destructive DAW/NLE, revisions, generated-region replacement, FCPXML/OTIO interchange vs actual final media render, live QC and evidence | `timeline-command`, `nle-roundtrip`, `production-quality-certification`, `final-export-inspection` | Durable timeline RPC and actual FFmpeg output + independent QC on same asset |

### Important source distinctions
- User-supplied training/transcript examples describe production technique or third-party demonstrations; they do not prove that Director's own provider executed those actions.
- The Cinema Studio transcript's previous-video references are appropriate for direct continuation, not unrelated scenes.
- Voice-reference examples are technique demonstrations, not permission to clone a third-party person's voice. Canonical `voice-identity` supports owned recordings and consented references.
- Blocking should guide actor intention and audience comprehension, not merely place cubes in a 3D preview.
- Lighting vocabulary must become concrete, provider-translated parameters; lighting module presence does not certify photographic consistency.
- Story DNA and Director learning remain owner/project-scoped, with creative overrides winning over learned taste.
- Character story identity persists off-camera; visual outputs alone must not replace approved story/character state.

## .01 — evidence preservation
- Start from the pinned main SHA above.
- Reuse modules and donor PR paths, not obsolete branch stacks. No new parallel runtime or schema.
- Carry forward the latest known private runtime audit: legacy Director tables partly present, newer workstation/commissioning tables missing; Supabase migration history contains duplicate timestamp candidates. **Read-only forensic findings**, no production migration authorized.
- Exact-head CI and deployment proof must be refreshed after this PR is opened; historical green checks do not certify this branch.

## .02 — demo/fixture source isolation
- New pure `production-asset-admission` helper rejects missing source-provider IDs, known synthetic/certification providers and demo/qualityClaim:false lineage.
- Studio editing manifest shows rejected demo source as **unusable even if an approval row already exists**.
- Owner approval POST checks persisted provider and metadata; not a client-supplied approval label.
- Timeline generated-asset insertion checks persisted origin even if an approval row exists.
- FINAL QC evidence deposition checks the persisted master asset origin.
- Social handoff checks the persisted asset origin independently of format-dependent final QC.
- Unit tests cover certification, fixture, synthetic, mock, test, synthetic metadata, non-finite / tampered approval and an ordinary named provider. These are admission controls, NOT proof of a genuine physical media artifact.
- Residual risk: existing legacy timeline versions and other possible internal paths require a later comprehensive provenance/readback audit; this patch targets verified exposed admission seams.

## .03 — selective recovery from PR #1390
- Exact outcome asset ID must equal QC-accepted output asset ID, not just match hash.
- Exact outcome SHA-256 must agree with QC-accepted SHA-256.
- Accepted-output economics must be finite, nonnegative, and match summarized realized attempt cost.
- Added adversarial tests for same-hash/wrong-asset, drifted hash, NaN, positive Infinity, and negative cost.
- Do not claim these guards make the worker/live render ready.

## Follow-on production acceptance
1. Source-only PR review; exact-head tests/type-check/build, identity permission checks and CI.
2. Resume evidence-first Supabase migration forensics and isolated/staged repair (no reset).
3. Persist linked Story Bible → Character/Voice/World/Lighting/Blocking DNA → Shot/Take → Render/Review → Timeline/FINAL → Social proposal.
4. Verify original 10–30-second owned film/UGC pilot with an unbroken lineage: lighting + blocking + dialogue/voice + final sound, MP4/MOV playback on iPhone, hashes, costs, QC receipts.
5. Only after proof expand to cartoons, episodic, faceless YouTube, music videos and batch ads/vertical reels. Publication/paid ads/GPU spend remain independently approval gated.
