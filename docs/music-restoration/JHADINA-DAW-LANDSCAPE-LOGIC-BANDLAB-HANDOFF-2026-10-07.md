# JHADINA-DAW.1–.5 — Laptop Logic workflow, phone/tablet BandLab landscape

Canonical project: existing Music Restoration case. Source audio is immutable.
Production branch: `feat/music-drive-deepstems-20261007`, draft PR #1141.
Research benchmark branch and full RESTORE-UNIFY.1–.12 backlog remain unchanged.

## Implemented editor source (not production commissioning)

- **One web-based project:** `/music/daw?caseId=...` opens a restoration case. Laptop gets a wide timeline + inspector, phone/tablet gets landscape-oriented track/mixer/effects tabs and horizontal timeline scrolling. Portrait has a rotate prompt, with an escape hatch.
- **Non-destructive stem edits:** select, split at playhead, change clip start/end/source offset/fade-in/fade-out, change track name, gain (-60…+12 dB), pan, mute/solo, 3-band EQ, compressor, and undo prior local edit. Source master is never overwritten. Only one original reference sounds on first open; overlapping source+children are not accidentally summed.
- **Browser audition:** Web Audio graph runs track gain/pan/EQ/dynamics and admitted delay/highpass; loads private owner-scoped artifact URLs, with an interactive maximum of 12 simultaneous audible stems. It is not a reliable native VST render/bounce and does not create final master artifacts. To apply inserted/rearranged FX, restart playback.
- **Plugin slots:** VST3 and Audio Unit (AU, macOS) are editable, saved alongside effects in the same portable project. **Native binaries are not yet loaded/executed.** An AU slot is not valid for Windows, and a phone browser cannot run desktop VST/AU directly. Real execution must be a separate native, licensed, sandboxed companion, with verified installed plugin inventory and signed render/health receipt; mobile can control this through the same session when commissioned. Browser-supported builtins can currently run directly.
- **Durable cross-device edits:** Owner-authenticated `GET/POST /api/music/daw/session`, source hash binding, SQL revision-fenced save function, immutable revision events, service-only RLS and 409 conflict instead of silent overwrite. The schema is in `20261007194500_music_daw_portable_sessions.sql` and must be applied in the actual database; passing source CI is not migration/execution proof.
- **Restoration integration:** From the existing Studio, Open Jhadina DAW. WAV-based recovered, donor, drum-sub-stem and reviewed vocal-region artifacts can be added as independent editable tracks after processing. Creative MIDI remains preserved for DAW transfer; full piano-roll/note editing is a separate milestone, not pretended to be browser MIDI synthesizer here.

## The next executable coding milestones

`JHADINA-DAW.6 → .7 → .8 → .9 → .10 → JHADINA-DAW.FINAL`

6. Trusted laptop companion **actually scans/hosts** owner-installed VST3/AU, validates plugin IDs/formats/signatures/licensing, isolates plugins with crash limits, exposes versioned state and audibly previews with correct latency compensation; no untrusted uploaded binary or fake local execution
7. Real cross-device render job (including FX racks and automation), bounce to hashed case-derived WAV/FLAC with listening QC, avoid browser audio-only final export and preserve immutable source
8. MIDI piano roll, VST instruments, time/pitch repair and chord editing, deeper EQ/dynamics/channel strips, buses/returns, sidechain automation, take/comp editing, full mixer meters
9. Mobile phone/tablet on-device accessibility and landscape e2e testing; laptop desktop transport/keyboard workflow; offline-friendly snapshots, autosave/conflict UX and full multi-device sync
10. Restore Supabase/SWLC and worker/Drive machine auth on an actual device; commission local/approved compute; No Good and Party Nites actual blind A/B, source rights, DAW exported master, native plugin audio with signed receipts → JHADINA-DAW.FINAL only with proof

No freehand native Cakewalk patch is used: `isnamewer/cakewalk-byond-mixer-v30` README advertises product license circumvention, while code is a generic HTML redirect. It is not imported or executed. Designs refer generically to authorized Logic Pro / BandLab workflows without duplicating proprietary source/assets.

