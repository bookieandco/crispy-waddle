# Jhadina Music Restoration + DAW — canonical coding handoff
**Audit date:** October 8, 2026
**Purpose:** Preserve every open and partly completed coding sequence from this chat and its prior handoffs, with a concrete next execution plan. Existing source work must be reused, not rebuilt.

> STATUS: SOURCE-CODED / CI-VERIFIED, **NOT PRODUCTION OR FINAL CERTIFIED**. Audio and model contracts on synthetic fixtures are not proof of deployed playback, live VST processing, multi-singer separation, approved real-song repair, or actual encrypted Drive restore.

## 1. Current branch, exact-head receipts and dependencies

- Production: [bookieandco/crispy-waddle](https://github.com/bookieandco/crispy-waddle), branch **feat/music-drive-deepstems-20261007**, audit head **14f7af2efba74e1884b5a31b553fa0c1663cc079**.
- Draft production [PR #1141](https://github.com/bookieandco/crispy-waddle/pull/1141) OPEN, not merged or deployed, still based on feature branch feat/google-homebase-drive-backup-20261007. Upstream [PR #1139](https://github.com/bookieandco/crispy-waddle/pull/1139) has **MERGED**, so review the actual merge base and re-target #1141 carefully before any merge. Never treat merged backup source as proof the machine OAuth/restore is commissioned.
- CI at the audit head: [Music Restoration Hardening #37853359370](https://github.com/bookieandco/crispy-waddle/actions/runs/37853359370) PASS (music-core and python-contract); [Music Drive #37853359290](https://github.com/bookieandco/crispy-waddle/actions/runs/37853359290) PASS; [Music Deep Stems #37853359205](https://github.com/bookieandco/crispy-waddle/actions/runs/37853359205) PASS. Recheck the newest exact head after writing this report.
- Research [music-restoration-intelligence PR #4](https://github.com/bookieandco/music-restoration-intelligence/pull/4) OPEN/DRAFT, head 9a15ab05d5755c0788d64bcf2e46bea5c7c0dedd. Research Actions 37715216463 and 37715203194 FAILED before usable runner evidence; actual source-byte SHA256 remains unproven. Independent real-song OIDC canary [research PR #3](https://github.com/bookieandco/music-restoration-intelligence/pull/3) is still DRAFT.
- Canonical tracker: [RESTORE-UNIFY.FINAL issue #1142](https://github.com/bookieandco/crispy-waddle/issues/1142) remains OPEN.
- Preserve dependency lanes MUSIC-DRIVE.1–.8, MUSIC-DEEPSTEMS.1–.10, MUSIC-RESTORE-HARDEN.1–.9 and RESTORE-UNIFY.1–.12; no hidden closure due to DAW progress.

## 2. Non-negotiable product design

**One Jhadina DAW, one saved owner case/project across all devices.** Do not build another separate production DAW or overwrite Director projects.

**Laptop:** Logic Pro-inspired wide arrangement, inspector, channel strips/mixer, real editable waveform/audio/MIDI, VST3 and macOS Audio Units from trusted installed inventory, saved plugin state/presets, instruments, piano roll, recording/takes/comping, buses/sends, sidechain, automation, sound library, mastering and roundtrip export.

**Phone/iPad:** BandLab-inspired touch-first **landscape/horizontal** DAW, real waveforms, clip drag, scrub/zoom, mixer/fx tabs and safe areas; same authenticated cloud project; audio renders where supported and can control/later audition approved laptop-hosted native plugin output. Native VST binaries do NOT run inside a phone web browser. Support eligible native AUv3 only after separate platform adapter work.

**After stem separation:** independently edit lead/backing/doubles/harmony/ad-lib/response vocals, kick/snare/toms/cymbals, bass/guitar/keys and other stems wherever **real** model/source evidence supports them. Include non-destructive trim/move/copy/fade/undo, independent track processing, take comparison, re-mix, source-vs-candidate A/B, identifiable revisions and per-track export. Reviewed time-window roles do not automatically unmix overlapping voices.

**Audio restoration:** repair original source first; replace bad drum/note/phrase using measured same-performance authorized clean donors before suggesting creative sound. Match note/tempo/phase, amp/room/timbre/attack and preserve ambience. Label DDSP/Basic Pitch/VST creations as creative, NOT recovered-original.

**Director/Music Juggernaut:** sample/frame-aligned stem-to-video timeline, Foley and lip sync, beat/lyrics recognition, B-roll and alternate takes, editable exports into ads/TikToks/YouTube/films. Preserve existing video project and require owner approval before publishing.

**Cost/security:** use owner laptop/local CPU/existing authorized remote compute; phone remains a control surface. Do not create billable GPU, paid subscriptions, upload proprietary audio to an unauthorized repository or publish music without explicit approval. Supplied Cakewalk license-bypass reference was rejected as implementation; use only lawful high-level Logic/BandLab design patterns.

## 3. Verified coded coverage (not live commissioning)

| Slice | Concrete code | What it proves / does not prove |
| --- | --- | --- |
| DAW.1–.5 case/UI/edit state | apps/jhadina-web/src/app/music/daw/page.tsx; packages/music-core/src/music-daw-session.ts; apps/jhadina-web/src/app/api/music/daw/session/route.ts; supabase/migrations/20261007194500_music_daw_portable_sessions.sql | Owner-scoped source/hash-bound session, revision CAS, undo/clip metadata, gain/pan/mute/solo, EQ/compressor controls, landscape and desktop layouts. DB not yet migrated/live verified. |
| DAW.6 VST/AU candidate | services/music-daw-companion/scan_plugins.py; local_discovery.py; native_effect_render.py; run_local_render_job.py; music-daw-native-client/import.ts | Strong-token loopback plugin scanner; optional **user-installed GPLv3 DawDreamer** local short-WAV native effect engine with explicit execution/download/private-import consent. No consumer-grade plugin isolation, state/preset/latency certification or real hardware acceptance. |
| DAW.7.1–.4 dry full-song bounce | services/music-daw-companion/dry_bounce.py; packages/music-core/src/music-daw-dry-kit.ts | Streaming hash-checked dry Float32 WAV with exact clip timing, source offsets, fades, gain/pan, solo/mute and automation (up to 30 min subject to source constraints). It fails CLOSED for active EQ/compressor/VST effects. Saved dry session/source map included in private DAW bundle. |
| DAW.7.6 individual edited stems | services/music-daw-companion/stem_bounce.py | Mix plus aligned edited full-length Float32 WAVs per audible track, with independent on-disk master-vs-stem acoustic null QC, source/output SHA and roles. For local owner checkout; not owner-machine-proven. |
| DAW.7.5 quick device output | packages/music-core/src/music-daw-browser-bounce.ts; DAW page | Actual browser-local short dry WAV/ZIP. Limits: up to 8 audible stems, 60s, 48 kHz, 32 MiB input. WAV PCM16/24/float; hashes, sample count, peak, source alignment. No real EQ/compressor/native plugin mastering in bounce. |
| DAW.8 partial edits | packages/music-core/src/music-daw-session.ts and tests | Sample-aligned move/duplicate/slip trim, BPM beat/1-8/1-16 snapping; gain/pan time keyframes and interpolation. Not a full MIDI piano roll, multi-take comp editor or buses. |
| DAW.9.1 waveforms/gestures | packages/music-core/src/music-daw-waveform.ts; apps/jhadina-web/src/lib/music/music-daw-waveform-client.ts; DAW page | PCM-derived SHA-checked private short-WAV peak envelope, source-offset-correct display; pointer/touch draggable clips with collision/snap guards. No physical Safari/iPad acoustic/gesture proof and no long-file waveform proxies. |
| DAW-DIRECTOR.1 proof draft | packages/director-core/src/music-daw-handoff.ts; stem_bounce.py | DIRECTOR-AUDIO-HANDOFF.json, source case, revision, sample timebase and receipt hashes. Produces a review-only proposal after future trusted private media registration. Does **not** mutate existing Director timeline or export final video. |
| RESTORE-UNIFY layers | services/music-restoration-worker reviewed_vocal_regions.py, musical_donor_fit.py, deep_stems.py, performance_transcription.py; Music Core gates | Manual reviewed vocal time masks+residual, coarse donor matching, synthetic float drum conservation, optional Basic Pitch MIDI, DDSP approval contract. No real automatic overlapping lead/ad-lib/doubles singer isolation, licensed DDSP model or actual two-song certification. |
| DAW/Drive bundle | apps/jhadina-web/src/lib/music/restoration-daw-bundle-service.ts; export route; Google Homebase sources | Authenticated asset export, SHA checks, split ZIP/direct downloads for oversized files, REAPER/Logic guidance, offline saved dry-render kit. Real host OAuth and remote-only backup/restore NOT certified. |

**Repeatable source-only laptop dry render:** Download the SAME owner case's DAW bundle and every part/direct oversize stem, extract into one folder with stems/ and daw-session.json + daw-assets.json; run the already-coded command:
    python3 services/music-daw-companion/stem_bounce.py --session daw-session.json --assets daw-assets.json --audio-root stems --output-dir MY-EDITED-STEMS
Verify mix.wav, aligned stems/*.wav, edited-stems-receipt.json, DIRECTOR-AUDIO-HANDOFF.json and null QC; then personally listen. Do not play the mix AND all children together: it doubles audio. This has NOT been executed on the user's physical laptop or owner songs.

## 4. No-loss unfinished sequence register

**P0 — DAW-FINISH.01 / exact-head branch governance.** Fetch both repos, PR #1141, main and merged #1139; compare tree/merge base, CI, and avoid silently losing the Homebase backup layer. Preserve PR draft until real runtime conditions and explicit approval.

**P0 — DAW-FINISH.02–.04 / real DSP and final WAV.** Render authenticated admitted EQ, compressor, filter, delay including tails, track FX ordering and parameter automation; verify browser/offline parity, sample rate, loudness, clipping, latency, sidechains, private hashes and independent readback. Native VST3/AU plugin state/presets and approved host are separate DSP acceptance gates. Extend existing stem_bounce.py rather than building new export stack. No mock plugin 'success'.

**P1 — DAW-EDIT.10–.18 / real co-direction.** Waveform scrub, group edits and fades/crossfades, track zoom and grouped timing; take lanes/comping, MIDI piano roll, virtual VSTi/AU instruments, note/pitch/time controls, audio recording and sampling, piano pads, reversible redo and source/vocal/drum-layer listening comparison, editable effect automation.

**P1 — DAW-MIX.1–.9 / actual Logic-like mixer.** Channel strips, meters, buses/returns/sends/sidechains, dry/wet, FX reordering and saved presets, plugin crash isolation/restart, available/rights-approved VST3/AU and future AUv3/CLAP/LV2 after platform/license validation (AAX separate), mastering and WAV/FLAC/MP3 exports.

**P0 — DAW-DIRECTOR.2–.5.** Private owner-scoped media upload+independent SHA/registration, revision-fenced merge into existing Director project, frame/sample timebase and Foley/lip sync QC, user-approved video/music export into Director/Juggernaut/business pipeline. Existing .1 is draft only; no duplicate video workstation.

**P1 — DAW-MOBILE.2–.9.** Physical iPhone & iPad landscape tests, Safari audio restrictions, signed URL refresh, CORS, touch drag/zoom, track/mixer safe areas and keyboard accessibility, background/foreground/offline project behavior, conflict recovery and autosave; Mac (and if applicable Windows) laptop actual installed-plugin render and audio device output.

**P0 — RESTORE-UNIFY.3,5–.12.** Research runner failure resolution and exact bytes/SHA256 & rights; Basic Pitch actual isolated instrument; licensed DDSP; instrument-family/guitar weights/calibration with abstention; donor sound/timing/room proof; **actual simultaneous voice separation** with residual rather than labeled time masks; live 6-stem + DrumSep real listening; true restored-vs-creative A/B; co-directed variants; two rights-cleared songs ('No Good', 'Toy - Party Nites') tested with blind owner review, preserved originals and repaired-only deltas.

**P0 — PLATFORM/GOOGLE-HOMEBASE.** Apply migrations; validate Supabase RLS/Auth/Storage/SWLC and real worker; connect actual machine Google OAuth, DVC encrypted backup and independent remote-only restore; owner phone = operator, laptop/existing allowed host = worker. Any unavailable dependency = AUDIT/REPAIR, not forged proof and not paid provisioning.

**P1 — MUSIC-JUGGERNAUT/SOCIAL.** Reuse approved media rights and versions for music videos, faceless/UGC ads, Foley/lip sync, alternate takes, editing and publishing schedule. No unattended upload/publication without explicit authorization.

## 5. Next coding order (begin with CURRENT exact head)

1. **DAW-FINISH.01:** Re-audit #1141 exact HEAD & CI, #1139 merge-base, Main, research PR #4, #1142. Repair any red; do not blindly merge or rebase.
2. **DAW-FINISH.02:** Add DSP-faithful actual WAV rendering for built-in EQ/compressor/highpass/delay and their time automation, non-finite, tails and latency QC; always fail if unsupported.
3. **DAW-FINISH.03:** Commission one locally installed, explicitly permitted VST3 or AU on real laptop (owner installed DawDreamer optional with GPLv3 distribution/security review), audibly render, verify SHA plus crash/restart and preset state, not just scanner listing.
4. **DAW-FINISH.04:** Integrate effect render into existing full-song stem/mix export, independent disk readback and Logic/BandLab/REAPER import, actual owner A/B.
5. **DAW-EDIT.10–.18 + DAW-MIX.1–.9:** True MIDI/take/bus/sidechain/record features and reversible audio editing.
6. **DAW-DIRECTOR.2–.5:** Owner-private signed media registration, safe existing-project merge, sample/fps/foley/lipsync, export.
7. **RESTORE-UNIFY.3,5–.12:** Repair research byte CI, commission actual safe models (vocals, instrument, drums, creative), donor repair, two real song benchmark + listening.
8. **DAW-MOBILE.2–.9:** Physical laptop/phone/tablet proof, cross-device saves/autosave/URL refresh and mobile sound.
9. **PLATFORM-COMMISSION → MUSIC-RESTORE.FINAL:** Supabase/SWLC, worker, machine Google Drive auth, encrypted restore, actual end-to-end use and owner approval. Final stays blocked without durable signed evidence.

## 6. Certification and operational rules

| Gate | Current assessment |
| --- | --- |
| Exact source-head Music Core/Web/Python, Drive, Deep Stems | **PASS** at 14f7af2e... (recheck after handoff commit) |
| Source-aligned edited dry stereo WAV and stems | **Coded + synthetic PCM/readback tested**; not proved on owner laptop or songs |
| Built-in EQ/compression and VST/AU in actual final rendered mix | **NOT PROVEN**; active DSP presently fails closed in dry export |
| Authentic vocals/adlibs/drums/guitar model separation/reconstruction | **NOT PROVEN on user songs**; manual time regions cannot unmix overlaps |
| Director actual audio registration, timeline merge, video export | **STAGED DRAFT ONLY** |
| Authenticated storage, device save, SWLC health, Drive restore | **NOT VERIFIED END TO END** |
| Rights, two real-song blind audition and approved release | **NOT COMPLETE** |
| FINISHED consumer DAW or MUSIC-RESTORE.FINAL | **NO** |

**Do not overstate:** A green synthetic audio CI and SHA-verified dry PCM does not certify native plugin execution, restoration authenticity, public release or deployment. Existing laptop-native VST executes untrusted vendor code as owner; subprocess timeout is not sandbox isolation, and GPLv3 DawDreamer is optional/unbundled with licensing review. Browser audition can have 12 audible tracks, quick bounce only 8, and full local dry bounce has separate duration/file constraints. Source URLs expire; phone browser is not a VST server. Research PR4 failure before runner gives no real source-byte proof. Avoid paying for a new GPU without approval.

**Resume references:** 
- docs/music-restoration/JHADINA-DAW-LANDSCAPE-LOGIC-BANDLAB-HANDOFF-2026-10-07.md
- docs/music-restoration/DAW-DIRECTOR-ROUNDTRIP-HANDOFF-2026-10-08.md
- docs/music-restoration/RESTORE-UNIFY-RESEARCH-TO-PRODUCTION-2026-10-07.md
- docs/music-restoration/MUSIC-RESTORATION-CANONICAL-EXECUTION-2026-10-07.md
- docs/music-restoration/JHADINA-MUSIC-DAW-CANONICAL-HANDOFF-2026-10-08.md (this report)
- GitHub tracker issue #1142, draft production PR #1141, research PRs #3/#4.

**Handoff instruction to next coding agent:** Continue incremental commits on canonical production branch using expected-head SHA checks, post proof to issue #1142 and PR #1141, keep origin rights/source SHA/classification intact, mark inaccessible Supabase/Google/RunPod work AUDIT/REPAIR and complete independent work without duplicating built modules. Never claim FINAL without owner-installed host VST, two real-song auditory tests, private backend deployment, proven Drive restore, actual landscape device E2E, and signed receipts.
