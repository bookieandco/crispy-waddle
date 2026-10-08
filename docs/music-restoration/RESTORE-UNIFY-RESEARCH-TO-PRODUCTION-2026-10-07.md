# RESTORE-UNIFY — one Music Restoration project, two repositories

Research PR: https://github.com/bookieandco/music-restoration-intelligence/pull/4
Production PR: https://github.com/bookieandco/crispy-waddle/pull/1141
Google Homebase prerequisite: https://github.com/bookieandco/crispy-waddle/pull/1139
Earlier No Good production canary research PR: https://github.com/bookieandco/music-restoration-intelligence/pull/3

## Source work in this integration tranche

- Real No Good and Party Nites pinned Git blob metadata and read-only SHA-256 research bridge.
- Production research-benchmark parser with permanent refusal to infer upload rights or runtime authority.
- Basic Pitch optional isolated-instrument worker, owner-authenticated persisted MIDI, Studio action and correctly typed MIDI DAW package.
- DDSP creative-timbre admission only: source audio/performance pitch evidence, model weight SHA-256, license/training rights, held-out guitar benchmark and human review required. This is a policy gate, NOT DDSP inference or a claim of original guitar recovery.
- Sony diffusion timbre model remains research-only until stronger real-audio and weight/license validation. Guitariz supplies chord/workstation ideas; Demucs already in the Music worker.

## Tracking sequence RESTORE-UNIFY.1 → .12

1. Exact-head and past PR audit — source done.
2. Research No Good and Party Nites locator/rights contract — source done, fixture SHA pending CI.
3. Research bytes/rights test — GitHub CI pending; real production A/B not done.
4. Producer-side read-only research proposal parser — source done, CI pending.
5. Owner-scoped isolated Basic Pitch MIDI + DAW and Studio — source done, live model test blocked.
6. DDSP creative model/approval gate — source done, actual DDSP checkpoint and inference blocked.
7. Same-song/performance guitar donor fingerprint and pitch/tempo/phase bounded repair — candidate decision sources done, live evidence/UI incomplete.
8. Ad-libs/doubles/harmonies real source waveforms + residual — pending.
9. Live DrumSep/six-source Demucs/conservation listening — source contracts exist, commissioning pending.
10. Full co-direction, real A/B, synced DAW and large exports, actual cloud archive — pending.
11. Production health/SWLC/RunPod and machine OAuth — blocked without real host evidence, GPU approval if new billed worker.
12. Two real song certifications, full mix blind listening and real DVC restore — required for MUSIC-RESTORE.FINAL, not done.

Never merge two Git histories or copy personal audio to public repos. The research repository is corpus/evidence, while production handles owner Auth, media, jobs, versioning, restoration and output.

Hardening dependencies remain MUSIC-DRIVE.1-.8, MUSIC-DEEPSTEMS.1-.10, MUSIC-RESTORE-HARDEN.1-.9. New RESTORE-UNIFY is their integration sequence.

## Truthful outcomes

Recovered = measured authentic bytes repaired locally.
Donor-reconstructed = approved related original recording segment with fingerprint/onset/phase evidence.
Creative = MIDI/VST or DDSP/diffusion timbre generated from a performance; not original recording.
Unresolved = missing source, uncertain separation, unavailable GPU/model/checkpoint, failed QC, missing rights or missing owner review.

Real-song canary and restored Drive hash evidence — not mock tests — are mandatory for FINAL.

## RESTORE-UNIFY source extensions and remaining gaps — October 7

**Verified source changes on stacked PR #1141**:
- Google Homebase PR #1139 head was reconciled as an explicit two-parent merge (no lost backup fixes); PR #1141 remains **draft**.
- Deep drums FLOAT residual now has second-pass on-disk readback: measured \`recombinationErrorRatio\`, \`maxAbsoluteRecombinationError\`, \`recombinedRenderMeasured=true\`, \`isolationCertified=false\`. CI generates numerical PCM example audio; **not a real drum-stem separation test**.
- Pitched instrument donor evaluator measures source/donor waveform chroma and transient-rate compatibility; production reconstruction fails closed if donor fit is missing/mismatched. Genuine guitar identity, musical phrasing, rights and real A/B still require separate evidence.
- DAW archive export has independently bounded multipart ZIP plan, plus direct authenticated owner asset downloads for oversized individual files. Full audio provenance, exact SHA checks and source-rights gates remain unchanged.

**All music work from prior chats remains assigned**:
- Music Restoration: true lead/backup/harmony/double/ad-lib **waveform separation** with residual; instrument-family model accuracy and calibrated acoustic/electric guitar identification; damaged-note/phrase repair, same-performance/session donor samples, matching amp/room/attack and band-limited spectral reconstruction; blind RX/SpectraLayers/Ozone/Neutron A/B evidence, original noise/ambience preservation, whole-mix and timbre QC.
- Creative reconstruction: Basic Pitch MIDI note/pitch bend review, instrument choice/VST audio rendering and Magenta DDSP timbre models (creative clearly labeled); optional Sony diffusion model gated on licensing and hardware.
- Studio: REAPER/Logic exports, large stem/part assembly, provenance approval and version undo, clean final master vs separated audio/creative outputs, true co-direct prompts and multiple takes.
- Director/Music Juggernaut: music/lyrics/beat recognition, audio stems in DAW, lip-sync, Foley/B-roll/video cuts, original song rights and export to Director/social publishing pipeline **without automatic posting**; treat it as governed downstream music use, not authority to overwrite source restoration.
- Research: repair \`analysis_engine\` executable claims in the research repo, No Good and Party Nites real source hash/rights, actual blind listening with logged discrepancies and measured outcomes; keep research PR #3 production OIDC canary distinct.
- Operations: deployed runtime + verified SWLC/Supabase Auth/RLS/Storage, restored/private Drive DVC & encrypted backups, actual machine OAuth, existing allowed RunPod/CPU worker host, playback/download on iPhone, owner-approved cost/paid resource when absolutely required.

**FINAL remains blocked**: only a complete real-source-to-DAW/Drive owner-accepted session certifies \`MUSIC-RESTORE.FINAL\`, never model availability or synthetic/contract CI alone.

## RESTORE-UNIFY.8 first operational vocal layer (source, not final) — 2026-10-07

A reviewed time-range audio renderer now produces synchronized full-length lead/backing/double/harmony/ad-lib/spoken/shout/response/effect/breath `vocal-reviewed.*` candidates and a float residual, with independently measured parent recombination. This is **manual reviewed time-region masking only**: overlapping voices are not separated by singer. The Studio permits an authenticated owner to select a specific vocal WAV, annotate start/end seconds, acknowledge listening review and render through the existing owner-scoped private worker. Results persist as hashed source-bound case artifacts available for DAW download and A/B. Any automatic model-level lead/harmony/ad-lib isolation, instrument/voice identity claims and actual real-song listening remain open.

New per-run proof: `test_reviewed_vocal_regions.py` uses real generated PCM stereo and a mocked FFprobe/FFmpeg staging boundary, `Music Core` enforces no accidental promotion to automatic speaker separation, and UI type-check is part of hardening CI. All failed CI reports are repaired at their exact head; do not mark full Music Restore FINAL from this contract. The new code is stacked on PR #1141 / #1139.
