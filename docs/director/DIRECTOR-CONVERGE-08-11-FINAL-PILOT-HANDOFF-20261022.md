# DIRECTOR-CONVERGE.08–.11 — source and technical handoff
Date 2026-10-22. Draft PR #1473. No merge, deployment, database migration, spending or publication.

## .08 iPhone UI and source preview
- Workstation page: five stages Project, Direct, Review, Edit, Finish; 20 department panels dynamically imported and mounted only on active stage.
- WorkstationTimeline takes canonical fps, width, height so portrait project dimensions persist.
- timeline-playback-plan: source in/out, speed and timeline offsets; unsupported cases fail closed.
- GET /api/workstation/timeline/preview: only signed-in project members, persisted project timeline, approved real project assets and allowlisted director-media signed URLs (900s); no client-provided URL accepted.
- WorkstationPlayback plays native video plus timeline-relative audio sources with scrub and play controls. This is not composited final media or mastering. iPhone device verification remains pending.

## .09 real offline FFmpeg
- offline-final-render-plan: canonical expected revision, approved source digests, 1–120s, strict FPS/dimensions. Reject unsupported effects, transitions, reverse and video overlaps.
- POST /api/workstation/timeline/render-plan: user/project checks, persisted asset + approval + real provider + media origin and SHA. Returns plan only; does not render.
- scripts/director-offline-final-render.py: explicit --execute required, local root paths and SHA-256 checks, argv-only FFmpeg H.264/AAC composition, audio mix, ffprobe of result, source/final hash receipt, no publish authority.
- scripts/director-offline-final-render-test.py: 12s original synthetic pattern+sound, true FFmpeg render, probe and receipt. Synthetic moving test pattern verifies mechanics, NOT cinematic quality.

## .10 Explain and Recast donor recovery
- Source ports from #1431: explainer-director planner/tests and WorkstationExplainerStudio. Browser-safe package subpath fixes the prior Node-only barrel import. Produces storyboard, caption SRT and optional silent local draft; not generated real scenes or synthesized narration.
- Source ports from #1432: recast-preview and disabled worker handoff/tests. Maintains source movement, lighting, geography and audio resync intent; requires consent/rights and approved tracks; worker disabled and permit null. Does not authorize GPU/spending/publication.

## .11 independent original animated creative pilot
- The Lightkeeper: 12-second vertical original 2D animated fox character, three blocked shots, cool city environment, warm lantern practical lighting, original procedural soundtrack and titles.
- Local MP4 verified H.264 video/AAC audio, 480 x 854, 24 fps, 12.0 seconds.
- SHA256 a4a9e21ce25a2f15392dfbdcdcb474643aa6469b35b1a7a1e50813bd5bd15052.
- MP4 and technical receipt provided as conversation artifacts, not published nor committed as repo binaries.
- This local animated pilot is not an owner Supabase production project, not a real Recast worker execution, and not an independently final-QC-approved production master.

## Blockers
- Director production schema from .04–.07 is still missing in live Supabase: timeline and inputs, screenplay, Watch and final-QC stores. No destructive repair performed.
- No staging replay of duplicate version migrations or independent backup/restore certification. No authentic owner-linked video provider output verified.
- Actual iPhone Safari authenticated source playback, independently approved final master and permitted Social handoff require future evidence.
- Exact-head CI must be checked after latest commit; historical passes are not exact-head acceptance.

## Next
Resolve migration collision/backup/staging admission with separate approval; then validate one owned 10–30s video through canonical project, character/lighting/blocking reference, approved real take, timeline, local FFmpeg, independent QC, iPhone and governed Social proposal. No automatic spending or publication.