Prior `MUSIC-DRIVE.1–.8`, `MUSIC-DEEPSTEMS.1–.10`, `MUSIC-RESTORE-HARDEN.1–.9`, `RESTORE-UNIFY.1–.12` and Director workstation/music cross-system work remain active dependencies. **A green TypeScript test does not mean deployment or a native VST is ready.**

## Local laptop discovery instructions (no render claim)

The scan service `services/music-daw-companion/local_discovery.py` binds to **127.0.0.1:47471 only**, requires a 24+ character random token and exactly one deployed HTTPS web origin via `MUSIC_DAW_ALLOWED_ORIGIN`. This scans standard installed VST3 and macOS Audio Unit bundle locations without importing or executing code, returns a machine-keyed opaque installed-ID and readable name, and rejects untrusted origins/bearers. The token is entered *into the laptop browser only* and is never stored in the Jhadina cloud DAW project.

Example on the owner's own laptop: generate a strong token locally, set `MUSIC_DAW_COMPANION_TOKEN` and `MUSIC_DAW_ALLOWED_ORIGIN` to the deployed Jhadina HTTPS origin, then run `python3 services/music-daw-companion/local_discovery.py` from repo checkout. In Effects, enter that token and click **Scan this laptop**; discovered installed plugins may be added as disabled-for-execution project slots. Phone/browser does not load arbitrary native binaries; Windows/.vst3 and macOS/.vst3/.component are discovery-only.

The native processing host is **not built**. Do not conflate installed-bundle discovery, saved plugin state and real executable VST3/AU DSP. Upcoming host milestone: use an auditable native VST3 SDK-based host on macOS/Windows, load registered bundles in isolated processes, enforce consent/rights, verify attack surface and plugin state, and render deterministic WAV with measured latency/QC. AUv3 (including eligible iPad/iPhone native apps), CLAP, LV2 and AAX host adapters are follow-on **not implemented**; do not label a browser as an iOS AUv3 host.

Historical requirements from user conversations retained: Logic Pro AU-first plugin workflow, VST3/AUv3/CLAP/LV2 candidates, later AAX; tracking/takes/comping, foley and video timeline synchronization, before/after source comparisons, separate vocal layers/drums, original/restored/reconstructed material, full-length sample-aligned markers/regions and round-trip DAW ingest, dry/wet and busses, automations and editable AU/VST chains. The editor's current code provides only the documented subset. The rest remains within JHADINA-DAW.6–.10 and RESTORE-UNIFY.8–.12.


## JHADINA-DAW.6 partial native host implementation (opt-in and uncommissioned)

The laptop now has a **guarded implementation path**, not merely VST metadata:
`services/music-daw-companion/native_effect_render.py` uses an independently installed `dawdreamer` native audio engine to load a scanned installed VST3/AU effect and render an owner-approved, input-SHA verified stereo WAV (at most 90 seconds / 100 MiB input). It verifies complete samples, timebase, finite output and output SHA before issuing a receipt clearly marked `plugin-processed`, `restorationCertified=false` and `effectIdentityAttested=false`. No source is overwritten; mono, instruments/MIDI and offline full-song chains still need separate commissioned adapters.

The loopback companion `local_discovery.py` only runs native DSP when `MUSIC_DAW_NATIVE_RENDER_ENABLED=YES`, DawDreamer is actually installed and a user submits an approved `POST /v1/render` with the scoped source hash and opaque installed-plugin ID. A supervised child process has a timeout; **this is NOT a full OS sandbox**, and plugins run as the user account. Use only authorized installed plugins from trusted publishers. Never expose the listener to a non-loopback interface or share the token.

