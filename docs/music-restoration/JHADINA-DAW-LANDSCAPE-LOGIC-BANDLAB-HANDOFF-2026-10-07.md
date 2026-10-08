# JHADINA-DAW.1–.5 — Laptop Logic workflow, phone/tablet BandLab landscape

Canonical project: existing Music Restoration case. Source audio is immutable.
Production branch: \`feat/music-drive-deepstems-20261007\`, draft PR #1141.
Research benchmark branch and full RESTORE-UNIFY.1–.12 backlog remain unchanged.

## Implemented editor source (not production commissioning)

- **One web-based project:** \`/music/daw?caseId=...\` opens a restoration case. Laptop gets a wide timeline + inspector, phone/tablet gets landscape-oriented track/mixer/effects tabs and horizontal timeline scrolling. Portrait has a rotate prompt, with an escape hatch.
- **Non-destructive stem edits:** select, split at playhead, change clip start/end/source offset/fade-in/fade-out, change track name, gain (-60…+12 dB), pan, mute/solo, 3-band EQ, compressor, and undo prior local edit. Source master is never overwritten. Only one original reference sounds on first open; overlapping source+children are not accidentally summed.
- **Browser audition:** Web Audio graph runs track gain/pan/EQ/dynamics and admitted delay/highpass; loads private owner-scoped artifact URLs, with an interactive maximum of 12 simultaneous audible stems. It is not a reliable native VST render/bounce and does not create final master artifacts. To apply inserted/rearranged FX, restart playback.
- **Plugin slots:** VST3 and Audio Unit (AU, macOS) are editable, saved alongside effects in the same portable project. **Native binaries are not yet loaded/executed.** An AU slot is not valid for Windows, and a phone browser cannot run desktop VST/AU directly. Real execution must be a separate native, licensed, sandboxed companion, with verified installed plugin inventory and signed render/health receipt; mobile can control this through the same session when commissioned. Browser-supported builtins can currently run directly.
- **Durable cross-device edits:** Owner-authenticated \`GET/POST /api/music/daw/session\`, source hash binding, SQL revision-fenced save function, immutable revision events, service-only RLS and 409 conflict instead of silent overwrite. The schema is in \`20261007194500_music_daw_portable_sessions.sql\` and must be applied in the actual database; passing source CI is not migration/execution proof.
- **Restoration integration:** From the existing Studio, Open Jhadina DAW. WAV-based recovered, donor, drum-sub-stem and reviewed vocal-region artifacts can be added as independent editable tracks after processing. Creative MIDI remains preserved for DAW transfer; full piano-roll/note editing is a separate milestone, not pretended to be browser MIDI synthesizer here.

## The next executable coding milestones

\`JHADINA-DAW.6 → .7 → .8 → .9 → .10 → JHADINA-DAW.FINAL\`

6. Trusted laptop companion **actually scans/hosts** owner-installed VST3/AU, validates plugin IDs/formats/signatures/licensing, isolates plugins with crash limits, exposes versioned state and audibly previews with correct latency compensation; no untrusted uploaded binary or fake local execution
7. Real cross-device render job (including FX racks and automation), bounce to hashed case-derived WAV/FLAC with listening QC, avoid browser audio-only final export and preserve immutable source
8. MIDI piano roll, VST instruments, time/pitch repair and chord editing, deeper EQ/dynamics/channel strips, buses/returns, sidechain automation, take/comp editing, full mixer meters
9. Mobile phone/tablet on-device accessibility and landscape e2e testing; laptop desktop transport/keyboard workflow; offline-friendly snapshots, autosave/conflict UX and full multi-device sync
10. Restore Supabase/SWLC and worker/Drive machine auth on an actual device; commission local/approved compute; No Good and Party Nites actual blind A/B, source rights, DAW exported master, native plugin audio with signed receipts → JHADINA-DAW.FINAL only with proof

No freehand native Cakewalk patch is used: \`isnamewer/cakewalk-byond-mixer-v30\` README advertises product license circumvention, while code is a generic HTML redirect. It is not imported or executed. Designs refer generically to authorized Logic Pro / BandLab workflows without duplicating proprietary source/assets.

Prior \`MUSIC-DRIVE.1–.8\`, \`MUSIC-DEEPSTEMS.1–.10\`, \`MUSIC-RESTORE-HARDEN.1–.9\`, \`RESTORE-UNIFY.1–.12\` and Director workstation/music cross-system work remain active dependencies. **A green TypeScript test does not mean deployment or a native VST is ready.**

## Local laptop discovery instructions (no render claim)

The scan service \`services/music-daw-companion/local_discovery.py\` binds to **127.0.0.1:47471 only**, requires a 24+ character random token and exactly one deployed HTTPS web origin via \`MUSIC_DAW_ALLOWED_ORIGIN\`. This scans standard installed VST3 and macOS Audio Unit bundle locations without importing or executing code, returns a machine-keyed opaque installed-ID and readable name, and rejects untrusted origins/bearers. The token is entered *into the laptop browser only* and is never stored in the Jhadina cloud DAW project.

Example on the owner's own laptop: generate a strong token locally, set \`MUSIC_DAW_COMPANION_TOKEN\` and \`MUSIC_DAW_ALLOWED_ORIGIN\` to the deployed Jhadina HTTPS origin, then run \`python3 services/music-daw-companion/local_discovery.py\` from repo checkout. In Effects, enter that token and click **Scan this laptop**; discovered installed plugins may be added as disabled-for-execution project slots. Phone/browser does not load arbitrary native binaries; Windows/.vst3 and macOS/.vst3/.component are discovery-only.

The native processing host is **not built**. Do not conflate installed-bundle discovery, saved plugin state and real executable VST3/AU DSP. Upcoming host milestone: use an auditable native VST3 SDK-based host on macOS/Windows, load registered bundles in isolated processes, enforce consent/rights, verify attack surface and plugin state, and render deterministic WAV with measured latency/QC. AUv3 (including eligible iPad/iPhone native apps), CLAP, LV2 and AAX host adapters are follow-on **not implemented**; do not label a browser as an iOS AUv3 host.

Historical requirements from user conversations retained: Logic Pro AU-first plugin workflow, VST3/AUv3/CLAP/LV2 candidates, later AAX; tracking/takes/comping, foley and video timeline synchronization, before/after source comparisons, separate vocal layers/drums, original/restored/reconstructed material, full-length sample-aligned markers/regions and round-trip DAW ingest, dry/wet and busses, automations and editable AU/VST chains. The editor's current code provides only the documented subset. The rest remains within JHADINA-DAW.6–.10 and RESTORE-UNIFY.8–.12.
