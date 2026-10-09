# DAW-DIRECTOR.1 — source-bound sample-exact audio exchange

This continuation reuses the existing Jhadina Music Restoration and Director Workstation contracts. No third DAW or video system is created.

The owner-run CPU `stem_bounce.py` produces actual sample-zero, identical-length stereo Float32 WAVs, a reference mix, and `edited-stems-receipt.json` (source and output SHA-256 plus independent on-disk null QC). It now additionally produces `DIRECTOR-AUDIO-HANDOFF.json`, containing the exact source-case/revision, edited stem hashes, role, relative paths and timebase. The sidecar is **pending media registration** and never contains owner URLs or tokens.

`packages/director-core/src/music-daw-handoff.ts` validates the receipt and stages a draft Director audio timeline only after an external owner-scoped Director ingester independently hashes, registers and reports every corresponding WAV by registered asset ID, exact sample clock and registration receipt. It returns `requiresOwnerReview=true`, does **not** save a timeline or modify any existing video edit and does not treat local evidence as server-trusted media by itself.

To preserve the user's existing project, later work must append verified tracks through revision-fenced Director timeline editing, not call a new-project creator on their saved video. A vocal-only lipsync model still needs a separately approved aligned vocal segment. Director foley, B-roll, video timing, frame/sample clock QA, Music Juggernaut/publishing export, source/rights checks and sample-loudness approval remain separately gated.

**Remaining DAW-DIRECTOR sequence:** .2 trusted media registration and private upload → .3 safe existing-project timeline merge and owner review → .4 sample/fps, foley and lip-sync QC → .5 finished video/audio roundtrip and export → FINAL only after real media proof.

Other retained open sequences: DAW.7.5 full-length FX rendering, DAW.8 advanced MIDI/takes/recording/mixer, DAW.9 real landscape phone/tablet/laptop tests, DAW.10 Supabase/SWLC/Drive commissioning, RESTORE-UNIFY.8–.12 real model/stems/song benchmarks. Tests use synthetic WAVs, not real-owner songs or deployed plugins.