DawDreamer is GPLv3; it is **NOT bundled** into Jhadina here and must undergo distribution/license/host-security review before shipping a consumer desktop binary. On a laptop where the owner has installed its compatible version, optionally install the package into an isolated Python environment with `pip install dawdreamer soundfile numpy`. Then explicitly set a local strong `MUSIC_DAW_COMPANION_TOKEN`, `MUSIC_DAW_ALLOWED_ORIGIN` to Jhadina's exact deployed HTTPS origin, and `MUSIC_DAW_NATIVE_RENDER_ENABLED=YES`. Start `python3 services/music-daw-companion/local_discovery.py` only on the owner's laptop. No real host, plugin or private recording has been commissioned or exercised by the GitHub contract tests.

The landscape BandLab-style phone and Logic-style laptop use one saved owner case. In laptop Effects: scan installed plugins, add a verified discovered plugin slot, save edits, separately approve the local execution, render only source-bound WAV, download the output, and **independently consent** to upload the candidate into the same private case via `/api/music/daw/native-render`. Uploaded candidates are hash-verified and `needsHumanReview=true`, not promoted/certified. Use `+ New stems` to edit the processed candidate. Phone can later view/edit the shared project or audition the saved processed WAV, but it never loads the VST binary itself.

### Still unverified and NOT DONE

- Real license-cleared VST3/AU plugin scanned and rendered on a machine, speaker/device output listening, plugin crash containment beyond child timeout, preset serialization, latency compensation, plugin parameter automation and isolated per-plugin crash/restart.
- Plugin render source constraints currently stereo WAV ≤12 MiB for the browser upload; long songs require a streaming/worker orchestration path and independently measured long-form latency/QC. AUv3 on eligible iOS-native apps, CLAP and LV2 need platform adapters. AAX remains a separate licensing/host decision.
- Native and web rendering parity, multi-take comping/region audio export, instrument VST/MIDI piano-roll, auto-master bounce and DAW roundtrip import are pending. So are the source restoration, model commissioning, database migration, Google OAuth/DVC and No Good/Party Nites real-song acceptance gates. Keeping the PR draft is mandatory.

## CHAT AUDIT — DAW.7.1–.7.4 coded, DAW.8 automation started

This section audits the complete Logic-like laptop/BandLab-like landscape phone requirements against committed evidence. A checked-in file or GitHub Actions test is **not** actual mobile/desktop device commissioning. The common restoration case persists edits, not a separate cloned music project.

### New actual audio rendering path

1. \`DAW.7.1\` — deterministic \`services/music-daw-companion/dry_bounce.py\` reads verified source WAV hashes, clips, gain/pan, mute/solo, sample offsets, fades and automation points, streaming 8192-frame chunks to a FLOAT32 WAV. Does not overwrite source. Stereo output supports at most 30 min per job, 48 registered tracks (no implicit normalization, resampling, plugin/EQ/compressor execution). Reports peak and RMS, outputs a SHA readback receipt and always flags \`restorationCertified:false\` and human audition requirement. Any **active** EQ/dynamics/plugin fails closed.
2. \`DAW.7.2\` — \`packages/music-core/src/music-daw-dry-kit.ts\` maps a **saved** \`music_daw_sessions\` revision to exact case-owned hash-verified stems; attaches \`daw-session.json\`, \`daw-assets.json\` and instructions \`DAW-DRY-BOUNCE.txt\` to existing private Restoration DAW bundle (and each split part). No signed/private source URLs are exposed in the serialized kit. Oversized source assets remain separately downloaded.
3. \`DAW.7.3\` — DAW **Bundle / dry render kit** navigates to the same case in Restoration Studio, not an unrelated first-listed case. Extract every archive part and place oversized files under the named \`stems/\` paths before running a local CPU bounce. If active DSP or non-WAV stems block rendering, process these through authorized native effects/registered WAV derivatives before dry export. This is a desktop/worker CLI workflow, **not** a one-click server-side master export.
4. \`DAW.7.4 / DAW.8.1\` — absolute time-keyframe \`gainDb\` and \`pan\` envelopes (up to 256 points per lane), owner-save validation, editable inspector points in laptop and mobile layouts. Browser audition calculates linear interpolated fader and pan at playback ticks. Offline render uses an exact sample timeline with the same continuous interpolation; hermetic numeric audio fixture tests cover actual WAV contents, trim/split, source proof, silence, pan/fades/automation, malicious path and input rejection.

### Requirements explicitly NOT complete (carry forward in order)

- **DAW.7.5** actual multi-stem online/worker **full-length FX bounce** (not just the dry CPU command); real plugin chain, all buses, EQ/dynamics match, latency compensation, plugin sidechains, tails, render-to-new-version, plugin crash sandboxing, audible A/B QC. A mobile web page cannot run desktop AU/VST3 binaries. Existing GPLv3 DawDreamer is optional and unbundled; user-installed only, not verified on a real laptop.
- **DAW.8.2** full piano-roll MIDI/virtual instruments and instrument-note repair, VSTi/AU plugins; tempo/grid/quantization, pitch stretch, musical note/rhythm donor fit, chord/harmony editing; non-destructive waveform clip drag, slip, snap, take lanes and comping, comp edits and undo/redo/history, automation beyond fader/pan (EQ/filter/FX/send curves). Existing manual reviewed vocal region time masks do **not** unmix simultaneous vocal singers/ad-libs.
- **DAW.8.3** Logic-like channel strips/buses/returns, sends, reverb, sidechain/dry-wet, drag/drop FX ordering, saved presets, plugin state, output meters, input monitoring and microphone/MIDI recording, sound libraries, virtual keyboards/drum pad performance, mastering/normalization rules and export alternatives (WAV/FLAC/MP3).
- **DAW.9** actual *iPhone/iPad landscape* responsive touch, long-project RAM, Safari audio restrictions, keyboard accessibility and safe-area audits; Mac/Windows laptop AU/VST3 compatibility, device audio routing, track latency, offline sync/autosave/conflict UI and persisted revisions, redo and project portability. Current responsive page is source-coded but not device-verified; current Web Audio preview is capped at 12 simultaneously audible tracks.
- **DAW-DIRECTOR** align DAW samples, voice/lip sync, video/foley timeline, B-roll and alternative takes, music fingerprint/beat perception, Director's Final Cut-like workstation, audio/music export back into scheduled ads/TikToks/YouTube/movies without mutating authoritative source, rights/license QC, provenance and cross-app asset identity.
- **RESTORE-UNIFY.8–.12** real pretrained automatic overlapping vocal separation (lead/ad-libs/doubles/harmonies), trained instrument/guitar identification, exact donor repair amp/room matching, actual DDSP/VST effect rendering, DrumSep and large-DAW real-model benchmarking, two rights-approved actual song trials and blind audition. Continue research PR #4 GitHub runner failure and live research/production OIDC bridge only when runners are available; synthetic tests do not certify the two songs.
- **DAW.10 / HOMEBASE** actual Supabase migration and SWLC restore, signed authentication, owner storage and source retention, worker/RunPod/Homebase data routing, exact-head deployment and OAuth on the **machine that actually runs Jhadina**, Drive DVC canary + genuine remote restore, signed receipts and no unapproved paid GPUs. Phone remains a temporary operator, not a magic VST server.

### Acceptance gates and truthful labels

A real audio WAV with a correct SHA is evidence of **rendered processed material**, not recovered/original mastering or commercially publishable certification. A green source test does not certify a deployed app or an installed VST. Full source and GitHub CI must stay exact-head verified; reference branch PR #1141 remains draft until owner-reviewed critical runtime and real-song evidence exists.

Next practical coding order: \`DAW.7.5 long-form rendered FX worker→ DAW.8.2 piano roll/record/takes/comp → DAW.8.3 real mixer buses and full plugins → DAW.9 hardware QA/autosave → DAW-DIRECTOR timeline roundtrip → RESTORE-UNIFY.8–.12 audio intelligence proof → DAW.10+ launch certification\`. Research, Drive, restoration and Music Juggernaut backlogs must stay linked and visible.
